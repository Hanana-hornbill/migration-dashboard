sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (Controller, JSONModel, MessageToast) {

    "use strict";

    return Controller.extend("migrationdashboard.controller.App", {

        // =========================================
        // INITIALIZATION
        // =========================================

        onInit: function () {

            // -------------------------------------
            // CHECK SESSION
            // -------------------------------------
            const connectionModel =
                new JSONModel([]);

            this.getView().setModel(
                connectionModel,
                "connections"
            );
            this.loadConnections();
            const isLoggedIn =
                localStorage.getItem("isLoggedIn");

            // -------------------------------------
            // LOAD SAVED METRICS
            // -------------------------------------

            let savedMetrics = {

                users: 0,

                tables: 0,

                schemas: 0,

                memoryUsed: 0

            };
            const sqlModel =
                new JSONModel([]);

            this.getView().setModel(
                sqlModel,
                "sqlAnalysis"
            );
            const memoryConfigModel =
                new JSONModel([]);

            this.getView().setModel(

                memoryConfigModel,

                "memoryConfig"

            );
            const scaleOutModel =
                new JSONModel([]);

            this.getView().setModel(

                scaleOutModel,

                "scaleOutConfig"

            );
            const storedMetrics =
                localStorage.getItem("metricsData");

            if (storedMetrics) {

                savedMetrics =
                    JSON.parse(storedMetrics);

            }

            // -------------------------------------
            // CREATE MODEL
            // -------------------------------------

            const model = new JSONModel(
                savedMetrics
            );

            this.getView().setModel(
                model,
                "metrics"
            );

            // -------------------------------------
            // WELCOME MESSAGE
            // -------------------------------------

            if (isLoggedIn === "true") {

                MessageToast.show(
                    "Welcome Back"
                );

            }

            // -------------------------------------
            // DEFAULT PAGE
            // -------------------------------------

            this.byId("mainApp")
                .to(this.byId("homePage"));

        },
        loadConnections: async function () {

            try {

                const response =
                    await fetch("/connections");

                const result =
                    await response.json();

                if (result.success) {

                    this.getView()
                        .getModel("connections")
                        .setData(result.data);



                }

            } catch (err) {

                console.error(err);

            }

        },
        // =========================================
        // OPEN CONNECT PAGE
        // =========================================

        onOpenConnectPage: function () {

            this.byId("mainApp")
                .to(this.byId("connectPage"));

        },

        // =========================================
        // NAVIGATE BACK
        // =========================================

        onNavBack: function () {

            this.byId("mainApp")
                .back();

        },
        onConnectionSelect: async function (oEvent) {

            const item =
                oEvent.getSource();

            const data =

                item

                    .getBindingContext("connections")

                    .getObject();

            console.log(data);
            this.selectedConnectionId = data.ID;
            // =========================================
            // AUTO FILL INPUTS
            // =========================================

            this.byId("hostInput")
                .setValue(data.HOSTNAME);

            this.byId("portInput")
                .setValue(data.PORT);

            this.byId("userInput")
                .setValue(data.USERID);

            this.byId("passwordInput")
                .setValue(data.PASSWORD);

            // =========================================
            // RUN CONNECTION
            // =========================================

            await this.onConnect();

            // =========================================
            // NAVIGATE TO RESULTS PAGE
            // =========================================

            this.byId("mainApp")
                .to(this.byId("assessmentPage"));

        },
        onViewMemoryConfig: async function () {

            try {

                const response = await fetch(

                    `/memoryConfig/${this.selectedConnectionId}`

                );

                const result =
                    await response.json();

                if (result.success) {

                    this.getView()

                        .getModel("memoryConfig")

                        .setData(result.data);

                    this.byId("mainApp")

                        .to(this.byId("memoryConfigPage"));

                }

            } catch (err) {

                console.error(err);

            }

        },
        onViewScaleOutConfig: async function () {

            try {

                const response = await fetch(

                    `/scaleOutConfig/${this.selectedConnectionId}`

                );

                const result =
                    await response.json();

                if (result.success) {

                    this.getView()

                        .getModel("scaleOutConfig")

                        .setData(result.data);

                    this.byId("mainApp")

                        .to(this.byId("scaleOutConfigPage"));

                }

            } catch (err) {

                console.error(err);

            }

        },
        // =========================================
        // SIDEBAR NAVIGATION
        // =========================================

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

        // =========================================
        // LOGOUT
        // =========================================

        onLogout: function () {

            localStorage.clear();

            MessageToast.show("Logged Out");

        },

        // =========================================
        // CONNECT TO DATABASE
        // =========================================

        onConnect: async function () {

            // -------------------------------------
            // GET INPUT VALUES
            // -------------------------------------

            const host =
                this.byId("hostInput").getValue();

            const port =
                this.byId("portInput").getValue();

            const user =
                this.byId("userInput").getValue();

            const password =
                this.byId("passwordInput").getValue();

            try {

                // -------------------------------------
                // CALL BACKEND API
                // -------------------------------------

                const response = await fetch(

                    "/assessment",

                    {

                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body: JSON.stringify({

                            host,

                            port,

                            user,

                            password

                        })

                    }

                );

                const result =
                    await response.json();

                console.log(result);

                // -------------------------------------
                // SUCCESS
                // -------------------------------------

                if (result.success) {

                    // UPDATE DASHBOARD

                    this.getView()
                        .getModel("metrics")
                        .setData(result.data);

                    // SAVE SESSION

                    localStorage.setItem(
                        "isLoggedIn",
                        "true"
                    );

                    localStorage.setItem(
                        "dbUser",
                        user
                    );

                    localStorage.setItem(
                        "dbHost",
                        host
                    );

                    // SAVE METRICS

                    localStorage.setItem(

                        "metricsData",

                        JSON.stringify(result.data)

                    );
                    this.loadConnections();

                    this.byId("mainApp")
                        .to(this.byId("assessmentPage"));

                    MessageToast.show(
                        "Assessment Complete"
                    );

                }
                // -------------------------------------
                // BACKEND ERROR
                // -------------------------------------

                else {

                    MessageToast.show(
                        result.error
                    );

                }

            }

            // -----------------------------------------
            // NETWORK / SERVER ERROR
            // -----------------------------------------

            catch (err) {

                console.error(err);

                MessageToast.show(
                    "Connection Failed"
                );

            }

        },


        onViewRunHistory: async function () {

            // navigate and let RunHistory.controller load its data


            // Keep connection scoping (per current selected connection)
            const connectionId = this.selectedConnectionId;
            if (!connectionId) {
                MessageToast.show("Select a database connection first");
                return;
            }

            window.selectedConnectionId = connectionId;

            // Navigate to the separate run-history page
            this.byId("mainApp").to(this.byId("runHistoryXml"));


            // (Optional) trigger reload
            const runHistoryController = this.byId("runHistoryXml").getController?.();
            if (runHistoryController && runHistoryController._loadRunHistory) {
                runHistoryController.selectedConnectionId = connectionId;
                runHistoryController._loadRunHistory();
            }

        },

        _navToRunHistoryDetail: function (detailModel) {
            // attach the model to the detail view and show it
            const detailView = this.byId("runHistoryDetailXml");
            if (detailView && detailView.setModel) {
                detailView.setModel(detailModel, "runHistoryDetailModel");
            }
            this.byId("mainApp").to(detailView);
        },












        onViewSqlAnalysis: async function () {

            try {

                const response = await fetch(

                    `/sqlAnalysis/${this.selectedConnectionId}`

                );

                const result =
                    await response.json();

                if (result.success) {

                    this.getView()

                        .getModel("sqlAnalysis")

                        .setData(result.data);

                    this.byId("mainApp")

                        .to(this.byId("sqlAnalysisPage"));

                }

            } catch (err) {

                console.error(err);

            }

        },

    });

});