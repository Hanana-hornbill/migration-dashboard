require('dotenv').config();
const cds = require('@sap/cds');
const express = require('express');
const hana = require('@sap/hana-client');


cds.on('bootstrap', (app) => {

    app.use(express.json());

    // =====================================================
    // APP DATABASE CONNECTION CONFIGURATION
    // =====================================================

    const APP_DB_CONFIG = {

        serverNode:`${process.env.APP_DB_HOST}:${process.env.APP_DB_PORT}`,

        uid:
            process.env.APP_DB_USER,

        pwd:
            process.env.APP_DB_PASSWORD

    };

    // =====================================================
    // ASSESSMENT API
    // =====================================================

    app.post('/assessment', (req, res) => {

        // -------------------------------------------------
        // USER INPUT
        // -------------------------------------------------

        const { host, port, user, password } = req.body;

        // -------------------------------------------------
        // TARGET DATABASE CONNECTION
        // -------------------------------------------------

        const conn = hana.createConnection();

        // -------------------------------------------------
        // APPLICATION DATABASE CONNECTION
        // -------------------------------------------------

        const appConn = hana.createConnection();

        try {

            // =================================================
            // CONNECT TO TARGET DATABASE
            // =================================================

            conn.connect({

                serverNode: `${host}:${port}`,

                uid: user,

                pwd: password

            });

            const results = {};

            // =================================================
            // USERS COUNT
            // =================================================

            conn.exec(

                "SELECT COUNT(*) AS USERS FROM USERS",

                (err, userResult) => {

                    if (err) {

                        return res.status(500).json({

                            success: false,

                            error: err.message

                        });

                    }

                    results.users =
                        userResult?.[0]?.USERS || 0;

                    // =============================================
                    // TABLE COUNT
                    // =============================================

                    conn.exec(

                        "SELECT COUNT(*) AS TABLES FROM TABLES",

                        (err, tableResult) => {

                            if (err) {

                                return res.status(500).json({

                                    success: false,

                                    error: err.message

                                });

                            }

                            results.tables =
                                tableResult?.[0]?.TABLES || 0;

                            // =========================================
                            // SCHEMA COUNT
                            // =========================================

                            conn.exec(

                                "SELECT COUNT(*) AS SCHEMAS FROM SCHEMAS",

                                (err, schemaResult) => {

                                    if (err) {

                                        return res.status(500).json({

                                            success: false,

                                            error: err.message

                                        });

                                    }

                                    results.schemas =
                                        schemaResult?.[0]?.SCHEMAS || 0;

                                    // =====================================
                                    // CONNECT TO APP DATABASE
                                    // =====================================

                                    appConn.connect(
                                        APP_DB_CONFIG
                                    );

                                    // =====================================
                                    // CHECK IF CONNECTION EXISTS
                                    // =====================================

                                    const checkQuery = `
                                        SELECT COUNT(*) AS COUNT
                                        FROM MIGRATION_APP.SAVED_CONNECTIONS
                                        WHERE HOSTNAME = ?
                                        AND PORT = ?
                                    `;

                                    appConn.prepare(

                                        checkQuery,

                                        (err, checkStmt) => {

                                            if (err) {

                                                return res.status(500).json({

                                                    success: false,

                                                    error: err.message

                                                });

                                            }

                                            checkStmt.exec(

                                                [host, port],

                                                (err, checkResult) => {

                                                    if (err) {

                                                        return res.status(500).json({

                                                            success: false,

                                                            error: err.message

                                                        });

                                                    }

                                                    const exists =
                                                        checkResult?.[0]?.COUNT > 0;

                                                    // =================================
                                                    // UPDATE EXISTING CONNECTION
                                                    // =================================

                                                    if (exists) {

                                                        const updateQuery = `
                                                            UPDATE MIGRATION_APP.SAVED_CONNECTIONS
                                                            SET
                                                                USERID = ?,
                                                                PASSWORD = ?,
                                                                STATUS = ?,
                                                                LAST_ASSESSMENT = CURRENT_TIMESTAMP
                                                            WHERE HOSTNAME = ?
                                                            AND PORT = ?
                                                        `;

                                                        appConn.prepare(

                                                            updateQuery,

                                                            (err, updateStmt) => {

                                                                if (err) {

                                                                    return res.status(500).json({

                                                                        success: false,

                                                                        error: err.message

                                                                    });

                                                                }

                                                                updateStmt.exec(

                                                                    [

                                                                        user,

                                                                        password,

                                                                        "CONNECTED",

                                                                        host,

                                                                        port

                                                                    ],

                                                                    (err) => {

                                                                        if (err) {

                                                                            return res.status(500).json({

                                                                                success: false,

                                                                                error: err.message

                                                                            });

                                                                        }

                                                                        res.json({

                                                                            success: true,

                                                                            data: results

                                                                        });

                                                                    }

                                                                );

                                                            }

                                                        );

                                                    }

                                                    // =================================
                                                    // INSERT NEW CONNECTION
                                                    // =================================

                                                    else {

                                                        const insertQuery = `
                                                            INSERT INTO MIGRATION_APP.SAVED_CONNECTIONS
                                                            (
                                                                INSTANCE_NAME,
                                                                HOSTNAME,
                                                                PORT,
                                                                USERID,
                                                                PASSWORD,
                                                                DBTYPE,
                                                                STATUS,
                                                                LAST_ASSESSMENT
                                                            )
                                                            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                                                        `;

                                                        const values = [

                                                            "HANA-PROD",

                                                            host,

                                                            port,

                                                            user,

                                                            password,

                                                            "SAP HANA Cloud",

                                                            "CONNECTED"

                                                        ];

                                                        appConn.prepare(

                                                            insertQuery,

                                                            (err, insertStmt) => {

                                                                if (err) {

                                                                    return res.status(500).json({

                                                                        success: false,

                                                                        error: err.message

                                                                    });

                                                                }

                                                                insertStmt.exec(

                                                                    values,

                                                                    (err) => {

                                                                        if (err) {

                                                                            return res.status(500).json({

                                                                                success: false,

                                                                                error: err.message

                                                                            });

                                                                        }

                                                                        res.json({

                                                                            success: true,

                                                                            data: results

                                                                        });

                                                                    }

                                                                );

                                                            }

                                                        );

                                                    }

                                                }

                                            );

                                        }

                                    );

                                }

                            );

                        }

                    );

                }

            );

        } catch (e) {

            res.status(500).json({

                success: false,

                error: e.message

            });

        }

    });

    // =====================================================
    // FETCH SAVED CONNECTIONS
    // =====================================================

    app.get('/connections', (req, res) => {

        const appConn = hana.createConnection();

        try {

            appConn.connect(APP_DB_CONFIG);

            appConn.exec(

                `
                SELECT *
                FROM MIGRATION_APP.SAVED_CONNECTIONS
                ORDER BY LAST_ASSESSMENT DESC
                `,

                (err, result) => {

                    if (err) {

                        return res.status(500).json({

                            success: false,

                            error: err.message

                        });

                    }

                    res.json({

                        success: true,

                        data: result

                    });

                }

            );

        } catch (e) {

            res.status(500).json({

                success: false,

                error: e.message

            });

        }

    });

});

module.exports = cds.server;