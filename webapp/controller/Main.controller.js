sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("sapui5.casestudy.casestudy.controller.Main", {
        onInit() {
        },
        onPressGoToDetails() {
             var oRouter = this.getOwnerComponent().getRouter();
          oRouter.navTo("RouteDetails");
        }
    });
});