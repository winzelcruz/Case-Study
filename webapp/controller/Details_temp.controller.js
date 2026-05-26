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
            calcTotal: function (vQty, vPrice) {
                const total = (Number(vQty) || 0) * (Number(vPrice) || 0);
                return new Intl.NumberFormat("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(total);
            },

            plantFormat: function (sCode, sName) {
                return (sCode != null ? String(sCode) : "") + " - " + (sName != null ? String(sName) : "");
            },

            productFormat: function (sId, sName) {
                return (sId != null ? String(sId) : "") + " - " + (sName != null ? String(sName) : "");
            },

            formatProductCount: function (aProducts) {
                const iCount = Array.isArray(aProducts) ? aProducts.length : 0;
                return "Product (" + iCount + ")";
            },

            to2: function (v) {
                const cleaned = String(v ?? 0).replace(/,/g, "").replace(/[^\d.-]/g, "");
                const n = parseFloat(cleaned);
                return (isNaN(n) ? 0 : n).toFixed(2);
            }
        },


        _onRouteMatched: function (oEvent) {
            const oArgs = oEvent.getParameter("arguments") || {};
            const sOrderNumber = oArgs.OrderNumber || oArgs.orderNumber;

            const oView = this.getView();
            const oODataModel = oView.getModel(); // default ODataModel
            if (!oODataModel) {
                oView.setModel(new JSONModel([]), "orderProducts");
                return;
            }

            let oLocalModel =
                this.getOwnerComponent().getModel("localOrders") ||
                sap.ui.getCore().getModel("localOrders");

            let iIndex = -1;

            if (oLocalModel && typeof oLocalModel.getProperty === "function") {
                oView.setModel(oLocalModel, "localOrders");

                const aOrders = oLocalModel.getProperty("/") || [];
                iIndex = aOrders.findIndex(o => String(o.OrderNumber) === String(sOrderNumber));

                if (iIndex >= 0) {
                    oView.bindElement({ path: "localOrders>/" + iIndex });
                }
            }

            const sOrderPath = !isNaN(sOrderNumber)
                ? "/Orders(" + sOrderNumber + ")"
                : "/Orders('" + encodeURIComponent(sOrderNumber) + "')";

            //anne.marie.c.mendoza add code to check if data persists
            // check if already saved locally
            let aExistingDetails = oLocalModel.getProperty("/" + iIndex + "/Order_Details");

            if (aExistingDetails !== undefined && aExistingDetails !== null){
     
                // map ProductName from saved structure
                aExistingDetails.forEach(function(item) {
                    if (item.Product && item.Product.ProductName) {
                        item.ProductName = item.Product.ProductName;
                    }
                });

                oView.setModel(
                    new JSONModel(aExistingDetails),
                    "orderProducts"
                );

            } else {

                // fallback to OData only if no local data
                oODataModel.read(sOrderPath, {
                    urlParameters: { "$expand": "Order_Details/Product" },

                    success: function (oData) {

                        const aDetails = (oData.Order_Details && oData.Order_Details.results)
                            ? oData.Order_Details.results
                            : [];

                        aDetails.forEach(item => {
                            item.ProductID = item.ProductID != null
                                ? item.ProductID
                                : (item.Product ? item.Product.ProductID : null);

                            item.ProductIDText = item.ProductID != null ? String(item.ProductID) : "";

                            item.ProductName = item.Product
                                ? item.Product.ProductName
                                : (item.ProductName || "");

                            item.UnitPrice = item.UnitPrice != null
                                ? item.UnitPrice
                                : (item.Product ? item.Product.UnitPrice : 0);

                            item.Quantity = item.Quantity || 0;
                        });

                        oView.setModel(new JSONModel(aDetails), "orderProducts");

                    }.bind(this)
                });
            }

        },

        onCancel: function () {
            this.getOwnerComponent().getRouter().navTo("RouteMain");
        },

        onEdit: function () {

            let oRouter = this.getOwnerComponent().getRouter();
            let oContext = this.getView().getBindingContext("localOrders");

            let sOrderNumValue = oContext.getProperty("OrderNumber");

            oRouter.navTo("RouteEdit", {
                OrderNumber: sOrderNumValue
            });

        },


        _readAsync: function (oModel, sPath, mParameters) {
            return new Promise((resolve, reject) => {
                oModel.read(sPath, Object.assign({}, mParameters, {
                    success: resolve,
                    error: reject
                }));
            });
        },

        _buildOrderPath: function (sOrderNumber) {
            return !isNaN(sOrderNumber)
                ? "/Orders(" + sOrderNumber + ")"
                : "/Orders('" + encodeURIComponent(sOrderNumber) + "')";
        },


    });

});