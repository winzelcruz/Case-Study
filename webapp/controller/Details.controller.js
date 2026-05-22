sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("sapui5.group3.casestudy.controller.Details", {

        onInit: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteDetails").attachPatternMatched(this._onRouteMatched, this);
        },

_onRouteMatched: function (oEvent) {
    const sOrderNumber = oEvent.getParameter("arguments").OrderNumber;
    const oModel = this.getOwnerComponent().getModel("localOrders");
    
    console.log("OrderNumber:", sOrderNumber);
    console.log("Model:", oModel); // is this undefined?
    console.log("Data:", oModel ? oModel.getData() : "NO MODEL");
            const aOrders = oModel.getData();

            const iIndex = aOrders.findIndex(o => o.OrderNumber === sOrderNumber);

            if (iIndex !== -1) {
                this.getView().bindElement({
                    model: "localOrders",
                    path: "/" + iIndex
                });
            }
        },
        onCancel: function () {
            const oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("RouteMain");
        },
        onEdit: function () {
            var oOrderNumber = this.getView().byID("orderNumber")
            var oOrderNumValue = oOrderNumber.getTValue();
            oRouter.navTo("RouteEdit");

               this.getOwnerComponent().getRouter().navTo("RouteEdit", {
        OrderNumber: oOrderNumValue
    });
        }

    });
});