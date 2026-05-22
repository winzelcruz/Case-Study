sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "sapui5/casestudy/casestudy/model/Constants"
], (Controller, History, MessageBox, JSONModel, Constants) => {
    "use strict";

    return Controller.extend("sapui5.casestudy.casestudy.controller.Edit", {
        
        formatter: {
            showText: function(isNew) {
                return !isNew;   // show Text when NOT new
            },

            showInput: function(isNew) {
                return isNew;    // show Input when new
            }
        },
        
        onInit() {
            //initiate binding router        
            let oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("Edit").attachPatternMatched(this._onObjectMatched, this);

            //initiate constants
            this.getView().setModel(new JSONModel(Constants), "Constants");
        },
        
        _onObjectMatched: function (oEvent) {

            let sOrderNumber = oEvent.getParameter("arguments").orderNumber;
            let oModel = sap.ui.getCore().getModel("localOrders");

            // ✅ attach model to view
            this.getView().setModel(oModel, "localOrders");

            let aOrders = oModel.getProperty("/");
            let iIndex = aOrders.findIndex(o => 
                String(o.OrderNumber) === String(sOrderNumber)
            );

            // ✅ bind using FULL model path
            this.getView().bindElement({
                path: "localOrders>/" + iIndex
            });

            //load Products
            this.getView().getModel().read("/Products", {
                success: function (oData) {
                    this._aProducts = oData.results; // store for mapping
                }.bind(this)
            });

            this.getView().getModel().read("/Orders(" + sOrderNumber + ")", {
                urlParameters: {
                    "$expand": "Order_Details"
                },
                success: function (oData) {

                    let aDetails = oData.Order_Details.results;

                    // ✅ SIMPLE: map ProductName
                    aDetails.forEach(function(item) {

                        let oProduct = this._aProducts.find(function(prod) {
                            return prod.ProductID === item.ProductID;
                        });

                        if (oProduct) {
                            item.ProductName = oProduct.ProductName;
                            item.UnitPrice = oProduct.UnitPrice; // optional if needed
                        }

                        item.isNew = false;

                    }.bind(this));

                    this.getView().setModel(
                        new sap.ui.model.json.JSONModel(aDetails),
                        "orderProducts"
                    );

                }.bind(this)
            });

        },   

        onAddItem: function () {

            let oModel = this.getView().getModel("orderProducts");
            let oTable = this.byId("idProductsTable");

            // ✅ get array directly
            let aProducts = oModel.getProperty("/");

            // ✅ add new row
            aProducts.push({
                ProductID: "",
                ProductName: "",
                Quantity: 1,
                UnitPrice: 0,
                isNew: true,
                selected: false
            });

            // ✅ refresh model
            oModel.setProperty("/", aProducts);
            oTable.removeSelections(true);
        },
        
        onDeleteItem: function () {

            let oTable = this.byId("idProductsTable");
            let aSelectedItems = oTable.getSelectedItems();

            if (aSelectedItems.length === 0) {
                return;
            }

            let oModel = this.getView().getModel("orderProducts");
            let aProducts = oModel.getProperty("/");

            for (let i = aSelectedItems.length - 1; i >= 0; i--) {
                let oContext = aSelectedItems[i].getBindingContext("orderProducts");
                let iIndex = oContext.getPath().split("/")[1];
                aProducts.splice(iIndex, 1);
            }

            // ✅ important fix
            oModel.setProperty("/", []);
            oModel.setProperty("/", aProducts);

            oTable.removeSelections();
            oTable.getBinding("items").refresh();
        },


        onCalculateTotal: function (oEvent) {

            let oContext = oEvent.getSource().getBindingContext("orderProducts");

            let fQty = oContext.getProperty("Quantity");
            let fPrice = oContext.getProperty("UnitPrice");

            let fTotal = fQty * fPrice;

            oContext.getModel().setProperty(
                oContext.getPath() + "/TotalPrice",
                fTotal
            );
        },

        onPressSave: function () {  
            
            let oHistory = History.getInstance(); 
            let sPreviousHash = oHistory.getPreviousHash(); 
            let oRouter = this.getOwnerComponent().getRouter(); 

            let oLocal = this.getView().getModel("localOrders");
            let oProducts = this.getView().getModel("orderProducts");

            let aProducts = oProducts.getProperty("/");
            let iIndex = this._iOrderIndex;

            MessageBox.confirm(
                "Do you want to save changes?",
                {
                    title: "Confirm",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],

                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {

                            // ✅ save status (already bound to localOrders)
                            // ✅ save products
                            oLocal.setProperty("/" + iIndex + "/Order_Details", aProducts);

                            // Proceed with routing
                            if (sPreviousHash !== undefined) { 
                                window.history.go(-1); 
                            } else { 
                                oRouter.navTo("Detail", {}, true); 
                            } 
                        }
                    }
                }
            );

        },    

        onPressCancel: function () {

            let oHistory = History.getInstance(); 
            let sPreviousHash = oHistory.getPreviousHash(); 
            let oRouter = this.getOwnerComponent().getRouter(); 

            MessageBox.confirm(
                "Do you want to cancel editing? Unsaved changes will be lost.",
                {
                    title: "Confirm",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],

                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            // Proceed with routing
                            if (sPreviousHash !== undefined) { 
                                window.history.go(-1); 
                            } else { 
                                oRouter.navTo("Detail", {}, true); 
                            } 
                        }
                    }
                }
            );

        }

    });
});