sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sapui5/group3/casestudy/model/Constants"
], function (Controller, JSONModel, Constants) {
    "use strict";

    return Controller.extend("sapui5.group3.casestudy.controller.Details", {

        onInit: function () {
            this.getOwnerComponent()
                .getRouter()
                .getRoute("RouteDetails")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        formatter: {
            calcTotal: function (quantity, unitPrice) {
                const total = (Number(quantity) || 0) * (Number(unitPrice) || 0);
                return new Intl.NumberFormat("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(total);
            },

            plantFormat: function (plantCode, plantName) {
                return (plantCode != null ? String(plantCode) : "") + " - " +
                       (plantName != null ? String(plantName) : "");
            },

            productFormat: function (productId, productName) {
                return (productId != null ? String(productId) : "") + " - " +
                       (productName != null ? String(productName) : "");
            },

            formatProductCount: function (products) {
                const count = Array.isArray(products) ? products.length : 0;
                return "Product (" + count + ")";
            },

            to2: function (value) {
                const cleaned = String(value ?? 0)
                    .replace(/,/g, "")
                    .replace(/[^\d.-]/g, "");

                const parsed = parseFloat(cleaned);
                return (isNaN(parsed) ? 0 : parsed).toFixed(2);
            }
        },

        _onRouteMatched: function (routeEvent) {
            const routeArgs = routeEvent.getParameter("arguments") || {};
            const orderNumberParam = routeArgs.OrderNumber || routeArgs.orderNumber;

            const view = this.getView();
            const odataModel = view.getModel(); // default ODataModel

            if (!odataModel) {
                view.setModel(new JSONModel([]), "orderProducts");
                return;
            }

            let localOrdersModel =
                this.getOwnerComponent().getModel("localOrders") ||
                sap.ui.getCore().getModel("localOrders");

            let localOrderIndex = -1;

            if (localOrdersModel && typeof localOrdersModel.getProperty === "function") {
                view.setModel(localOrdersModel, "localOrders");

                const localOrders = localOrdersModel.getProperty("/") || [];
                localOrderIndex = localOrders.findIndex(order =>
                    String(order.OrderNumber) === String(orderNumberParam)
                );

                if (localOrderIndex >= 0) {
                    view.bindElement({ path: "localOrders>/" + localOrderIndex });
                }
            }

            const orderEntityPath = !isNaN(orderNumberParam)
                ? "/Orders(" + orderNumberParam + ")"
                : "/Orders('" + encodeURIComponent(orderNumberParam) + "')";

            odataModel.read(orderEntityPath, {
                urlParameters: { "$expand": "Order_Details/Product" },

                success: function (orderEntityData) {

                    // If local order does not exist, build a fallback local model entry
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

                    const orderDetails = (orderEntityData.Order_Details && orderEntityData.Order_Details.results)
                        ? orderEntityData.Order_Details.results
                        : [];

                    orderDetails.forEach(detailItem => {
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

        onCancel: function () {
            this.getOwnerComponent().getRouter().navTo("RouteMain");
        },

        onEdit: function () {
            const router = this.getOwnerComponent().getRouter();
            const orderNumberText = this.byId("orderNumber").getText(); // sap.m.Text
            router.navTo("RouteEdit", { OrderNumber: orderNumberText });
        },

        _readAsync: function (model, path, parameters) {
            return new Promise((resolve, reject) => {
                model.read(path, Object.assign({}, parameters, {
                    success: resolve,
                    error: reject
                }));
            });
        },

        _buildOrderPath: function (orderNumber) {
            return !isNaN(orderNumber)
                ? "/Orders(" + orderNumber + ")"
                : "/Orders('" + encodeURIComponent(orderNumber) + "')";
        }

    });

});
