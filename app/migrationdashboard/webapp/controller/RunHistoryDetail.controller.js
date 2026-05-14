sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast"
], function (Controller, JSONModel, MessageToast) {
  "use strict";

  return Controller.extend("migrationdashboard.controller.RunHistoryDetail", {
    onInit: function () {
      // model is injected by parent controller navigation
    },

    onNavBack: function () {
      const oApp = this.getView().getParent();
      if (oApp && oApp.back) {
        oApp.back();
      }
    }
  });
});

