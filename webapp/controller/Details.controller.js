sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sapui5/group3/casestudy/model/Constants"
], function (Controller, JSONModel, Constants) {
    "use strict";

    return Controller.extend("sapui5.group3.casestudy.controller.Details", {

        //runs once when the controller is created, attaches route match handler for Details navigation.
        onInit: function () {
            this.getOwnerComponent()
                .getRouter()
                .getRoute("RouteDetails")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        formatter: {
            //calculates quantity * unit price and returns a localized string with exactly 2 decimal places.
            calcTotal: function (quantity, unitPrice) {
                const total = (Number(quantity) || 0) * (Number(unitPrice) || 0);
                return new Intl.NumberFormat("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(total);
            },

            //returns "PlantCode - PlantName" safely even when one or both values are null/undefined.
            plantFormat: function (plantCode, plantName) {
                return (plantCode != null ? String(plantCode) : "") + " - " +
                    (plantName != null ? String(plantName) : "");
            },

            //returns "ProductId - ProductName" safely even when one or both values are null/undefined.
            productFormat: function (productId, productName) {
                return (productId != null ? String(productId) : "") + " - " +
                    (productName != null ? String(productName) : "");
            },

            //returns a label like "Product (N)" where N is the length of the products array (or 0 if not an array).
            formatProductCount: function (products) {
                const count = Array.isArray(products) ? products.length : 0;
                return "Product (" + count + ")";
            },

            //cleans a potentially formatted currency/number string and returns a numeric string with exactly 2 decimals.
            to2: function (value) {
                const cleaned = String(value ?? 0)
                    .replace(/,/g, "")
                    .replace(/[^\d.-]/g, "");

                const parsed = parseFloat(cleaned);
                return (isNaN(parsed) ? 0 : parsed).toFixed(2);
            }
        },

        // Route handler: bind selected order header + load product details (prefer cached local data; fallback to OData $expand).
        _onRouteMatched: function (routeEvent) {
            // Get OrderNumber from route params (supports different casing).
            const routeArgs = routeEvent.getParameter("arguments") || {};
            const orderNumberParam = routeArgs.OrderNumber || routeArgs.orderNumber;

            const view = this.getView();
            const odataModel = view.getModel(); // default ODataModel

            // Guard: ensure products table has a valid model even if ODataModel is missing.
            if (!odataModel) {
                view.setModel(new JSONModel([]), "orderProducts");
                return;
            }

            // Use component-level localOrders when possible (fallback to core model if app uses global storage).
            let localOrdersModel =
                this.getOwnerComponent().getModel("localOrders") ||
                sap.ui.getCore().getModel("localOrders");

            // Find matching order in localOrders so header fields can bind to the correct context.
            let localOrderIndex = -1;
            if (localOrdersModel && typeof localOrdersModel.getProperty === "function") {
                view.setModel(localOrdersModel, "localOrders");
                this.getOwnerComponent().setModel(localOrdersModel, "localOrders"); // keep shared across pages (e.g., Edit)

                const localOrders = localOrdersModel.getProperty("/") || [];
                localOrderIndex = localOrders.findIndex(order =>
                    String(order.OrderNumber) === String(orderNumberParam)
                );

                // Bind header section to the found local order entry.
                if (localOrderIndex >= 0) {
                    view.bindElement({ path: "localOrders>/" + localOrderIndex });
                }
            }

            // Build OData key path for numeric vs string keys.
            const orderEntityPath = !isNaN(orderNumberParam)
                ? "/Orders(" + orderNumberParam + ")"
                : "/Orders('" + encodeURIComponent(orderNumberParam) + "')";

            // Prefer persisted Order_Details from localOrders to preserve data across navigation/refresh.
            let aExistingDetails = null;
            if (localOrdersModel && localOrderIndex >= 0) {
                aExistingDetails = localOrdersModel.getProperty("/" + localOrderIndex + "/Order_Details");
            }

            // If cached details exist, use them instead of calling OData.
            if (aExistingDetails !== undefined && aExistingDetails !== null) {
                // Normalize cached structure for table bindings (flatten ProductName).
                aExistingDetails.forEach(function (item) {
                    if (item.Product && item.Product.ProductName) {
                        item.ProductName = item.Product.ProductName;
                    }
                });

                view.setModel(new JSONModel(aExistingDetails), "orderProducts");
                return;
            }

            // Otherwise, fetch order + details + products in one call using $expand.
            odataModel.read(orderEntityPath, {
                urlParameters: { "$expand": "Order_Details/Product" },

                success: function (orderEntityData) {
                    // Fallback: if local header entry is missing (deep link/refresh), create a minimal localOrders item for bindings.
                    if (!localOrdersModel || localOrderIndex < 0) {
                        const mockStatusList = [
                            Constants.STATUS.CREATED,
                            Constants.STATUS.RELEASED,
                            Constants.STATUS.PARTIAL,
                            Constants.STATUS.DELIVERED
                        ];

                        const orderIdAsNumber = Number(orderEntityData.OrderID) || 0;

                        const formattedOrder = {
                            OrderNumber: String(orderEntityData.OrderID),
                            CreationDate: orderEntityData.OrderDate,

                            ReceivingPlantCode: "9101",
                            ReceivingPlantName: "Singapore Branch " + (orderEntityData.ShipName || ""),

                            DeliveringPlantCode: "9102",
                            DeliveringPlantName: "Malaysia Storage " + (orderEntityData.ShipCountry || ""),

                            Status: mockStatusList[orderIdAsNumber % mockStatusList.length]
                        };

                        localOrdersModel = new JSONModel([formattedOrder]);
                        view.setModel(localOrdersModel, "localOrders");
                        view.bindElement({ path: "localOrders>/0" });
                    }

                    // Extract expanded line items and normalize fields for consistent UI bindings.
                    const orderDetails = (orderEntityData.Order_Details && orderEntityData.Order_Details.results)
                        ? orderEntityData.Order_Details.results
                        : [];

                    orderDetails.forEach(detailItem => {
                        // Flatten/standardize Product fields even if some values are missing in the payload.
                        detailItem.ProductID = detailItem.ProductID != null
                            ? detailItem.ProductID
                            : (detailItem.Product ? detailItem.Product.ProductID : null);

                        detailItem.ProductIDText = detailItem.ProductID != null ? String(detailItem.ProductID) : "";

                        detailItem.ProductName = detailItem.Product
                            ? detailItem.Product.ProductName
                            : (detailItem.ProductName || "");

                        detailItem.UnitPrice = detailItem.UnitPrice != null
                            ? detailItem.UnitPrice
                            : (detailItem.Product ? detailItem.Product.UnitPrice : 0);

                        detailItem.Quantity = detailItem.Quantity || 0;
                        detailItem.isNew = false;
                    });

                    view.setModel(new JSONModel(orderDetails), "orderProducts");
                }.bind(this)
            });
        },

        //returns the user to the Main route without saving any additional changes.
        onCancel: function () {
            this.getOwnerComponent().getRouter().navTo("RouteMain");
        },

        //syncs localOrders to the component model and navigates to the Edit route for the currently bound order.
        onEdit: function () {
            let oRouter = this.getOwnerComponent().getRouter();

            let oModel = this.getView().getModel("localOrders");

            //force sync to component before navigating
            this.getOwnerComponent().setModel(oModel, "localOrders");

            let sOrderNumValue = this.getView()
                .getBindingContext("localOrders")
                .getProperty("OrderNumber");

            oRouter.navTo("RouteEdit", {
                OrderNumber: sOrderNumValue
            });
        },

        //wraps ODataModel.read in a Promise so you can use async/await for reads.
        _readAsync: function (model, path, parameters) {
            return new Promise((resolve, reject) => {
                model.read(path, Object.assign({}, parameters, {
                    success: resolve,
                    error: reject
                }));
            });
        },

        //builds the correct OData entity key path for Orders depending on whether the key is numeric or string.
        _buildOrderPath: function (orderNumber) {
            return !isNaN(orderNumber)
                ? "/Orders(" + orderNumber + ")"
                : "/Orders('" + encodeURIComponent(orderNumber) + "')";
        }

    });

});
