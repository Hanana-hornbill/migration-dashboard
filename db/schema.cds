namespace migration.app;

entity SAVED_CONNECTIONS {

    key ID                 : Integer;

    INSTANCE_NAME          : String(200);

    HOSTNAME               : String(500);

    PORT                   : Integer;

    USERID                 : String(200);

    PASSWORD               : String(500);

    DBTYPE                 : String(100);

    STATUS                 : String(100);

    LAST_ASSESSMENT        : Timestamp;

}

entity USERS_ASSESSMENT {

    key ID                 : Integer;

    CONNECTION_ID          : Integer;

    USERS_COUNT            : Integer;

}

entity TABLES_ASSESSMENT {

    key ID                 : Integer;

    CONNECTION_ID          : Integer;

    TABLES_COUNT           : Integer;

}

entity SCHEMAS_ASSESSMENT {

    key ID                 : Integer;

    CONNECTION_ID          : Integer;

    SCHEMAS_COUNT          : Integer;

}

entity MEMORY_ASSESSMENT {

    key ID                             : Integer;

    CONNECTION_ID                      : Integer;

    HOST                               : String(500);

    ALLOCATION_LIMIT_GB                : Decimal(15,2);

    USED_PHYSICAL_GB                  : Decimal(15,2);

    FREE_PHYSICAL_GB                  : Decimal(15,2);

    USED_SWAP_GB                      : Decimal(15,2);

    INSTANCE_MEMORY_GB                : Decimal(15,2);

    INSTANCE_MEMORY_PEAK_GB           : Decimal(15,2);

    TOTAL_ALLOCATED_GB                : Decimal(15,2);

}

entity SQL_MEMORY_ANALYSIS {

    key ID                         : Integer;

    CONNECTION_ID                  : Integer;

    AVG_MEMORY_GB                  : Decimal(15,2);

    PEAK_MEMORY_GB                 : Decimal(15,2);

    EXECUTION_COUNT                : Integer;

    TOTAL_EXEC_SECS                : Decimal(15,2);

    AVG_EXEC_MS                    : Decimal(15,2);

    SQL_PREVIEW                    : LargeString;

}

entity MEMORY_CONFIGURATION_ANALYSIS {

    key ID                 : Integer;

    CONNECTION_ID          : Integer;

    FILE_NAME              : String(300);

    SECTION_NAME           : String(300);

    CONFIG_KEY             : String(300);

    CONFIG_VALUE           : LargeString;

    LAYER_NAME             : String(300);

    HOST                   : String(500);

}

entity SCALE_OUT_CONFIGURATION_ANALYSIS {

    key ID                 : Integer;

    CONNECTION_ID          : Integer;

    FILE_NAME              : String(300);

    SECTION_NAME           : String(300);

    CONFIG_KEY             : String(300);

    CONFIG_VALUE           : LargeString;

    LAYER_NAME             : String(300);

    HOST                   : String(500);

}

entity ARCHIVAL_CANDIDATE_ANALYSIS {

    key ID                 : Integer;

    CONNECTION_ID          : Integer;

    SCHEMA_NAME            : String(300);

    TABLE_NAME             : String(300);

    MEMORY_GB              : Decimal(15,3);

    RECORD_COUNT           : Integer;

    LAST_READ              : Timestamp;

    DAYS_SINCE_READ        : Integer;

    LAST_WRITE             : Timestamp;

}

entity QUERY_REGISTRY {

    key QUERY_ID           : String(100);

    QUERY_NAME             : String(300);

    QUERY_TYPE             : String(100);

    CATEGORY_ID            : Integer;

    TARGET_TABLE           : String(300);

    QUERY_TEXT             : LargeString;

}