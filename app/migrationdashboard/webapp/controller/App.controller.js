sap.ui.define([

    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/core/BusyIndicator",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/List",
    "sap/m/StandardListItem"

], function (

    Controller,
    JSONModel,
    MessageToast,
    BusyIndicator,
    MessageBox,
    Dialog,
    Button,
    List,
    StandardListItem

) {

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

                dbSize: 0

            };

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
                .to(this.byId("assessmentPage"));

        },
onStartAnalysis: function () {

    // =========================================
    // GET CONNECTION MODEL
    // =========================================

    const oModel =
        this.getView().getModel("connections");

    // =========================================
    // GET DATA
    // =========================================

    const aData =
        oModel.getData();

    console.log("Connections:", aData);

    // =========================================
    // VALIDATION
    // =========================================

    if (!aData || aData.length === 0) {

        sap.m.MessageToast.show(
            "No saved databases found"
        );

        return;

    }

    // =========================================
    // CREATE LIST
    // =========================================

    const oList = new sap.m.List({

        mode: "MultiSelect",

        includeItemInSelection: true,

        width: "100%"

    });

    // =========================================
    // SET MODEL
    // =========================================

    oList.setModel(
        oModel,
        "connections"
    );

    // =========================================
    // BIND ITEMS
    // =========================================

    oList.bindAggregation(

        "items",

        {

            path: "connections>/",

            template: new sap.m.StandardListItem({

                title:
                    "{connections>INSTANCE_NAME}",

                description:
                    "{connections>HOSTNAME}",

                info:
                    "{connections>STATUS}",

                icon:
                    "sap-icon://database"

            })

        }

    );

    // =========================================
    // CREATE DIALOG
    // =========================================

    const oDialog = new sap.m.Dialog({

        title: "Start Analysis",

        contentWidth: "600px",

        contentHeight: "400px",

        draggable: true,

        resizable: true,

        content: [oList],

        beginButton: new sap.m.Button({

            text: "Start",

            type: "Emphasized",

            press: async () => {

                const aSelected =
                    oList.getSelectedItems();

                if (aSelected.length === 0) {

                    sap.m.MessageToast.show(
                        "Select at least one database"
                    );

                    return;

                }

                sap.ui.core.BusyIndicator.show(0);

                try {

                    for (const item of aSelected) {

                        const oData =
                            item
                                .getBindingContext("connections")
                                .getObject();

                        console.log("Selected DB:", oData);

                        const response =
                            await fetch(

                                "/start-analysis",

                                {

                                    method: "POST",

                                    headers: {

                                        "Content-Type":
                                            "application/json"

                                    },

                                    body: JSON.stringify({

                                        host:
                                            oData.HOSTNAME,

                                        port:
                                            oData.PORT,

                                        user:
                                            oData.USERID,

                                        password:
                                            oData.PASSWORD

                                    })

                                }

                            );

                        const result =
                            await response.json();

                        console.log(result);

                    }

                    sap.m.MessageBox.success(
                        "Analysis completed"
                    );

                } catch (err) {

                    console.error(err);

                    sap.m.MessageBox.error(
                        "Analysis failed"
                    );

                }

                sap.ui.core.BusyIndicator.hide();

                oDialog.close();

            }

        }),

        endButton: new sap.m.Button({

            text: "Cancel",

            press: function () {

                oDialog.close();

            }

        }),

        afterClose: function () {

            oDialog.destroy();

        }

    });

    // =========================================
    // OPEN DIALOG
    // =========================================

    oDialog.open();

},
 loadConnections: async function () {

    try {

        const response =
            await fetch("/connections");

        const result =
            await response.json();

        console.log(result);

        if (result.success) {

            this.getView()
                .getModel("connections")
                .setData(result.data);

        }

    } catch (err) {

        console.error(err);

    }

},
        onOpenConnectPage: function () {

            this.byId("mainApp")
                .to(this.byId("connectPage"));

        },
        onOpenSavedConnections: function () {

            this.loadConnections();

            this.byId("mainApp")
                .to(this.byId("savedConnectionsPage"));

        },
        onNavBack: function () {

            this.byId("mainApp")
                .back();

        },
        onConnectionSelect: function (oEvent) {

            const item =
                oEvent.getSource();

            const data =
                item.getBindingContext(
                    "connections"
                ).getObject();

            console.log(data);

            // ---------------------------------
            // AUTO-FILL INPUTS
            // ---------------------------------

            this.byId("hostInput")
                .setValue(data.HOSTNAME);

            this.byId("portInput")
                .setValue(data.PORT);

            this.byId("userInput")
                .setValue(data.USERID);

            this.byId("passwordInput")
                .setValue(data.PASSWORD);

            // ---------------------------------
            // OPTIONAL AUTO CONNECT
            // ---------------------------------

            this.onConnect();
            this.byId("mainApp")
                .to(this.byId("assessmentPage"));

        },
        // =========================================
        // SIDEBAR NAVIGATION
        // =========================================

        onAssessmentPress: function () {

            this.byId("mainApp")
                .to(this.byId("homePage"));

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
                    this.byId("mainApp")
                        .to(this.byId("assessmentPage"));
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

        }

    });

});