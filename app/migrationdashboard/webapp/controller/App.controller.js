sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (Controller, JSONModel, MessageToast) {

    "use strict";

    return Controller.extend("migrationdashboard.controller.App", {

        onInit: function () {

            const model = new JSONModel({
                users: 0,
                tables: 0,
                schemas: 0,
                dbSize: 0
            });

            this.getView().setModel(model, "metrics");
            this.byId("mainApp")
    .to(this.byId("assessmentPage"));

        },
        onAssessmentPress: function () {

    this.byId("mainApp")
        .to(this.byId("assessmentPage"));

},

onPreMigrationPress: function () {

    this.byId("mainApp")
        .to(this.byId("preMigrationPage"));

},

onMigrationPress: function () {

    this.byId("mainApp")
        .to(this.byId("migrationPage"));

},

onValidationPress: function () {

    this.byId("mainApp")
        .to(this.byId("validationPage"));

},

        onConnect: async function () {

    const host = this.byId("hostInput").getValue();
    const port = this.byId("portInput").getValue();
    const user = this.byId("userInput").getValue();
    const password = this.byId("passwordInput").getValue();

    try {

        const response = await fetch("/assessment", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                host,
                port,
                user,
                password
            })

        });

        const result = await response.json();

        console.log(result);

        if (result.success) {

            this.getView()
                .getModel("metrics")
                .setData(result.data);

            sap.m.MessageToast.show("Assessment Complete");

        } else {

            sap.m.MessageToast.show(result.error);

        }

    } catch (err) {

        console.error(err);

        sap.m.MessageToast.show("Connection Failed");

    }

}

    });

});