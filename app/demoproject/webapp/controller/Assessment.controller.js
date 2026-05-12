sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (Controller, JSONModel, MessageToast) {

    "use strict";

    return Controller.extend("demoproject.controller.Assessment", {

        onInit: function () {

            const metricsModel = new JSONModel({
                users: 0,
                tables: 0,
                schemas: 0
            });

            this.getView().setModel(metricsModel, "metrics");

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

                if (result.success) {

                    this.getView()
                        .getModel("metrics")
                        .setData(result.data);

                    MessageToast.show("Assessment Complete");

                } else {

                    MessageToast.show(result.error);

                }

            } catch (err) {

                MessageToast.show("Connection Failed");

            }

        }

    });

});