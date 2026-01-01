/**
 * Migration: Create Enterprise Core Tables
 * 
 * Sets up the foundational tables for the enterprise HR system.
 */

module.exports = {
    async up(db) {
        // Audit logs table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                event_id VARCHAR(50) NOT NULL UNIQUE,
                action VARCHAR(100) NOT NULL,
                category VARCHAR(50) NOT NULL,
                severity ENUM('info', 'warning', 'error', 'critical') DEFAULT 'info',
                user_id INT NULL,
                target_user_id INT NULL,
                resource_type VARCHAR(50) NULL,
                resource_id VARCHAR(100) NULL,
                details JSON NULL,
                ip_address VARCHAR(45) NULL,
                user_agent TEXT NULL,
                tenant_id VARCHAR(50) DEFAULT 'default',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_audit_user (user_id),
                INDEX idx_audit_action (action),
                INDEX idx_audit_category (category),
                INDEX idx_audit_created (created_at),
                INDEX idx_audit_tenant (tenant_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Refresh tokens table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                token_id VARCHAR(64) NOT NULL UNIQUE,
                user_id INT NOT NULL,
                device_info VARCHAR(255) NULL,
                expires_at TIMESTAMP NOT NULL,
                revoked TINYINT(1) DEFAULT 0,
                revoked_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_refresh_user (user_id),
                INDEX idx_refresh_expires (expires_at),
                INDEX idx_refresh_revoked (revoked)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Roles table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS roles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(50) NOT NULL UNIQUE,
                display_name VARCHAR(100) NOT NULL,
                description TEXT NULL,
                is_system TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Permissions table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                display_name VARCHAR(150) NOT NULL,
                category VARCHAR(50) NOT NULL,
                description TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Role-Permission mapping
        await db.execute(`
            CREATE TABLE IF NOT EXISTS role_permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                role_id INT NOT NULL,
                permission_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uk_role_perm (role_id, permission_id),
                FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // User-Permission mapping (direct permissions)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS user_permissions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                permission_id INT NOT NULL,
                granted_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uk_user_perm (user_id, permission_id),
                FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Tenants table (for multi-tenancy)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS tenants (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenant_id VARCHAR(50) NOT NULL UNIQUE,
                name VARCHAR(255) NOT NULL,
                domain VARCHAR(255) NULL,
                settings JSON NULL,
                subscription_plan VARCHAR(50) DEFAULT 'free',
                subscription_status ENUM('active', 'trial', 'suspended', 'cancelled') DEFAULT 'trial',
                trial_ends_at TIMESTAMP NULL,
                is_active TINYINT(1) DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_tenant_domain (domain),
                INDEX idx_tenant_status (subscription_status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Webhooks table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS webhooks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenant_id VARCHAR(50) DEFAULT 'default',
                name VARCHAR(100) NOT NULL,
                url VARCHAR(500) NOT NULL,
                secret VARCHAR(255) NULL,
                events JSON NOT NULL,
                headers JSON NULL,
                is_active TINYINT(1) DEFAULT 1,
                last_triggered_at TIMESTAMP NULL,
                failure_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_webhook_tenant (tenant_id),
                INDEX idx_webhook_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Webhook delivery logs
        await db.execute(`
            CREATE TABLE IF NOT EXISTS webhook_deliveries (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                webhook_id INT NOT NULL,
                event_type VARCHAR(100) NOT NULL,
                payload JSON NOT NULL,
                response_status INT NULL,
                response_body TEXT NULL,
                attempt_count INT DEFAULT 1,
                delivered_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_delivery_webhook (webhook_id),
                INDEX idx_delivery_created (created_at),
                FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // Insert default roles
        await db.execute(`
            INSERT IGNORE INTO roles (name, display_name, description, is_system) VALUES
            ('admin', 'Administrator', 'Full system access', 1),
            ('hr', 'HR Manager', 'Human resources management access', 1),
            ('manager', 'Manager', 'Team management access', 1),
            ('employee', 'Employee', 'Basic employee access', 1)
        `);

        // Insert default permissions
        await db.execute(`
            INSERT IGNORE INTO permissions (name, display_name, category) VALUES
            ('users.view', 'View Users', 'user_management'),
            ('users.create', 'Create Users', 'user_management'),
            ('users.update', 'Update Users', 'user_management'),
            ('users.delete', 'Delete Users', 'user_management'),
            ('leaves.view_own', 'View Own Leaves', 'leave_management'),
            ('leaves.view_all', 'View All Leaves', 'leave_management'),
            ('leaves.create', 'Create Leave Requests', 'leave_management'),
            ('leaves.approve', 'Approve Leave Requests', 'leave_management'),
            ('leaves.manage_balances', 'Manage Leave Balances', 'leave_management'),
            ('employees.view', 'View Employees', 'employee_management'),
            ('employees.create', 'Create Employees', 'employee_management'),
            ('employees.update', 'Update Employees', 'employee_management'),
            ('employees.delete', 'Delete Employees', 'employee_management'),
            ('payroll.view_own', 'View Own Payroll', 'payroll'),
            ('payroll.view_all', 'View All Payroll', 'payroll'),
            ('payroll.manage', 'Manage Payroll', 'payroll'),
            ('onboarding.view', 'View Onboarding', 'onboarding'),
            ('onboarding.manage', 'Manage Onboarding', 'onboarding'),
            ('reports.view', 'View Reports', 'reports'),
            ('reports.export', 'Export Reports', 'reports'),
            ('settings.view', 'View Settings', 'system'),
            ('settings.manage', 'Manage Settings', 'system'),
            ('audit.view', 'View Audit Logs', 'compliance'),
            ('data.export', 'Export Data', 'compliance')
        `);

        // Insert default tenant
        await db.execute(`
            INSERT IGNORE INTO tenants (tenant_id, name, subscription_plan, subscription_status) VALUES
            ('default', 'Default Organization', 'enterprise', 'active')
        `);

        console.log('     Created enterprise core tables');
    },

    async down(db) {
        await db.execute('DROP TABLE IF EXISTS webhook_deliveries');
        await db.execute('DROP TABLE IF EXISTS webhooks');
        await db.execute('DROP TABLE IF EXISTS user_permissions');
        await db.execute('DROP TABLE IF EXISTS role_permissions');
        await db.execute('DROP TABLE IF EXISTS permissions');
        await db.execute('DROP TABLE IF EXISTS roles');
        await db.execute('DROP TABLE IF EXISTS tenants');
        await db.execute('DROP TABLE IF EXISTS refresh_tokens');
        await db.execute('DROP TABLE IF EXISTS audit_logs');
    }
};
