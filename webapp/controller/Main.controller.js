sap.ui.define([
    "sap/m/Button",
    "sap/m/ComboBox",
    "sap/m/DatePicker",
    "sap/m/Dialog",
    "sap/m/Input",
    "sap/m/Label",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Item",
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/ValueState",
    "sap/ui/layout/form/SimpleForm",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sapui5/group3/casestudy/model/Constants"
], function (Button, ComboBox, DatePicker, Dialog, Input, Label, MessageBox, MessageToast, Item, Controller, ValueState, SimpleForm, Filter, FilterOperator, JSONModel, Constants) {
    "use strict";

    return Controller.extend("sapui5.group3.casestudy.controller.Main", {
        formatter: {
            statusState: function (sStatus) {
                switch (sStatus) {
                    case Constants.STATUS.CREATED:
                        return ValueState.None;
                    case Constants.STATUS.RELEASED:
                        return ValueState.Warning;
                    case Constants.STATUS.PARTIAL:
                        return ValueState.Information;
                    case Constants.STATUS.DELIVERED:
                        return ValueState.Success;
                    default:
                        return ValueState.None;
                }
            }
        },
        onInit: function () {
            const oODataModel = this.getOwnerComponent().getModel();

            this._fetchNorthwindOrders(oODataModel);

            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteMain").attachPatternMatched(this._onRouteMatched, this);
        },
        _onRouteMatched: function (routeEvent) {
            const view = this.getView();
            view.unbindElement();

            const routeArgs = routeEvent.getParameter("arguments") || {};
            const orderNumberParam = routeArgs.OrderNumber || routeArgs.orderNumber;

            let localOrdersModel = this.getOwnerComponent().getModel("localOrders");
            if (!localOrdersModel) {
                return;
            }

            let aAllOrders = localOrdersModel.getProperty("/") || [];

            if (orderNumberParam && aAllOrders.length > 0) {
                const iIndex = aAllOrders.findIndex(order => String(order.OrderNumber) === String(orderNumberParam));

                if (iIndex >= 0) {
                    let oUpdatedItem = { ...aAllOrders[iIndex] };

                    oUpdatedItem.Status = Constants.STATUS.RELEASED;
                    aAllOrders[iIndex] = oUpdatedItem;
                    localOrdersModel.setProperty("/", aAllOrders);
                    localOrdersModel.refresh(true);

                    const oTable = this.byId("ordersTableId");
                    if (oTable) {
                        oTable.updateItems();
                    }
                }
            }
        },
        _fetchNorthwindOrders: function (oODataModel) {
            let oLocalOrdersModel = this.getOwnerComponent().getModel("localOrders");
            if (!oLocalOrdersModel) {
                oLocalOrdersModel = new JSONModel([]);
                this.getOwnerComponent().setModel(oLocalOrdersModel, "localOrders");
            }

            const aMockStatusList = [
                Constants.STATUS.CREATED,
                Constants.STATUS.RELEASED,
                Constants.STATUS.PARTIAL,
                Constants.STATUS.DELIVERED
            ];

            oODataModel.read("/Orders", {
                success: function (oData) {
                    const aRawItems = oData.results || [];

                    const aFormattedOrders = aRawItems.map(item => {
                        const orderIdAsNumber = Number(item.OrderID) || 0;
                        return {
                            OrderNumber: String(item.OrderID),
                            CreationDate: item.OrderDate,
                            ReceivingPlantCode: "9101",
                            ReceivingPlantName: "Singapore Branch " + (item.ShipName || ""),
                            DeliveringPlantCode: "9102",
                            DeliveringPlantName: "Malaysia Storage " + (item.ShipCountry || ""),
                            Status: aMockStatusList[orderIdAsNumber % aMockStatusList.length]
                        };
                    });

                    oLocalOrdersModel.setProperty("/", aFormattedOrders);
                    this.getView().setModel(oLocalOrdersModel, "localOrders");
                }.bind(this),
                error: function (oError) {
                    console.error("Northwind data fetch failed: ", oError);
                }
            });
        },
        onSearch: function () {
            const aFilters = [];
            const sOrderNum = this.byId("filterOrderNumberId").getValue();
            const oDateRange = this.byId("filterCreationDateId");
            const aSelectedStatus = this.byId("filterStatusId").getSelectedKeys();

            if (sOrderNum) {
                aFilters.push(new Filter("OrderNumber", FilterOperator.Contains, sOrderNum));
            }

            if (oDateRange.getDateValue() && oDateRange.getSecondDateValue()) {
                aFilters.push(new Filter("CreationDate", FilterOperator.BT, oDateRange.getDateValue(), oDateRange.getSecondDateValue()));
            }

            if (aSelectedStatus.length > 0) {
                const aStatusFilters = aSelectedStatus.map(function (sKey) {
                    return new Filter("Status", FilterOperator.EQ, sKey);
                });
                aFilters.push(new Filter({ filters: aStatusFilters, and: false }));
            }

            this.byId("ordersTableId").getBinding("items").filter(aFilters);
            this._updateTableCount();
        },
        onClear: function () {
            this.byId("filterOrderNumberId").setValue("");
            this.byId("filterCreationDateId").setValue("");
            this.byId("filterStatusId").setSelectedKeys([]);
            this.byId("ordersTableId").getBinding("items").filter([]);
            this._updateTableCount();
        },
        onCreateOrder: function () {
            const oView = this.getView();

            if (!this._pCreateDialog) {
                this._pCreateDialog = new Dialog({
                    title: "{i18n>titleCreateOrder}",
                    contentWidth: "400px",
                    content: new SimpleForm({
                        editable: true,
                        content: [
                            new Label({ text: "{i18n>lblOrderNumber}", required: true }),
                            new Input({
                                id: oView.createId("newOrderNumberId"),
                                placeholder: "{i18n>phOrderNumber}"
                            }),

                            new Label({ text: "{i18n>lblCreationDate}", required: true }),
                            new DatePicker({
                                id: oView.createId("newCreationDateId"),
                                valueFormat: "yyyy-MM-dd",
                                displayFormat: "dd MMM yyyy"
                            }),

                            new Label({ text: "{i18n>colReceivingPlant}", required: true }),
                            new Input({
                                id: oView.createId("newRecPlantId"),
                                value: "9101"
                            }),

                            new Label({ text: "{i18n>colDeliveringPlant}", required: true }),
                            new Input({
                                id: oView.createId("newDelPlantId"),
                                value: "9102"
                            }),

                            new Label({ text: "{i18n>colStatus}", required: true }),
                            new ComboBox({
                                id: oView.createId("newStatusId"),
                                selectedKey: "Created",
                                items: [
                                    new Item({ key: "Created", text: "{i18n>statusCreated}" }),
                                    new Item({ key: "Released", text: "{i18n>statusReleased}" }),
                                    new Item({ key: "Partially Completed", text: "{i18n>statusPartiallyCompleted}" }),
                                    new Item({ key: "Delivered", text: "{i18n>statusDelivered}" })
                                ]
                            })
                        ]
                    }),
                    beginButton: new Button({
                        text: "{i18n>btnSave}",
                        type: "Emphasized",
                        press: this._onSaveNewOrder.bind(this)
                    }),
                    endButton: new Button({
                        text: "{i18n>btnCancel}",
                        press: function () {
                            this._pCreateDialog.close();
                        }.bind(this)
                    })
                });
                oView.addDependent(this._pCreateDialog);
            }
            this._pCreateDialog.open();
        },
        _onSaveNewOrder: function () {
            const oNumControl = this.byId("newOrderNumberId");
            const oDateControl = this.byId("newCreationDateId");
            const oView = this.getView();
            const oModel = oView.getModel("localOrders");
            const aData = oModel.getData();
            const sNum = oNumControl.getValue();
            const sDate = oDateControl.getDateValue();
            const sRec = this.byId("newRecPlantId").getValue();
            const sDel = this.byId("newDelPlantId").getValue();
            const sStatus = this.byId("newStatusId").getSelectedKey();

            if (!sNum || !sDate) {
                MessageBox.error(oView.getModel("i18n").getResourceBundle().getText("msgMandatoryFields"));
                return;
            }

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
            // Success Message
            MessageToast.show(oView.getModel("i18n").getResourceBundle().getText("msgOrderCreatedSuccess", [sNum]));
            oNumControl.setValue("");
            oDateControl.setValue("");
            this.byId("newStatusId").setSelectedKey("Created");
        },
        onDeleteOrder: function () {
            const oTable = this.byId("ordersTableId");
            const oView = this.getView();
            const aSelectedItems = oTable.getSelectedItems();
            const iCount = aSelectedItems.length;

            if (iCount === 0) {
                MessageBox.error(oView.getModel("i18n").getResourceBundle().getText("msgNoSelection"));
                return;
            }

            const sMsg = oView.getModel("i18n").getResourceBundle().getText("msgDeleteConfirm", [iCount]);

            MessageBox.confirm(sMsg, {
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.YES) {
                        const oModel = oView.getModel("localOrders");
                        const aData = oModel.getData();

                        // 1. Get the actual objects to delete instead of just indexes
                        const aItemsToDelete = aSelectedItems.map(function (oItem) {
                            return oItem.getBindingContext("localOrders").getObject();
                        });

                        // 2. Filter the data array to remove those objects
                        const aNewData = aData.filter(function (oDataObj) {
                            return !aItemsToDelete.includes(oDataObj);
                        });

                        // 3. Update model and UI
                        oModel.setData(aNewData);
                        oTable.removeSelections(true);
                        this._updateTableCount();
                        MessageBox.success(oView.getModel("i18n").getResourceBundle().getText("msgDeleteSuccess"));
                    }
                }.bind(this)
            });
        },
        _updateTableCount: function () {
            var oTable = this.byId("ordersTableId");
            var iLength = oTable.getBinding("items").getLength();

            this.byId("tableTitleId").setText("Orders (" + iLength + ")");
        },

        onClickOrder: function (oEvent) {
            const oItem = oEvent.getSource();
            const oContext = oItem.getBindingContext("localOrders");
            const oOrder = oContext.getObject();


            this.getOwnerComponent().getRouter().navTo("RouteDetails", {
                OrderNumber: oOrder.OrderNumber
            });
        }
    });
});