-- Missing Database Tables Migration
-- Date: 2026-01-01

-- 1. Salary Info Table
CREATE TABLE IF NOT EXISTS salary_info (
    salary_id INT PRIMARY KEY AUTO_INCREMENT,
    emp_id VARCHAR(20) NOT NULL,
    base_salary DECIMAL(12,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    pay_frequency ENUM('monthly', 'bi-weekly', 'weekly') DEFAULT 'monthly',
    effective_date DATE NOT NULL,
    end_date DATE NULL,
    bonus_eligible BOOLEAN DEFAULT TRUE,
    overtime_eligible BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE,
    INDEX idx_emp_salary (emp_id, effective_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Webhooks Table
CREATE TABLE IF NOT EXISTS webhooks (
    webhook_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    url VARCHAR(500) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    secret_key VARCHAR(255) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    retry_count INT DEFAULT 3,
    timeout_seconds INT DEFAULT 30,
    last_triggered_at TIMESTAMP NULL,
    last_status VARCHAR(20) NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_event_type (event_type),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tenants Table (Multi-tenancy support)
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_name VARCHAR(100) NOT NULL UNIQUE,
    domain VARCHAR(255) NULL,
    subscription_plan ENUM('free', 'basic', 'premium', 'enterprise') DEFAULT 'basic',
    max_employees INT DEFAULT 50,
    is_active BOOLEAN DEFAULT TRUE,
    trial_ends_at DATE NULL,
    settings JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_domain (domain),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Role Permissions Table
CREATE TABLE IF NOT EXISTS role_permissions (
    permission_id INT PRIMARY KEY AUTO_INCREMENT,
    role VARCHAR(50) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action ENUM('create', 'read', 'update', 'delete', 'approve', 'export') NOT NULL,
    is_allowed BOOLEAN DEFAULT TRUE,
    conditions JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_permission (role, resource, action),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Leave Decisions Table (AI Decision Tracking)
CREATE TABLE IF NOT EXISTS leave_decisions (
    decision_id INT PRIMARY KEY AUTO_INCREMENT,
    request_id INT NOT NULL,
    emp_id VARCHAR(20) NOT NULL,
    decision_type ENUM('auto_approved', 'auto_rejected', 'manual_review', 'escalated') NOT NULL,
    decision_maker ENUM('ai_agent', 'manager', 'hr', 'system') NOT NULL,
    decision_status ENUM('approved', 'rejected', 'pending') NOT NULL,
    confidence_score DECIMAL(5,2) NULL,
    reasoning TEXT NULL,
    constraints_violated JSON NULL,
    decided_by INT NULL,
    decided_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT NULL,
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE,
    INDEX idx_request (request_id),
    INDEX idx_employee (emp_id),
    INDEX idx_type (decision_type),
    INDEX idx_decided_at (decided_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. AI Agent Logs Table (Real-time agent monitoring)
CREATE TABLE IF NOT EXISTS ai_agent_logs (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    agent_type ENUM('leave', 'onboarding', 'recruitment', 'performance') NOT NULL,
    log_level ENUM('info', 'warning', 'error', 'critical') NOT NULL,
    message TEXT NOT NULL,
    context JSON NULL,
    request_id VARCHAR(100) NULL,
    processing_time_ms INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_agent_type (agent_type),
    INDEX idx_log_level (log_level),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. System Health Metrics Table
CREATE TABLE IF NOT EXISTS system_health_metrics (
    metric_id INT PRIMARY KEY AUTO_INCREMENT,
    metric_type VARCHAR(50) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NULL,
    status ENUM('healthy', 'warning', 'critical') DEFAULT 'healthy',
    metadata JSON NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_metric_type (metric_type),
    INDEX idx_recorded_at (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default role permissions
INSERT INTO role_permissions (role, resource, action, is_allowed) VALUES
('admin', 'leaves', 'create', TRUE),
('admin', 'leaves', 'read', TRUE),
('admin', 'leaves', 'update', TRUE),
('admin', 'leaves', 'delete', TRUE),
('admin', 'leaves', 'approve', TRUE),
('admin', 'employees', 'create', TRUE),
('admin', 'employees', 'read', TRUE),
('admin', 'employees', 'update', TRUE),
('admin', 'employees', 'delete', TRUE),
('admin', 'system', 'read', TRUE),
('admin', 'system', 'update', TRUE),
('hr', 'leaves', 'read', TRUE),
('hr', 'leaves', 'approve', TRUE),
('hr', 'employees', 'read', TRUE),
('hr', 'employees', 'update', TRUE),
('employee', 'leaves', 'create', TRUE),
('employee', 'leaves', 'read', TRUE),
('employee', 'profile', 'read', TRUE),
('employee', 'profile', 'update', TRUE)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- Insert sample salary data for existing employees
INSERT INTO salary_info (emp_id, base_salary, currency, pay_frequency, effective_date)
SELECT emp_id, 
       CASE 
           WHEN position LIKE '%CEO%' THEN 250000
           WHEN position LIKE '%Director%' THEN 150000
           WHEN position LIKE '%Manager%' THEN 95000
           WHEN position LIKE '%Senior%' THEN 85000
           WHEN position LIKE '%Lead%' THEN 80000
           WHEN position LIKE '%Engineer%' OR position LIKE '%Developer%' THEN 70000
           ELSE 55000
       END as base_salary,
       'USD',
       'monthly',
       hire_date
FROM employees
WHERE NOT EXISTS (SELECT 1 FROM salary_info WHERE salary_info.emp_id = employees.emp_id)
LIMIT 100;

SELECT 'Migration completed successfully!' as status;
