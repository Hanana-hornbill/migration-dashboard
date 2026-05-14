require('dotenv').config();

const cds = require('@sap/cds');
const express = require('express');
const hana = require('@sap/hana-client');

cds.on('bootstrap', (app) => {

    app.use(express.json());

    // =====================================================
    // APPLICATION DATABASE CONFIGURATION
    // =====================================================

    const APP_DB_CONFIG = {

        serverNode:
            `${process.env.APP_DB_HOST}:${process.env.APP_DB_PORT}`,

        uid:
            process.env.APP_DB_USER,

        pwd:
            process.env.APP_DB_PASSWORD

    };

    // =====================================================
    // ASSESSMENT API
    // =====================================================

    app.post('/assessment', (req, res) => {

        const { host, port, user, password } = req.body;

        // =================================================
        // TARGET DATABASE CONNECTION
        // =================================================

        const conn = hana.createConnection();

        // =================================================
        // APPLICATION DATABASE CONNECTION
        // =================================================

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

                `
                SELECT COUNT(*) AS USERS
                FROM USERS
                `,

                (err, userResult) => {

                    if (err) {

                        return sendError(res, err);

                    }

                    results.users =
                        userResult?.[0]?.USERS || 0;

                    // =========================================
                    // TABLES COUNT
                    // =========================================

                    conn.exec(

                        `
                        SELECT COUNT(*) AS TABLES
                        FROM TABLES
                        `,

                        (err, tableResult) => {

                            if (err) {

                                return sendError(res, err);

                            }

                            results.tables =
                                tableResult?.[0]?.TABLES || 0;

                            // =====================================
                            // SCHEMAS COUNT
                            // =====================================

                            conn.exec(

                                `
                                SELECT COUNT(*) AS SCHEMAS
                                FROM SCHEMAS
                                `,

                                (err, schemaResult) => {

                                    if (err) {

                                        return sendError(res, err);

                                    }

                                    results.schemas =
                                        schemaResult?.[0]?.SCHEMAS || 0;

                                    // =================================
                                    // CONNECT TO APP DATABASE
                                    // =================================

                                    appConn.connect(APP_DB_CONFIG);

                                    // =================================
                                    // CHECK EXISTING CONNECTION
                                    // =================================

                                    const checkQuery = `

                                        SELECT ID
                                        FROM MIGRATION_APP.SAVED_CONNECTIONS
                                        WHERE HOSTNAME = ?
                                        AND PORT = ?

                                    `;

                                    appConn.prepare(

                                        checkQuery,

                                        (err, checkStmt) => {

                                            if (err) {

                                                return sendError(res, err);

                                            }

                                            checkStmt.exec(

                                                [host, port],

                                                (err, checkResult) => {

                                                    if (err) {

                                                        return sendError(res, err);

                                                    }

                                                    const existingConnection =
                                                        checkResult?.[0];

                                                    // =========================
                                                    // EXISTING CONNECTION
                                                    // =========================

                                                    if (existingConnection) {

                                                        updateConnection(

                                                            conn,

                                                            appConn,

                                                            existingConnection.ID,

                                                            user,

                                                            password,

                                                            results,

                                                            res

                                                        );

                                                    }

                                                    // =========================
                                                    // NEW CONNECTION
                                                    // =========================

                                                    else {

                                                        insertConnection(

                                                            conn,

                                                            appConn,

                                                            host,

                                                            port,

                                                            user,

                                                            password,

                                                            results,

                                                            res

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

            return sendError(res, e);

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
                ORDER BY ID DESC
                `,

                (err, result) => {

                    if (err) {

                        return sendError(res, err);

                    }

                    res.json({

                        success: true,

                        data: result

                    });

                }

            );

        } catch (e) {

            return sendError(res, e);

        }

    });
    //////////////////////////

    // =====================================================
    // RUN HISTORY (assessment execution metadata)
    // =====================================================

    function sendNotFound(res, message) {

        return res.status(404).json({

            success: false,

            error: message || 'Not found'

        });

    }

    function formatDuration(seconds) {

        if (seconds === null || seconds === undefined || isNaN(Number(seconds))) return '-';

        const s = Number(seconds);

        if (s < 60) return `${Math.round(s)}s`;

        const m = Math.floor(s / 60);

        const rem = Math.round(s - m * 60);

        return `${m}m ${rem}s`;

    }

    // GET /runHistory?connectionId=...
    app.get('/runHistory', (req, res) => {

        const connectionId = req.query.connectionId;

        const q = (req.query.q || '').toString().trim();

        const status = req.query.status;

        const runType = req.query.runType;

        const range = req.query.range;

        const appConn = hana.createConnection();

        appConn.connect(APP_DB_CONFIG);

        const where = [];

        const params = [];

        if (connectionId) {

            where.push('RH.CONNECTION_ID = ?');

            params.push(connectionId);

        }

        if (q) {

            where.push('(RH.DATABASE_NAME LIKE ? OR RH.TRIGGERED_BY LIKE ? OR CAST(RH.ID AS NVARCHAR) LIKE ?)');

            params.push(`%${q}%`, `%${q}%`, `%${q}%`);

        }

        if (status && status !== 'all') {

            where.push('RH.STATUS = ?');

            params.push(status);

        }

        if (runType && runType !== 'all') {

            where.push('RH.RUN_TYPE = ?');

            params.push(runType);

        }

        if (range && range !== 'all') {

            const days = parseInt(range, 10);

            // range values from UI: 30d, 7d, 90d
            const parsedDays = isNaN(days) ? null : days;

            if (parsedDays) {

                where.push('RH.STARTED_AT >= ADD_DAYS(NOW(), -?)');

                params.push(parsedDays);

            }

        }


        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';


        const runsQuery = `
            SELECT
                RH.ID AS RUN_ID,
                RH.DATABASE_NAME,
                RH.RUN_TYPE,
                RH.STARTED_AT,
                RH.TRIGGERED_BY,
                RH.DURATION_SECONDS,
                RH.STATUS,
                (SELECT COUNT(*) FROM MIGRATION_APP.RUN_FINDINGS F WHERE F.CONNECTION_ID = RH.CONNECTION_ID AND F.RUN_ID = RH.ID) AS FINDINGS_COUNT
            FROM MIGRATION_APP.RUN_HEADERS RH
            ${whereSql}
            ORDER BY RH.STARTED_AT DESC
            LIMIT 50
        `;

        const summaryQuery = `
            SELECT
                COUNT(*) AS TOTAL_RUNS,
                SUM(CASE WHEN STATUS = 'SUCCESS' THEN 1 ELSE 0 END) AS SUCCESSFUL_RUNS,
                MAX(STARTED_AT) AS LAST_STARTED_AT
            FROM MIGRATION_APP.RUN_HEADERS
            ${where.length ? `WHERE ${where.filter(w => !w.includes('q') && !w.includes('STARTED_AT >=')).join(' AND ')}` : ''}
        `;

        appConn.exec(runsQuery, params, (err, result) => {

            if (err) {

                return sendError(res, err);

            }

            // Summary (separate query for simplicity)
            appConn.exec(summaryQuery, params, (err2, summaryResult) => {

                if (err2) {

                    return res.json({ success: true, summary: {}, runs: result });

                }

                const summaryRow = summaryResult?.[0] || {};

                const lastTs = summaryRow.LAST_STARTED_AT;

                const runs = (result || []).map(r => {

                    const statusDisplay = r.STATUS ? r.STATUS : '-';

                    return {

                        runId: r.RUN_ID,
                        databaseName: r.DATABASE_NAME,
                        runType: r.RUN_TYPE,
                        runDateDisplay: lastTs ? new Date(r.STARTED_AT).toLocaleString() : (r.STARTED_AT ? new Date(r.STARTED_AT).toLocaleString() : '-'),
                        triggeredBy: r.TRIGGERED_BY,
                        durationDisplay: formatDuration(r.DURATION_SECONDS),
                        findingsCount: r.FINDINGS_COUNT || 0,
                        statusDisplay

                    };

                });

                res.json({

                    success: true,

                    summary: {

                        totalRuns: summaryRow.TOTAL_RUNS || 0,

                        successfulRuns: summaryRow.SUCCESSFUL_RUNS || 0,

                        lastRunDisplay: lastTs ? new Date(lastTs).toLocaleDateString() : '-',

                        lastRunDatabase: '-',

                        avgDurationDisplay: '-' // computed client-side later or implement easily later

                    },

                    runs

                });

            });

        });

    });

    // GET /runHistory/:runId?connectionId=...
    app.get('/runHistory/:runId', (req, res) => {

        const connectionId = req.query.connectionId;

        const runId = req.params.runId;

        const appConn = hana.createConnection();

        appConn.connect(APP_DB_CONFIG);

        const where = connectionId ? 'RH.CONNECTION_ID = ? AND RH.ID = ?' : 'RH.ID = ?';
        const params = connectionId ? [connectionId, runId] : [runId];

        const runQuery = `
            SELECT
                RH.ID AS RUN_ID,
                RH.CONNECTION_ID,
                RH.DATABASE_NAME,
                RH.RUN_TYPE,
                RH.TRIGGERED_BY,
                RH.STATUS,
                RH.STARTED_AT,
                RH.ENDED_AT,
                RH.DURATION_SECONDS
            FROM MIGRATION_APP.RUN_HEADERS RH
            WHERE ${where}
        `;

        appConn.exec(runQuery, params, (err, runResult) => {

            if (err) {

                return sendError(res, err);

            }

            const run = runResult?.[0];

            if (!run) {

                return sendNotFound(res, 'Run not found');

            }

            const findingsQuery = `
                SELECT
                    F.ID AS FINDING_ID,
                    F.CATEGORY,
                    F.OBJECT_NAME,
                    F.ISSUE,
                    F.SEVERITY
                FROM MIGRATION_APP.RUN_FINDINGS F
                WHERE ${connectionId ? 'F.CONNECTION_ID = ? AND F.RUN_ID = ?' : 'F.RUN_ID = ?'}
                ORDER BY F.ID ASC
            `;

            const findingsParams = connectionId ? [connectionId, runId] : [runId];

            const logQuery = `
                SELECT
                    L.LOG_TEXT,
                    L.LOG_TAIL
                FROM MIGRATION_APP.RUN_LOGS L
                WHERE ${connectionId ? 'L.CONNECTION_ID = ? AND L.RUN_ID = ?' : 'L.RUN_ID = ?'}
            `;

            const logParams = connectionId ? [connectionId, runId] : [runId];

            appConn.exec(findingsQuery, findingsParams, (errF, findingsResult) => {

                if (errF) {

                    return sendError(res, errF);

                }

                appConn.exec(logQuery, logParams, (errL, logResult) => {

                    if (errL) {

                        return sendError(res, errL);

                    }

                    const logRow = logResult?.[0] || {};

                    const findings = (findingsResult || []).map((f, idx) => ({

                        idx: idx + 1,
                        category: f.CATEGORY,
                        objectName: f.OBJECT_NAME,
                        issue: f.ISSUE,
                        severityDisplay: f.SEVERITY || '-'

                    }));

                    // Params + KPIs: reuse existing assessment summary tables as placeholders
                    const kpi = {
                        durationDisplay: formatDuration(run.DURATION_SECONDS),
                        queriesExecuted: '-',
                        objectsScanned: '-',
                        findingsCount: findings.length
                    };

                    const params = [
                        { name: 'Database', value: run.DATABASE_NAME },
                        { name: 'Run Type', value: run.RUN_TYPE },
                        { name: 'Triggered By', value: run.TRIGGERED_BY },
                        { name: 'Status', value: run.STATUS },
                        { name: 'Started At', value: run.STARTED_AT ? new Date(run.STARTED_AT).toLocaleString() : '-' },
                        { name: 'Ended At', value: run.ENDED_AT ? new Date(run.ENDED_AT).toLocaleString() : '-' }
                    ];

                    res.json({

                        success: true,

                        data: {

                            run: { runId: run.RUN_ID },

                            kpis: kpi,

                            params,

                            findings,

                            logTail: logRow.LOG_TAIL || ''

                        }

                    });

                });

            });

        });

    });







    ////////////////
    //sql memory analysis
    app.get(

        "/sqlAnalysis/:connectionId",

        (req, res) => {

            const connectionId =
                req.params.connectionId;

            const appConn =
                hana.createConnection();

            appConn.connect({

                serverNode:
                    `${process.env.APP_DB_HOST}:${process.env.APP_DB_PORT}`,

                uid:
                    process.env.APP_DB_USER,

                pwd:
                    process.env.APP_DB_PASSWORD

            });

            appConn.exec(

                `

            SELECT *

            FROM MIGRATION_APP.SQL_MEMORY_ANALYSIS

            WHERE CONNECTION_ID = ?

            ORDER BY PEAK_MEMORY_GB DESC

            `,

                [connectionId],

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

        }

    );

    app.get(

        "/memoryConfig/:connectionId",

        (req, res) => {

            const connectionId =
                req.params.connectionId;

            const appConn =
                hana.createConnection();

            appConn.connect(APP_DB_CONFIG);

            appConn.exec(

                `

                SELECT *

                FROM
                MIGRATION_APP.MEMORY_CONFIGURATION_ANALYSIS

                WHERE CONNECTION_ID = ?

                ORDER BY FILE_NAME, SECTION_NAME

                `,

                [connectionId],

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

        }

    );
    app.get(

        "/scaleOutConfig/:connectionId",

        (req, res) => {

            const connectionId =
                req.params.connectionId;

            const appConn =
                hana.createConnection();

            appConn.connect(APP_DB_CONFIG);

            appConn.exec(

                `

            SELECT *

            FROM
            MIGRATION_APP.SCALE_OUT_CONFIGURATION_ANALYSIS

            WHERE CONNECTION_ID = ?

            ORDER BY FILE_NAME, SECTION_NAME

            `,

                [connectionId],

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

        }

    );
    // =====================================================
    // INSERT NEW CONNECTION
    // =====================================================

    function insertConnection(

        conn,

        appConn,

        host,

        port,

        user,

        password,

        results,

        res

    ) {

        const insertQuery = `

            INSERT INTO MIGRATION_APP.SAVED_CONNECTIONS
            (
                INSTANCE_NAME,
                HOSTNAME,
                PORT,
                USERID,
                PASSWORD,
                DBTYPE,
                STATUS
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)

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

                    return sendError(res, err);

                }

                insertStmt.exec(

                    values,

                    (err) => {

                        if (err) {

                            return sendError(res, err);

                        }

                        // =============================
                        // FETCH CONNECTION ID
                        // =============================

                        const getIdQuery = `

                            SELECT ID
                            FROM MIGRATION_APP.SAVED_CONNECTIONS
                            WHERE HOSTNAME = ?
                            AND PORT = ?

                        `;

                        appConn.prepare(

                            getIdQuery,

                            (err, idStmt) => {

                                if (err) {

                                    return sendError(res, err);

                                }

                                idStmt.exec(

                                    [host, port],

                                    (err, idResult) => {

                                        if (err) {

                                            return sendError(res, err);

                                        }

                                        const connectionId =
                                            idResult?.[0]?.ID;

                                        // =====================================
                                        // CREATE DEFAULT ASSESSMENT ROWS
                                        // =====================================

                                        appConn.exec(

                                            `
    INSERT INTO MIGRATION_APP.USERS_ASSESSMENT
    (CONNECTION_ID, USERS_COUNT)
    VALUES (?, 0)
    `,

                                            [connectionId]

                                        );

                                        appConn.exec(

                                            `
    INSERT INTO MIGRATION_APP.TABLES_ASSESSMENT
    (CONNECTION_ID, TABLES_COUNT)
    VALUES (?, 0)
    `,

                                            [connectionId]

                                        );

                                        appConn.exec(

                                            `
    INSERT INTO MIGRATION_APP.SCHEMAS_ASSESSMENT
    (CONNECTION_ID, SCHEMAS_COUNT)
    VALUES (?, 0)
    `,

                                            [connectionId]

                                        );

                                        appConn.exec(

                                            `
    INSERT INTO MIGRATION_APP.MEMORY_ASSESSMENT
    (
        CONNECTION_ID,
        HOST,
        ALLOCATION_LIMIT_GB,
        USED_PHYSICAL_GB,
        FREE_PHYSICAL_GB,
        USED_SWAP_GB,
        INSTANCE_MEMORY_GB,
        INSTANCE_MEMORY_PEAK_GB,
        TOTAL_ALLOCATED_GB
    )
    VALUES (?, '', 0, 0, 0, 0, 0, 0, 0)
    `,

                                            [connectionId]

                                        );

                                        // =====================================
                                        // RUN ASSESSMENT UPDATE
                                        // =====================================

                                        saveAssessmentResults(

                                            conn,

                                            appConn,

                                            connectionId,

                                            results,

                                            res

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

    // =====================================================
    // UPDATE EXISTING CONNECTION
    // =====================================================

    function updateConnection(

        conn,

        appConn,

        connectionId,

        user,

        password,

        results,

        res

    ) {

        const updateQuery = `

            UPDATE MIGRATION_APP.SAVED_CONNECTIONS
            SET
                USERID = ?,
                PASSWORD = ?,
                STATUS = ?
            WHERE ID = ?

        `;

        appConn.prepare(

            updateQuery,

            (err, updateStmt) => {

                if (err) {

                    return sendError(res, err);

                }

                updateStmt.exec(

                    [

                        user,

                        password,

                        "CONNECTED",

                        connectionId

                    ],

                    (err) => {

                        if (err) {

                            return sendError(res, err);

                        }

                        saveAssessmentResults(

                            conn,

                            appConn,

                            connectionId,

                            results,

                            res

                        );

                    }

                );

            }

        );

    }

    // =====================================================
    // SAVE ASSESSMENT RESULTS
    // =====================================================

    function saveAssessmentResults(

        conn,

        appConn,

        connectionId,

        results,

        res

    ) {

        // =================================================
        // USERS ASSESSMENT
        // =================================================

        const usersQuery = `

           UPDATE MIGRATION_APP.USERS_ASSESSMENT
           SET USERS_COUNT = ?
           WHERE CONNECTION_ID = ?

        `;

        appConn.prepare(

            usersQuery,

            (err, usersStmt) => {

                if (err) {

                    return sendError(res, err);

                }

                usersStmt.exec(

                    [

                        results.users,
                        connectionId


                    ],

                    (err) => {

                        if (err) {

                            return sendError(res, err);

                        }

                        // =====================================
                        // TABLES ASSESSMENT
                        // =====================================

                        const tablesQuery = `

                            UPDATE MIGRATION_APP.TABLES_ASSESSMENT
                            SET TABLES_COUNT = ?
                            WHERE CONNECTION_ID = ?

                        `;

                        appConn.prepare(

                            tablesQuery,

                            (err, tablesStmt) => {

                                if (err) {

                                    return sendError(res, err);

                                }

                                tablesStmt.exec(

                                    [

                                        results.tables,
                                        connectionId



                                    ],

                                    (err) => {

                                        if (err) {

                                            return sendError(res, err);

                                        }

                                        // =============================
                                        // SCHEMAS ASSESSMENT
                                        // =============================

                                        const schemasQuery = `

                                            UPDATE MIGRATION_APP.SCHEMAS_ASSESSMENT
                                            SET SCHEMAS_COUNT = ?
                                            WHERE CONNECTION_ID = ?

                                        `;

                                        appConn.prepare(

                                            schemasQuery,

                                            (err, schemasStmt) => {

                                                if (err) {

                                                    return sendError(res, err);

                                                }

                                                schemasStmt.exec(

                                                    [



                                                        results.schemas, connectionId

                                                    ],

                                                    (err) => {

                                                        if (err) {

                                                            return sendError(res, err);

                                                        }

                                                        saveMemoryAssessment(

                                                            conn,

                                                            appConn,

                                                            connectionId,

                                                            results,

                                                            res

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

            }

        );

    }

    // =====================================================
    // MEMORY ASSESSMENT
    // =====================================================

    function saveMemoryAssessment(

        conn,

        appConn,

        connectionId,

        results,

        res

    ) {

        const memoryQuery = `

            SELECT
                HOST,

                ROUND(ALLOCATION_LIMIT/1024/1024/1024, 2)
                    AS ALLOCATION_LIMIT_GB,

                ROUND(USED_PHYSICAL_MEMORY/1024/1024/1024, 2)
                    AS USED_PHYSICAL_GB,

                ROUND(FREE_PHYSICAL_MEMORY/1024/1024/1024, 2)
                    AS FREE_PHYSICAL_GB,

                ROUND(USED_SWAP_SPACE/1024/1024/1024, 2)
                    AS USED_SWAP_GB,

                ROUND(INSTANCE_TOTAL_MEMORY_USED_SIZE/1024/1024/1024, 2)
                    AS INSTANCE_MEMORY_GB,

                ROUND(INSTANCE_TOTAL_MEMORY_PEAK_USED_SIZE/1024/1024/1024, 2)
                    AS INSTANCE_MEMORY_PEAK_GB,

                ROUND(INSTANCE_TOTAL_MEMORY_ALLOCATED_SIZE/1024/1024/1024, 2)
                    AS TOTAL_ALLOCATED_GB

            FROM M_HOST_RESOURCE_UTILIZATION

            ORDER BY HOST

        `;

        conn.exec(

            memoryQuery,

            (err, memoryResult) => {

                if (err) {

                    return sendError(res, err);

                }
                // =====================================
                // SET MEMORY TILE VALUE
                // =====================================

                if (

                    memoryResult &&

                    memoryResult.length > 0

                ) {

                    results.memoryUsed = Number(

                        memoryResult[0].INSTANCE_MEMORY_GB ||

                        memoryResult[0].instance_memory_gb ||

                        0

                    );

                } else {

                    results.memoryUsed = 0;

                }

                //console.log(results.memoryUsed);
                const insertMemoryQuery = `

                    UPDATE MIGRATION_APP.MEMORY_ASSESSMENT
                    SET
                        HOST = ?,
                        ALLOCATION_LIMIT_GB = ?,
                        USED_PHYSICAL_GB = ?,
                        FREE_PHYSICAL_GB = ?,
                        USED_SWAP_GB = ?,
                        INSTANCE_MEMORY_GB = ?,
                        INSTANCE_MEMORY_PEAK_GB = ?,
                        TOTAL_ALLOCATED_GB = ?
                    WHERE CONNECTION_ID = ?

                `;

                appConn.prepare(

                    insertMemoryQuery,

                    (err, memoryStmt) => {

                        if (err) {

                            return sendError(res, err);

                        }

                        const row = memoryResult[0];

                        const values = [

                            row.HOST,

                            row.ALLOCATION_LIMIT_GB,

                            row.USED_PHYSICAL_GB,

                            row.FREE_PHYSICAL_GB,

                            row.USED_SWAP_GB,

                            row.INSTANCE_MEMORY_GB,

                            row.INSTANCE_MEMORY_PEAK_GB,

                            row.TOTAL_ALLOCATED_GB,

                            connectionId

                        ];

                        memoryStmt.exec(

                            values,

                            (err) => {

                                if (err) {

                                    console.error(err);

                                }

                            }

                        );

                        // =====================================
                        // FINAL RESPONSE
                        // =====================================

                        saveSqlMemoryAnalysis(

                            conn,

                            appConn,

                            connectionId,

                            results,

                            res

                        );

                    }

                );

            }

        );

    }

    function saveSqlMemoryAnalysis(

        conn,

        appConn,

        connectionId,

        results,

        res

    ) {

        const sqlQuery = `

        SELECT TOP 100

            ROUND(
                AVG_EXECUTION_MEMORY_SIZE
                /1024/1024/1024,
                2
            ) AS AVG_MEMORY_GB,

            ROUND(
                MAX_EXECUTION_MEMORY_SIZE
                /1024/1024/1024,
                2
            ) AS PEAK_MEMORY_GB,

            EXECUTION_COUNT,

            ROUND(
                TOTAL_EXECUTION_TIME
                /1000000.0,
                2
            ) AS TOTAL_EXEC_SECS,

            ROUND(
                AVG_EXECUTION_TIME
                /1000.0,
                2
            ) AS AVG_EXEC_MS,

            LEFT(
                STATEMENT_STRING,
                120
            ) AS SQL_PREVIEW

        FROM M_SQL_PLAN_CACHE

        ORDER BY AVG_EXECUTION_MEMORY_SIZE DESC

    `;

        conn.exec(

            sqlQuery,

            (err, sqlResult) => {

                if (err) {

                    console.error(err);

                    return res.json({

                        success: true,

                        data: results

                    });

                }
                appConn.exec(

                    `
    DELETE FROM
    MIGRATION_APP.SQL_MEMORY_ANALYSIS
    WHERE CONNECTION_ID = ?
    `,

                    [connectionId]

                );

                const insertQuery = `

                INSERT INTO
                MIGRATION_APP.SQL_MEMORY_ANALYSIS
                (
                    CONNECTION_ID,
                    AVG_MEMORY_GB,
                    PEAK_MEMORY_GB,
                    EXECUTION_COUNT,
                    TOTAL_EXEC_SECS,
                    AVG_EXEC_MS,
                    SQL_PREVIEW
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)

            `;

                appConn.prepare(

                    insertQuery,

                    (err, stmt) => {

                        if (err) {

                            console.error(err);

                            return res.json({

                                success: true,

                                data: results

                            });

                        }

                        sqlResult.forEach((row) => {

                            stmt.exec(

                                [

                                    connectionId,

                                    row.AVG_MEMORY_GB,

                                    row.PEAK_MEMORY_GB,

                                    row.EXECUTION_COUNT,

                                    row.TOTAL_EXEC_SECS,

                                    row.AVG_EXEC_MS,

                                    row.SQL_PREVIEW

                                ],

                                (err) => {

                                    if (err) {

                                        console.error(err);

                                    }

                                }

                            );

                        });

                        console.log(

                            "SQL MEMORY ANALYSIS SAVED"

                        );

                        saveMemoryConfigurationAnalysis(

                            conn,

                            appConn,

                            connectionId,

                            results,

                            res

                        );

                    }

                );

            }

        );

    }
    function saveMemoryConfigurationAnalysis(

        conn,

        appConn,

        connectionId,

        results,

        res

    ) {

        const configQuery = `

        SELECT
            FILE_NAME,
            SECTION,
            KEY,
            VALUE,
            LAYER_NAME,
            HOST

        FROM M_INIFILE_CONTENTS

        WHERE
            UPPER(KEY) LIKE '%MEMORY%'
            OR
            UPPER(SECTION) LIKE '%MEMORY%'

        ORDER BY
            FILE_NAME,
            SECTION,
            KEY

    `;

        conn.exec(

            configQuery,

            (err, configResult) => {

                if (err) {

                    console.error(err);

                    return res.json({

                        success: true,

                        data: results

                    });

                }

                // =====================================
                // DELETE OLD CONFIG DATA
                // =====================================

                appConn.exec(

                    `
                DELETE FROM
                MIGRATION_APP.MEMORY_CONFIGURATION_ANALYSIS
                WHERE CONNECTION_ID = ?
                `,

                    [connectionId],

                    (err) => {

                        if (err) {

                            console.error(err);

                            return res.json({

                                success: true,

                                data: results

                            });

                        }

                        // =====================================
                        // INSERT NEW DATA
                        // =====================================

                        const insertQuery = `

                        INSERT INTO
                        MIGRATION_APP.MEMORY_CONFIGURATION_ANALYSIS
                        (
                            CONNECTION_ID,
                            FILE_NAME,
                            SECTION_NAME,
                            CONFIG_KEY,
                            CONFIG_VALUE,
                            LAYER_NAME,
                            HOST
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?)

                    `;

                        appConn.prepare(

                            insertQuery,

                            (err, stmt) => {

                                if (err) {

                                    console.error(err);

                                    return res.json({

                                        success: true,

                                        data: results

                                    });

                                }

                                configResult.forEach((row) => {

                                    stmt.exec(

                                        [

                                            connectionId,

                                            row.FILE_NAME,

                                            row.SECTION,

                                            row.KEY,

                                            row.VALUE,

                                            row.LAYER_NAME,

                                            row.HOST

                                        ],

                                        (err) => {

                                            if (err) {

                                                console.error(err);

                                            }

                                        }

                                    );

                                });

                                console.log(
                                    "MEMORY CONFIG ANALYSIS SAVED"
                                );

                                saveScaleOutConfigurationAnalysis(

                                    conn,

                                    appConn,

                                    connectionId,

                                    results,

                                    res

                                );

                            }

                        );

                    }

                );

            }

        );

    }
    function saveScaleOutConfigurationAnalysis(

        conn,

        appConn,

        connectionId,

        results,

        res

    ) {

        const scaleOutQuery = `

        SELECT
            FILE_NAME,
            SECTION,
            KEY,
            VALUE,
            LAYER_NAME,
            HOST

        FROM M_INIFILE_CONTENTS

        WHERE
            UPPER(KEY) LIKE '%DISTRIBUTION%'
            OR UPPER(KEY) LIKE '%REDISTRIBUTION%'
            OR UPPER(SECTION) LIKE '%REDISTRIBUTION%'
            OR UPPER(KEY) LIKE '%REMOTE%'
            OR UPPER(KEY) LIKE '%INTERNODE%'
            OR UPPER(SECTION) LIKE '%SCALE%OUT%'

        ORDER BY
            FILE_NAME,
            SECTION,
            KEY

    `;

        conn.exec(

            scaleOutQuery,

            (err, scaleResult) => {

                if (err) {

                    console.error(err);

                    return res.json({

                        success: true,

                        data: results

                    });

                }

                // =====================================
                // DELETE OLD DATA
                // =====================================

                appConn.exec(

                    `
                DELETE FROM
                MIGRATION_APP.SCALE_OUT_CONFIGURATION_ANALYSIS

                WHERE CONNECTION_ID = ?
                `,

                    [connectionId],

                    (err) => {

                        if (err) {

                            console.error(err);

                            return res.json({

                                success: true,

                                data: results

                            });

                        }

                        // =====================================
                        // INSERT NEW DATA
                        // =====================================

                        const insertQuery = `

                        INSERT INTO
                        MIGRATION_APP.SCALE_OUT_CONFIGURATION_ANALYSIS
                        (
                            CONNECTION_ID,
                            FILE_NAME,
                            SECTION_NAME,
                            CONFIG_KEY,
                            CONFIG_VALUE,
                            LAYER_NAME,
                            HOST
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?)

                    `;

                        appConn.prepare(

                            insertQuery,

                            (err, stmt) => {

                                if (err) {

                                    console.error(err);

                                    return res.json({

                                        success: true,

                                        data: results

                                    });

                                }

                                scaleResult.forEach((row) => {

                                    stmt.exec(

                                        [

                                            connectionId,

                                            row.FILE_NAME,

                                            row.SECTION,

                                            row.KEY,

                                            row.VALUE,

                                            row.LAYER_NAME,

                                            row.HOST

                                        ],

                                        (err) => {

                                            if (err) {

                                                console.error(err);

                                            }

                                        }

                                    );

                                });

                                console.log(
                                    "SCALE OUT CONFIG SAVED"
                                );

                                res.json({

                                    success: true,

                                    data: results

                                });
                            }

                        );

                    }

                );

            }

        );

    }
    /*function saveArchivalCandidateAnalysis(

        conn,

        appConn,

        connectionId,

        results,

        res

    ) {

        const archivalQuery = `

        SELECT

            S.SCHEMA_NAME,

            S.TABLE_NAME,

            ROUND(
                C.MEMORY_SIZE_IN_TOTAL
                /1024/1024/1024,
                3
            ) AS MEMORY_GB,

            C.RECORD_COUNT,

            MAX(S.LAST_SELECT_TIME)
                AS LAST_READ,

            DAYS_BETWEEN(

                MAX(S.LAST_SELECT_TIME),

                NOW()

            ) AS DAYS_SINCE_READ,

            MAX(S.LAST_MODIFY_TIME)
                AS LAST_WRITE

        FROM M_TABLE_STATISTICS S

        JOIN M_CS_TABLES C

            ON S.SCHEMA_NAME = C.SCHEMA_NAME

            AND S.TABLE_NAME = C.TABLE_NAME

        GROUP BY

            S.SCHEMA_NAME,

            S.TABLE_NAME,

            C.MEMORY_SIZE_IN_TOTAL,

            C.RECORD_COUNT

        HAVING

            (

                MAX(S.LAST_SELECT_TIME) IS NULL

                OR

                MAX(S.LAST_SELECT_TIME)
                < ADD_DAYS(NOW(), -370)

            )

            AND

            C.MEMORY_SIZE_IN_TOTAL
            > 10*1024*1024*1024

        ORDER BY MEMORY_GB DESC

    `;

        conn.exec(

            archivalQuery,

            (err, archivalResult) => {

                if (err) {

                    console.error(err);

                    return res.json({

                        success: true,

                        data: results

                    });

                }

                // =====================================
                // DELETE OLD DATA
                // =====================================

                appConn.exec(

                    `
                DELETE FROM
                MIGRATION_APP.ARCHIVAL_CANDIDATE_ANALYSIS

                WHERE CONNECTION_ID = ?
                `,

                    [connectionId],

                    (err) => {

                        if (err) {

                            console.error(err);

                            return res.json({

                                success: true,

                                data: results

                            });

                        }

                        // =====================================
                        // INSERT NEW DATA
                        // =====================================

                        const insertQuery = `

                        INSERT INTO
                        MIGRATION_APP.ARCHIVAL_CANDIDATE_ANALYSIS
                        (
                            CONNECTION_ID,
                            SCHEMA_NAME,
                            TABLE_NAME,
                            MEMORY_GB,
                            RECORD_COUNT,
                            LAST_READ,
                            DAYS_SINCE_READ,
                            LAST_WRITE
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)

                    `;

                        appConn.prepare(

                            insertQuery,

                            (err, stmt) => {

                                if (err) {

                                    console.error(err);

                                    return res.json({

                                        success: true,

                                        data: results

                                    });

                                }

                                archivalResult.forEach((row) => {

                                    stmt.exec(

                                        [

                                            connectionId,

                                            row.SCHEMA_NAME,

                                            row.TABLE_NAME,

                                            row.MEMORY_GB,

                                            row.RECORD_COUNT,

                                            row.LAST_READ,

                                            row.DAYS_SINCE_READ,

                                            row.LAST_WRITE

                                        ],

                                        (err) => {

                                            if (err) {

                                                console.error(err);

                                            }

                                        }

                                    );

                                });

                                console.log(
                                    "ARCHIVAL ANALYSIS SAVED"
                                );

                                res.json({

                                    success: true,

                                    data: results

                                });

                            }

                        );

                    }

                );

            }

        );

    }*/
    // =====================================================
    // ERROR HANDLER
    // =====================================================

    function sendError(res, err) {

        return res.status(500).json({

            success: false,

            error: err.message

        });

    }

});

module.exports = cds.server;