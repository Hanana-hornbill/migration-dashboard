using { migration.app as db } from '../db/schema';

service MigrationService {

    entity SavedConnections
        as projection on db.SAVED_CONNECTIONS;

    entity UsersAssessment
        as projection on db.USERS_ASSESSMENT;

    entity TablesAssessment
        as projection on db.TABLES_ASSESSMENT;

    entity SchemasAssessment
        as projection on db.SCHEMAS_ASSESSMENT;

    entity MemoryAssessment
        as projection on db.MEMORY_ASSESSMENT;

    entity SqlMemoryAnalysis
        as projection on db.SQL_MEMORY_ANALYSIS;

    entity MemoryConfigurationAnalysis
        as projection on db.MEMORY_CONFIGURATION_ANALYSIS;

    entity ScaleOutConfigurationAnalysis
        as projection on db.SCALE_OUT_CONFIGURATION_ANALYSIS;

    entity ArchivalCandidateAnalysis
        as projection on db.ARCHIVAL_CANDIDATE_ANALYSIS;

    entity QueryRegistry
        as projection on db.QUERY_REGISTRY;

}