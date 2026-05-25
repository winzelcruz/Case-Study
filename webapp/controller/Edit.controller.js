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

            // show Text field on Products table when NOT new entry/add button pressed
            showText: function(isNew) {
                return !isNew;   
            },

            // show Input on Products table when new/add button pressed
            showInput: function(isNew) {
                return isNew;    
            },

            //get Products count for header title based on on load or add/delete actions
            getProductTitle: function (aProducts, sText) {

                let iCount = 0;

                if (aProducts !== null && aProducts !== undefined) {
                    iCount = aProducts.length;
                }

                if (sText !== null && sText !== undefined) {
                    return sText.replace("{0}", iCount);
                }

                return "Products (" + iCount + ")";

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

            //attach model to view
            this.getView().setModel(oModel, "localOrders");

            let aOrders = oModel.getProperty("/");
            let iIndex = aOrders.findIndex(o => 
                String(o.OrderNumber) === String(sOrderNumber)
            );

            //bind using FULL model path
            this.getView().bindElement({
                path: "localOrders>/" + iIndex
            });

            //load Products
            this.getView().getModel().read("/Products", {
                success: function (oData) {
                    this._aProducts = oData.results; // store for mapping
                    console.log("Products loaded", this._aProducts);
                }.bind(this)
            });

            // metadata: Order>Order Details>Product (to get Product Name in one call)
            // this is used because Product Name is not stored in localOrders and we want to avoid multiple calls for each product
            this.getView().getModel().read("/Orders(" + sOrderNumber + ")", {
                urlParameters: {
                    "$expand": "Order_Details/Product"
                },
                success: function (oData) {

                    let aDetails = oData.Order_Details.results;

                    //Map ProductName
                    aDetails.forEach(function(item) {

                        // find product from cached products list
                        let oProduct = this._aProducts.find(function(prod) {
                            return String(prod.ProductID) === String(item.ProductID);
                        });

                        if (oProduct !== undefined && oProduct !== null) {
                            item.ProductName = oProduct.ProductName;
                            item.UnitPrice = oProduct.UnitPrice;
                        }

                        // add isNew flag for UI control (show Text or Input)
                        item.isNew = false;

                    }.bind(this));

                    // bind to separate model for products to avoid confusion with order header data
                    this.getView().setModel(
                        new sap.ui.model.json.JSONModel(aDetails),
                        "orderProducts"
                    );

                    console.log(aDetails);

                }.bind(this)
            });

        },   

        onAddItem: function () {

            //Get model and table references
            let oModel = this.getView().getModel("orderProducts");
            let oTable = this.byId("idProductsTable");

            //Get array directly
            let aProducts = oModel.getProperty("/");

            //Add new row
            aProducts.push({
                ProductID: "",
                Product: {
                    ProductName: ""
                },
                Quantity: 1,
                UnitPrice: 0,
                isNew: true,
                selected: false
            });

            //oModel.setProperty("/", aProducts);
            //Refresh UI and clear selection
            oTable.getBinding("items").refresh();
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
            //oModel.setProperty("/", []);
            //oModel.setProperty("/", aProducts);
            
            //Refresh UI and clear selection
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

        //Save changes to local model and navigate back to detail page
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

                            // assign new IDs to new items (mock logic since we don't have a backend)           
                            let iMaxId = 0;

                            // find highest ProductID
                            aProducts.forEach(function(item) {
                                let iId = Number(item.ProductID);

                                if (iId > iMaxId) {
                                    iMaxId = iId;
                                }
                            });

                            // assign new ID to new items
                            aProducts.forEach(function(item) {
                                if (item.isNew === true) {
                                    iMaxId = iMaxId + 1;
                                    item.ProductID = iMaxId;
                                }
                            });

                            // update products in local model
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