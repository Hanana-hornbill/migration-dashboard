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
        serverNode: `${process.env.APP_DB_HOST}:${process.env.APP_DB_PORT}`,

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

    // =====================================================
// START ANALYSIS API
// =====================================================

app.post('/start-analysis', (req, res) => {

    // -------------------------------------------------
    // GET SELECTED DATABASE INFO
    // -------------------------------------------------

    const {
        host,
        port,
        user,
        password
    } = req.body;

    // -------------------------------------------------
    // TARGET DATABASE CONNECTION
    // -------------------------------------------------

    const targetConn = hana.createConnection();

    // -------------------------------------------------
    // APP DATABASE CONNECTION
    // -------------------------------------------------

    const appConn = hana.createConnection();

    try {

        // =============================================
        // CONNECT TO SELECTED CUSTOMER DATABASE
        // =============================================

        targetConn.connect({

            serverNode: `${host}:${port}`,

            uid: user,

            pwd: password

        });

        // =============================================
        // QUERY LIST
        // =============================================

        const queries = [

            {

                queryNumber: 1,

                queryName:
                    "System Memory Analysis",

                sql: `
                    SELECT
                        HOST,
                        ROUND(ALLOCATION_LIMIT/1024/1024/1024, 2)
                            AS ALLOCATION_LIMIT_GB,
                        ROUND(USED_PHYSICAL_MEMORY/1024/1024/1024, 2)
                            AS USED_PHYSICAL_GB
                    FROM M_HOST_RESOURCE_UTILIZATION
                `

            },

            {

                queryNumber: 2,

                queryName:
                    "Schema Memory Usage",

                sql: `
                    SELECT
                        SCHEMA_NAME,
                        ROUND(
                            SUM(MEMORY_SIZE_IN_TOTAL)
                            / 1024 / 1024 / 1024,
                            2
                        ) AS TOTAL_MEMORY_GB
                    FROM M_CS_TABLES
                    GROUP BY SCHEMA_NAME
                    ORDER BY TOTAL_MEMORY_GB DESC
                `

            }

        ];

        // =============================================
        // CONNECT TO APP DATABASE
        // =============================================

        appConn.connect(APP_DB_CONFIG);

        // =============================================
        // CREATE ANALYSIS RUN
        // =============================================

        const runInsertQuery = `

            INSERT INTO MIGRATION_APP.ANALYSIS_RUNS
            (
                HOSTNAME,
                PORT,
                ANALYSIS_NAME,
                QUERY_NUMBER,
                STATUS
            )
            VALUES (?, ?, ?, ?, ?)

        `;

        // =============================================
        // PROCESS ALL QUERIES
        // =============================================

        let completedQueries = 0;

        const finalResults = [];

        queries.forEach((queryObj) => {

            // =========================================
            // EXECUTE QUERY
            // =========================================

            targetConn.exec(

                queryObj.sql,

                (err, result) => {

                    // =================================
                    // HANDLE QUERY ERROR
                    // =================================

                    if (err) {

                        completedQueries++;

                        finalResults.push({

                            query:
                                queryObj.queryName,

                            success: false,

                            error:
                                err.message

                        });

                        if (
                            completedQueries ===
                            queries.length
                        ) {

                            return res.json({

                                success: true,

                                data: finalResults

                            });

                        }

                        return;

                    }

                    // =================================
                    // INSERT ANALYSIS RUN
                    // =================================

                    appConn.prepare(

                        runInsertQuery,

                        (err, runStmt) => {

                            if (err) {

                                return res.status(500).json({

                                    success: false,

                                    error: err.message

                                });

                            }

                            runStmt.exec(

                                [

                                    host,

                                    port,

                                    queryObj.queryName,

                                    queryObj.queryNumber,

                                    "COMPLETED"

                                ],

                                (err, runResult) => {

                                    if (err) {

                                        return res.status(500).json({

                                            success: false,

                                            error: err.message

                                        });

                                    }

                                    // =====================
                                    // GET GENERATED RUN ID
                                    // =====================

                                    appConn.exec(

                                        `
                                        SELECT MAX(RUN_ID)
                                        AS RUN_ID
                                        FROM MIGRATION_APP.ANALYSIS_RUNS
                                        `,

                                        (err, runIdResult) => {

                                            if (err) {

                                                return res.status(500).json({

                                                    success: false,

                                                    error: err.message

                                                });

                                            }

                                            const runId =
                                                runIdResult?.[0]?.RUN_ID;

                                            // =========================
                                            // CONVERT RESULT TO JSON
                                            // =========================

                                            const resultJson =
                                                JSON.stringify(result);

                                            // =========================
                                            // SAVE ANALYSIS RESULT
                                            // =========================

                                            const resultInsertQuery = `

                                                INSERT INTO
                                                MIGRATION_APP.ANALYSIS_RESULTS
                                                (
                                                    RUN_ID,
                                                    QUERY_NAME,
                                                    QUERY_RESULT
                                                )
                                                VALUES (?, ?, ?)

                                            `;

                                            appConn.prepare(

                                                resultInsertQuery,

                                                (err, resultStmt) => {

                                                    if (err) {

                                                        return res.status(500).json({

                                                            success: false,

                                                            error: err.message

                                                        });

                                                    }

                                                    resultStmt.exec(

                                                        [

                                                            runId,

                                                            queryObj.queryName,

                                                            resultJson

                                                        ],

                                                        (err) => {

                                                            if (err) {

                                                                return res.status(500).json({

                                                                    success: false,

                                                                    error: err.message

                                                                });

                                                            }

                                                            completedQueries++;

                                                            finalResults.push({

                                                                query:
                                                                    queryObj.queryName,

                                                                success: true,

                                                                rows:
                                                                    result.length

                                                            });

                                                            // ============
                                                            // FINAL RESPONSE
                                                            // ============

                                                            if (
                                                                completedQueries ===
                                                                queries.length
                                                            ) {

                                                                res.json({

                                                                    success: true,

                                                                    data:
                                                                        finalResults

                                                                });

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

                }

            );

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