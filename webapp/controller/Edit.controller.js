sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "sapui5/group3/casestudy/model/Constants"
], (Controller, History, MessageBox, JSONModel, Constants) => {
    "use strict";

    return Controller.extend("sapui5.group3.casestudy.controller.Edit", {

        formatter: {

            //get Products count for header title based on onload or add/delete actions
            getProductTitle: function (aProducts, sText) {

                let iCount = 0;

                if (aProducts !== null && aProducts !== undefined) {
                    iCount = aProducts.length;
                }

                if (sText !== null && sText !== undefined) {
                    return sText.replace("{0}", iCount);
                }

                return "Products (" + iCount + ")";

            },

            //format number with 2 decimals for UnitPrice in table column
            to2: function (value) {
                const cleaned = String(value ?? 0)
                    .replace(/,/g, "")
                    .replace(/[^\d.-]/g, "");

                const parsed = parseFloat(cleaned);
                return (isNaN(parsed) ? 0 : parsed).toFixed(2);
            },

            //calculate total based on quantity and unit price with 2 decimals formatting
            calcTotal: function (quantity, unitPrice) {
                const total = (Number(quantity) || 0) * (Number(unitPrice) || 0);
                return new Intl.NumberFormat("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(total);
            },

        },

        onInit() {
            //initiate binding router        
            let oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteEdit").attachPatternMatched(this._onObjectMatched, this);

            //initiate constants
            this.getView().setModel(new JSONModel(Constants), "Constants");
        },

        _onObjectMatched: function (oEvent) {

            this.getView().setBusy(true);

            let sOrderNumber = oEvent.getParameter("arguments").OrderNumber;
            let oModel = this.getOwnerComponent().getModel("localOrders");
            this.getView().setModel(oModel, "localOrders");

            //attach model to view
            this.getView().setModel(oModel, "localOrders");

            let aOrders = oModel.getProperty("/");
            let iIndex = aOrders.findIndex(o =>
                String(o.OrderNumber) === String(sOrderNumber)
            );

            this._iOrderIndex = iIndex;

            //bind using FULL model path
            this.getView().bindElement({
                path: "localOrders>/" + iIndex
            });

            //load Products with Supplier for mapping UnitPrice and ProductName in details 
            this.getView().getModel().read("/Products", {
                urlParameters: { "$expand": "Supplier" },
                success: function (oData) {
                    this._aProducts = oData.results || [];
                }.bind(this)
            });

            // metadata: Order>Order Details>Product (to get Product Name in one call)
            // first check if there are already local changes (products added/deleted) to show in edit page, if not load from OData
            let bEdited = oModel.getProperty("/" + iIndex + "/_edited");
            let aExisting = oModel.getProperty("/" + iIndex + "/Order_Details");

            if (bEdited === true) {

                // Use saved data
                this.getView().setModel(
                    new JSONModel(aExisting),
                    "orderProducts"
                );

                this.getView().setBusy(false); 

            } else {

                // only load from OData first time
                this.getView().getModel().read("/Orders(" + sOrderNumber + ")", {
                    urlParameters: {
                        "$expand": "Order_Details/Product"
                    },
                    success: function (oData) {

                        let aDetails = oData.Order_Details.results;

                        aDetails.forEach(function (item) {

                            let oProduct = this._aProducts.find(function (prod) {
                                return String(prod.ProductID) === String(item.ProductID);
                            });

                            if (oProduct !== undefined && oProduct !== null) {
                                item.ProductName = oProduct.ProductName;
                                item.UnitPrice = oProduct.UnitPrice;
                            }

                        }.bind(this));

                        this.getView().setModel(
                            new JSONModel(aDetails),
                            "orderProducts"
                        );

                        this.getView().setBusy(false); 

                    }.bind(this)
                });

            }

        },

        // Handler for Add button to open dialog
        onAddItem: function () {
            this._openProductDialog();
        },

        // Open dialog to select product and quantity
        _openProductDialog: function () {

            if (!this._oDialog) {
                this._oDialog = new sap.m.Dialog({
                    title: "Add Product",
                    content: [
                        new sap.ui.layout.form.SimpleForm({
                            editable: true,
                            layout: "ResponsiveGridLayout",
                            content: [

                                new sap.m.Label({ text: "Product" }),
                                new sap.m.ComboBox({
                                    id: this.createId("productSelect"),
                                    width: "100%",
                                    items: {
                                        path: "products>/",
                                        template: new sap.ui.core.Item({
                                            key: "{products>ProductID}",
                                            text: "{products>ProductName}"
                                        })
                                    }
                                }),

                                new sap.m.Label({ text: "Quantity" }),
                                new sap.m.Input({
                                    id: this.createId("qtyInput"),
                                    type: "Number",
                                    width: "100%",
                                    placeholder: "Enter quantity"
                                })

                            ]
                        })
                    ],
                    beginButton: new sap.m.Button({
                        text: "Add",
                        press: this._onAddProductConfirm.bind(this)
                    }),
                    endButton: new sap.m.Button({
                        text: "Cancel",
                        press: function () {
                            this._oDialog.close();
                        }.bind(this)
                    })
                });

                this.getView().addDependent(this._oDialog);
            }

            // get Delivering Plant string (example: "9102 - Malaysia Storage Brazil")
            let sDelPlant = this.getView().getBindingContext("localOrders").getProperty("DeliveringPlantCode") || "";

            // extract plant code "9102" from the string
            let sPlantCode = sDelPlant.substring(0, 4);

            // map plant code to supplier ID (example: "9101" -> "1", "9102" -> "2")
            let sSupplierId = "";
            if (sPlantCode === "9101") { sSupplierId = "1"; }
            if (sPlantCode === "9102") { sSupplierId = "2"; }
            else {
                MessageBox.error("Unknown Plant Code: " + sPlantCode + ". Cannot determine SupplierID for product filtering.");
                return;
            };

            let aFilteredProducts = [];
            let aAll = this._aProducts || [];

            // filter products by SupplierID 
            for (let i = 0; i < aAll.length; i++) {
                let p = aAll[i];
                if (p.Supplier && p.Supplier.SupplierID == sSupplierId) {
                    aFilteredProducts.push(p);
                }
            }

            // bind filtered list to ComboBox model used by dialog
            this.getView().setModel(new JSONModel(aFilteredProducts), "products");

            // reset dialog fields
            this.byId("productSelect").setSelectedKey("");
            this.byId("qtyInput").setValue("");

            // open dialog
            this._oDialog.open();
        },

        // Handler for add product confirmation in dialog
        _onAddProductConfirm: function () {

            let oModel = this.getView().getModel("orderProducts");
            let aProducts = oModel.getProperty("/");

            let oCombo = this.byId("productSelect");
            let oSelectedItem = oCombo.getSelectedItem();

            // product validation
            if (oSelectedItem === null || oSelectedItem === undefined) {
                MessageBox.error("Please select a product");
                return;
            }

            let sProductId = oCombo.getSelectedKey();
            let sProductName = oSelectedItem.getText();

            // quantity validation
            let iQty = Number(this.byId("qtyInput").getValue());

            if (iQty === 0 || iQty < 0) {
                MessageBox.error("Please enter a valid quantity");
                return;
            }

            let bExists = false;

            // duplicate check; do not allow duplicate products in the table 
            for (let i = 0; i < aProducts.length; i++) {
                if (String(aProducts[i].ProductID) === String(sProductId)) {
                    bExists = true;
                    break;
                }
            }

            if (bExists === true) {
                MessageBox.error("This product is already added.");
                return;
            }

            let aAllProducts = this._aProducts || [];
            let oSelectedProduct = null;

            //populate product name for combo selection based on product ID 
            for (let i = 0; i < aAllProducts.length; i++) {
                if (String(aAllProducts[i].ProductID) === String(sProductId)) {
                    oSelectedProduct = aAllProducts[i];
                    break;
                }
            }

            let fUnitPrice = 0;

            // map UnitPrice from selected product (example: "Laptop" -> 1000)
            if (oSelectedProduct !== null && oSelectedProduct !== undefined) {
                if (oSelectedProduct.UnitPrice !== undefined) {
                    fUnitPrice = oSelectedProduct.UnitPrice;
                }
            }

            // add item (NO persistence yet)
            aProducts.push({
                ProductID: sProductId,
                Product: {
                    ProductName: sProductName
                },
                Quantity: iQty,
                UnitPrice: fUnitPrice
            });

            oModel.refresh(true);

            this._oDialog.close();
        },

        //delete selected item from table
        onDeleteItem: function () {

            let oTable = this.byId("idProductsTable");
            let aSelectedItems = oTable.getSelectedItems();

            // validation - check if at least one item is selected
            if (aSelectedItems.length === 0) {
                MessageBox.error("Please select an item from the table");
                return;
            }

            let oModel = this.getView().getModel("orderProducts");
            let aProducts = oModel.getProperty("/");

            // get objects to delete
            let aItemsToDelete = aSelectedItems.map(function (oItem) {
                return oItem.getBindingContext("orderProducts").getObject();
            });

            // filter remaining items (no index used)
            let aNewProducts = aProducts.filter(function (oProduct) {
                return aItemsToDelete.every(function (oItem) {
                    return oItem !== oProduct;
                });
            });

            // update ONLY the working model (not persistent yet)
            oModel.setProperty("/", aNewProducts);

            // clear selection
            oTable.removeSelections(true);
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

            let sOrderNumber = this.getView().getBindingContext("localOrders").getProperty("OrderNumber");

            MessageBox.confirm(
                "Are you sure you want to Save these changes?",
                {
                    title: "Confirm",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],

                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {

                            //update products in local model
                            oLocal.setProperty("/" + iIndex + "/Order_Details", aProducts);

                            //set edited flag to true to identify changes in detail page 
                            // (since we are not persisting, this is needed to trigger the update in details page)
                            oLocal.setProperty("/" + iIndex + "/_edited", true);

                            //show success MessageBox
                            MessageBox.success(
                                "The Order " + sOrderNumber + " has been successfully updated.",
                                {
                                    title: "Success",
                                    actions: [MessageBox.Action.OK],
                                    onClose: function () {

                                        //navigate ONLY after OK
                                        if (sPreviousHash !== undefined) {
                                            window.history.go(-1);
                                        } else {
                                            oRouter.navTo("Detail", {}, true);
                                        }

                                    }
                                }
                            );
                        }
                    }
                }
            );

        },

        // Go back to detail page without saving changes
        onPressCancel: function () {

            let oHistory = History.getInstance();
            let sPreviousHash = oHistory.getPreviousHash();
            let oRouter = this.getOwnerComponent().getRouter();

            MessageBox.confirm(
                "Are you sure you want to cancel the changes done in the page?",
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