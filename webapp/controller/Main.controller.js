sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/ui/layout/form/SimpleForm",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/DatePicker",
    "sap/m/ComboBox",
    "sap/ui/core/Item"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, Dialog, Button, SimpleForm, Label, Input, DatePicker, ComboBox, Item) {
    "use strict";

    return Controller.extend("sapui5.group3.casestudy.controller.Main", {
        formatter: {
            statusState: function (sStatus) {
                switch (sStatus) {
                    case "Created": return "None";
                    case "Released": return "Warning";
                    case "Partially Completed": return "Information";
                    case "Delivered": return "Success";
                    default: return "None";
                }
            }
        },
        onInit: function () {
            var oODataModel = this.getOwnerComponent().getModel();
            this._fetchNorthwindOrders(oODataModel);
        },
        _fetchNorthwindOrders: function (oModel) {
            var oView = this.getView();
            var oTitle = this.byId("tableTitle");

            oModel.read("/Orders", {
                urlParameters: {
                    "$select": "OrderID,OrderDate,ShipName,ShipCountry",
                    "$top": 20
                },
                success: function (oData) {
                    var aMockStatuses = ["Created", "Released", "Partially Completed", "Delivered"];
                    var aFormattedOrders = oData.results.map(function (oOrder, idx) {
                        return {
                            OrderNumber: String(oOrder.OrderID),
                            CreationDate: oOrder.OrderDate,
                            ReceivingPlantCode: "9101",
                            ReceivingPlantName: "Singapore Branch " + oOrder.ShipName,
                            DeliveringPlantCode: "9102",
                            DeliveringPlantName: "Malaysia Storage " + oOrder.ShipCountry,
                            Status: aMockStatuses[idx % 4]
                        };
                    });

                    aFormattedOrders.sort(function (a, b) {
                        return parseInt(a.OrderNumber) - parseInt(b.OrderNumber);
                    });

                    var oLocalModel = new JSONModel(aFormattedOrders);
                    this.getOwnerComponent().setModel(oLocalModel, "localOrders"); 
                    oTitle.setText("Orders (" + aFormattedOrders.length + ")");
                }.bind(this),
                error: function (oError) {
                    MessageBox.error("Northwind Connection Failed.");
                }
            });
        },
        onSearch: function () {
            var aFilters = [];
            var sOrderNum = this.byId("filterOrderNumber").getValue();
            var oDateRange = this.byId("filterCreationDate");
            var aSelectedStatus = this.byId("filterStatus").getSelectedKeys();

            if (sOrderNum) {
                aFilters.push(new Filter("OrderNumber", FilterOperator.Contains, sOrderNum));
            }

            if (oDateRange.getDateValue() && oDateRange.getSecondDateValue()) {
                aFilters.push(new Filter("CreationDate", FilterOperator.BT, oDateRange.getDateValue(), oDateRange.getSecondDateValue()));
            }

            if (aSelectedStatus.length > 0) {
                var aStatusFilters = aSelectedStatus.map(function (sKey) {
                    return new Filter("Status", FilterOperator.EQ, sKey);
                });
                aFilters.push(new Filter({ filters: aStatusFilters, and: false }));
            }

            this.byId("ordersTable").getBinding("items").filter(aFilters);
            this._updateTableCount();
        },
        onClear: function () {
            this.byId("filterOrderNumber").setValue("");
            this.byId("filterCreationDate").setValue("");
            this.byId("filterStatus").setSelectedKeys([]);
            this.byId("ordersTable").getBinding("items").filter([]);
            this._updateTableCount();
        },
        onCreateOrder: function () {
            if (!this._pCreateDialog) {
                this._pCreateDialog = new Dialog({
                    title: "Create Product Order",
                    contentWidth: "400px",
                    content: new SimpleForm({
                        editable: true,
                        content: [
                            new Label({ text: "Order Number", required: true }),
                            new Input({ id: "newOrderNumber", placeholder: "e.g. 012205" }),

                            new Label({ text: "Creation Date", required: true }),
                            new DatePicker({ id: "newCreationDate", valueFormat: "yyyy-MM-dd", displayFormat: "dd MMM yyyy" }),

                            new Label({ text: "Receiving Plant Code", required: true }),
                            new Input({ id: "newRecPlant", value: "9101" }),

                            new Label({ text: "Delivering Plant Code", required: true }),
                            new Input({ id: "newDelPlant", value: "9102" }),

                            new Label({ text: "Status", required: true }),
                            new ComboBox({
                                id: "newStatus", selectedKey: "Created", items: [
                                    new Item({ key: "Created", text: "Created" }),
                                    new Item({ key: "Released", text: "Released" }),
                                    new Item({ key: "Partially Completed", text: "Partially Completed" }),
                                    new Item({ key: "Delivered", text: "Delivered" })
                                ]
                            })
                        ]
                    }),
                    beginButton: new Button({
                        text: "Save",
                        type: "Emphasized",
                        press: this._onSaveNewOrder.bind(this)
                    }),
                    endButton: new Button({
                        text: "Cancel",
                        press: function () {
                            this._pCreateDialog.close();
                        }.bind(this)
                    })
                });
                this.getView().addDependent(this._pCreateDialog);
            }
            this._pCreateDialog.open();
        },
        _onSaveNewOrder: function () {
            var sNum = sap.ui.getCore().byId("newOrderNumber").getValue();
            var sDate = sap.ui.getCore().byId("newCreationDate").getDateValue();
            var sRec = sap.ui.getCore().byId("newRecPlant").getValue();
            var sDel = sap.ui.getCore().byId("newDelPlant").getValue();
            var sStatus = sap.ui.getCore().byId("newStatus").getSelectedKey();

            if (!sNum || !sDate) {
                MessageBox.error("Please fill in all mandatory fields.");
                return;
            }

            var oModel = this.getView().getModel("localOrders");
            var aData = oModel.getData();

            aData.unshift({
                OrderNumber: sNum,
                CreationDate: sDate,
                ReceivingPlantCode: sRec,
                ReceivingPlantName: "Manual Office Entry",
                DeliveringPlantCode: sDel,
                DeliveringPlantName: "Distribution Center",
                Status: sStatus
            });

            oModel.refresh(true);
            this._updateTableCount();
            this._pCreateDialog.close();
            MessageToast.show("Order " + sNum + " created successfully.");
            sap.ui.getCore().byId("newOrderNumber").setValue("");
            sap.ui.getCore().byId("newCreationDate").setValue("");
        },
        onDeleteOrder: function () {
            var oTable = this.byId("ordersTable");
            var aSelectedItems = oTable.getSelectedItems();
            var iCount = aSelectedItems.length;

            if (iCount === 0) {
                MessageBox.error("Please select an item from the table.");
                return;
            }

            var sMsg = "Are you sure you want to delete <" + iCount + "> items?";
            MessageBox.confirm(sMsg, {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.YES) {
                        var oModel = this.getView().getModel("localOrders");
                        var aData = oModel.getData();

                        aSelectedItems.forEach(function (oItem) {
                            var sPath = oItem.getBindingContextPath();
                            var iIdx = parseInt(sPath.split("/")[2]); // Fix index splitting depth for model paths
                            aData.splice(iIdx, 1);
                        });

                        oModel.refresh(true);
                        oTable.removeSelections(true);
                        this._updateTableCount();
                        MessageToast.show("Selected items dropped successfully.");
                    }
                }.bind(this)
            });
        },
        _updateTableCount: function () {
            var oTable = this.byId("ordersTable");
            var iLength = oTable.getBinding("items").getLength();
            this.byId("tableTitle").setText("Orders (" + iLength + ")");
        },
onClickOrder: function(oEvent) {
    const oItem = oEvent.getSource();
    const oContext = oItem.getBindingContext("localOrders");
    const oOrder = oContext.getObject();

    MessageToast.show(oOrder.OrderNumber + " clicked!");

    this.getOwnerComponent().getRouter().navTo("RouteDetails", {
        OrderNumber: oOrder.OrderNumber
    });
}
    });
});