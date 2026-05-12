const cds = require('@sap/cds');
const express = require('express');
const hana = require('@sap/hana-client');

cds.on('bootstrap', (app) => {

    app.use(express.json());

    app.post('/assessment', (req, res) => {

        const { host, port, user, password } = req.body;

        const conn = hana.createConnection();

        try {

            conn.connect({
                serverNode: `${host}:${port}`,
                uid: user,
                pwd: password
            });

            const results = {};

            conn.exec(
                "SELECT COUNT(*) AS USERS FROM USERS",
                (err, userResult) => {

                    results.users =
                        userResult?.[0]?.USERS || 0;

                    conn.exec(
                        "SELECT COUNT(*) AS TABLES FROM TABLES",
                        (err, tableResult) => {

                            results.tables =
                                tableResult?.[0]?.TABLES || 0;

                            conn.exec(
                                "SELECT COUNT(*) AS SCHEMAS FROM SCHEMAS",
                                (err, schemaResult) => {

                                    results.schemas =
                                        schemaResult?.[0]?.SCHEMAS || 0;

                                    results.dbSize = "Connected";

                                    res.json({
                                        success: true,
                                        data: results
                                    });

                                });

                        });

                });

        } catch (e) {

            res.status(500).json({
                success: false,
                error: e.message
            });

        }

    });

});

module.exports = cds.server;