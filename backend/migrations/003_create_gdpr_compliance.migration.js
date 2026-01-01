/**
 * Migration: Create GDPR Compliance Tables
 * 
 * Tables for GDPR compliance: data requests, consent tracking, retention
 */

module.exports = {
    async up(db) {
        // Data subject requests (GDPR Article 15-22)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS gdpr_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                request_id VARCHAR(50) NOT NULL UNIQUE,
                user_id INT NOT NULL,
                request_type ENUM('access', 'rectification', 'erasure', 'portability', 'restriction', 'objection') NOT NULL,
                status ENUM('pending', 'processing', 'completed', 'rejected') DEFAULT 'pending',
                details JSON NULL,
                requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP NULL,
                processed_by INT NULL,
                response TEXT NULL,
                tenant_id VARCHAR(50) DEFAULT 'default',
                INDEX idx_gdpr_user (user_id),
                INDEX idx_gdpr_status (status),
                INDEX idx_gdpr_type (request_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Consent tracking
        await db.execute(`
            CREATE TABLE IF NOT EXISTS consent_records (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                consent_type VARCHAR(100) NOT NULL,
                purpose VARCHAR(255) NOT NULL,
                granted TINYINT(1) NOT NULL,
                ip_address VARCHAR(45) NULL,
                user_agent TEXT NULL,
                granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                revoked_at TIMESTAMP NULL,
                version VARCHAR(20) DEFAULT '1.0',
                tenant_id VARCHAR(50) DEFAULT 'default',
                INDEX idx_consent_user (user_id),
                INDEX idx_consent_type (consent_type),
                INDEX idx_consent_granted (granted)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Data retention policies
        await db.execute(`
            CREATE TABLE IF NOT EXISTS data_retention_policies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                data_type VARCHAR(100) NOT NULL UNIQUE,
                table_name VARCHAR(100) NOT NULL,
                retention_days INT NOT NULL,
                deletion_strategy ENUM('soft_delete', 'hard_delete', 'anonymize') DEFAULT 'soft_delete',
                is_active TINYINT(1) DEFAULT 1,
                last_executed_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Policy acknowledgments
        await db.execute(`
            CREATE TABLE IF NOT EXISTS policy_acknowledgments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                policy_type VARCHAR(100) NOT NULL,
                policy_version VARCHAR(20) NOT NULL,
                acknowledged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip_address VARCHAR(45) NULL,
                tenant_id VARCHAR(50) DEFAULT 'default',
                INDEX idx_policy_user (user_id),
                UNIQUE KEY uk_user_policy (user_id, policy_type, policy_version)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Insert default retention policies
        await db.execute(`
            INSERT IGNORE INTO data_retention_policies (data_type, table_name, retention_days, deletion_strategy) VALUES
            ('audit_logs', 'audit_logs', 2555, 'hard_delete'),
            ('session_tokens', 'refresh_tokens', 90, 'hard_delete'),
            ('webhook_deliveries', 'webhook_deliveries', 30, 'hard_delete'),
            ('leave_requests', 'leave_requests', 2555, 'anonymize'),
            ('employee_data', 'employees', 2555, 'soft_delete')
        `);

        console.log('     Created GDPR compliance tables');
    },

    async down(db) {
        await db.execute('DROP TABLE IF EXISTS policy_acknowledgments');
        await db.execute('DROP TABLE IF EXISTS data_retention_policies');
        await db.execute('DROP TABLE IF EXISTS consent_records');
        await db.execute('DROP TABLE IF EXISTS gdpr_requests');
    }
};
