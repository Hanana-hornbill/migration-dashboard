sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {

    "use strict";

    return Controller.extend("demoproject.controller.Main", {

        onInit: function () {

            const app = this.byId("mainApp");

            app.to(this.createId("assessmentPage"));

        },

        onAssessmentPress: function () {

            const app = this.byId("mainApp");

            app.to(this.createId("assessmentPage"));

        }

    });

});