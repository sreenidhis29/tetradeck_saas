-- =====================================================
-- AI Leave Mode System Migration
-- Version: 004
-- Description: Adds support for Normal/Automatic AI leave processing modes
--              with priority badge system and HR escalation
-- =====================================================

-- 1. AI System Configuration Table
CREATE TABLE IF NOT EXISTS ai_system_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description VARCHAR(255),
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default AI mode configuration
INSERT INTO ai_system_config (config_key, config_value, description) VALUES
('leave_ai_mode', 'automatic', 'AI Leave Processing Mode: automatic (AI handles all) or normal (AI handles sick only, rest to HR)'),
('normal_mode_auto_approve_types', '["sick_leave"]', 'Leave types that AI can auto-approve in normal mode'),
('hr_response_timeout_hours', '7', 'Hours before employee can set priority badge'),
('priority_escalation_timeout_hours', '24', 'Hours before red priority requests auto-escalate'),
('enable_email_notifications', 'true', 'Send email notifications for priority requests'),
('enable_dashboard_notifications', 'true', 'Show dashboard notifications for priority requests')
ON DUPLICATE KEY UPDATE config_key = config_key;

-- 2. Leave Priority Badge Table
CREATE TABLE IF NOT EXISTS leave_priority_badges (
    id INT PRIMARY KEY AUTO_INCREMENT,
    request_id VARCHAR(50) NOT NULL,
    emp_id VARCHAR(20) NOT NULL,
    priority_level ENUM('none', 'yellow', 'red') DEFAULT 'none',
    priority_reason TEXT,
    badge_set_at TIMESTAMP NULL,
    hr_notified_at TIMESTAMP NULL,
    hr_email_sent_at TIMESTAMP NULL,
    escalated_at TIMESTAMP NULL,
    escalation_target ENUM('none', 'manager', 'hr_manager', 'director') DEFAULT 'none',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_request_priority (request_id),
    FOREIGN KEY (request_id) REFERENCES leave_requests(request_id) ON DELETE CASCADE,
    INDEX idx_priority_level (priority_level),
    INDEX idx_badge_set_at (badge_set_at),
    INDEX idx_emp_id (emp_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. HR Notification Queue Table
CREATE TABLE IF NOT EXISTS hr_notification_queue (
    id INT PRIMARY KEY AUTO_INCREMENT,
    notification_type ENUM('priority_request', 'escalation', 'pending_review', 'urgent_action') NOT NULL,
    request_id VARCHAR(50) NOT NULL,
    recipient_emp_id VARCHAR(20),
    recipient_role ENUM('hr', 'hr_manager', 'manager', 'director') DEFAULT 'hr',
    priority_level ENUM('normal', 'high', 'urgent') DEFAULT 'normal',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSON,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    is_email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP NULL,
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_recipient (recipient_emp_id, is_read),
    INDEX idx_type (notification_type),
    INDEX idx_created (created_at),
    INDEX idx_request (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. AI Mode Change Audit Log
CREATE TABLE IF NOT EXISTS ai_mode_audit_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    previous_mode VARCHAR(50),
    new_mode VARCHAR(50),
    changed_by INT NOT NULL,
    changed_by_name VARCHAR(100),
    change_reason TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Leave Escalation History
CREATE TABLE IF NOT EXISTS leave_escalation_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    request_id VARCHAR(50) NOT NULL,
    escalation_level INT NOT NULL DEFAULT 1,
    escalated_from ENUM('employee', 'system', 'hr', 'manager') NOT NULL,
    escalated_to ENUM('hr', 'hr_manager', 'manager', 'director', 'ai_engine') NOT NULL,
    escalation_reason TEXT NOT NULL,
    triggered_by ENUM('timeout', 'priority_badge', 'manual', 'policy') NOT NULL,
    priority_level ENUM('none', 'yellow', 'red') DEFAULT 'none',
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP NULL,
    resolved_by VARCHAR(20),
    resolution_action ENUM('approved', 'rejected', 'reassigned', 'cancelled') NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_request (request_id),
    INDEX idx_resolved (is_resolved),
    INDEX idx_escalated_to (escalated_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Alter leave_requests table to add new columns
-- Use separate ALTER statements for better compatibility
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS ai_mode_at_submission ENUM('automatic', 'normal') DEFAULT 'automatic';
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS hr_assigned_at TIMESTAMP NULL;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS hr_viewed_at TIMESTAMP NULL;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS can_set_priority BOOLEAN DEFAULT FALSE;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS priority_eligible_at TIMESTAMP NULL;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS escalation_count INT DEFAULT 0;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS last_escalation_at TIMESTAMP NULL;
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS processing_notes TEXT;

-- 7. Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_leave_ai_mode ON leave_requests(ai_mode_at_submission);
CREATE INDEX IF NOT EXISTS idx_leave_hr_assigned ON leave_requests(hr_assigned_at);
CREATE INDEX IF NOT EXISTS idx_leave_priority_eligible ON leave_requests(priority_eligible_at);

-- 8. Insert system notification templates
CREATE TABLE IF NOT EXISTS notification_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_key VARCHAR(100) NOT NULL UNIQUE,
    template_type ENUM('email', 'dashboard', 'both') DEFAULT 'both',
    subject VARCHAR(255),
    body TEXT NOT NULL,
    variables JSON COMMENT 'List of available template variables',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO notification_templates (template_key, template_type, subject, body, variables) VALUES
('priority_request_hr', 'both', 
 'Priority Leave Request: {{employee_name}}', 
 'A {{priority_level}} priority leave request requires your attention.\n\nEmployee: {{employee_name}}\nLeave Type: {{leave_type}}\nDates: {{start_date}} to {{end_date}}\nReason: {{reason}}\n\nThis request has been waiting for {{hours_pending}} hours.',
 '["employee_name", "priority_level", "leave_type", "start_date", "end_date", "reason", "hours_pending"]'),

('escalation_notice', 'both',
 'Leave Request Escalated: {{employee_name}}',
 'A leave request has been escalated to you for immediate attention.\n\nEmployee: {{employee_name}}\nLeave Type: {{leave_type}}\nPriority: {{priority_level}}\nEscalation Reason: {{escalation_reason}}\n\nPlease take action within the next 24 hours.',
 '["employee_name", "leave_type", "priority_level", "escalation_reason"]'),

('priority_badge_available', 'dashboard',
 'Set Priority on Your Leave Request',
 'Your leave request has been pending for {{hours_pending}} hours. You can now set a priority badge to expedite the review process.',
 '["hours_pending", "request_id"]'),

('auto_approval_normal_mode', 'both',
 'Leave Request Auto-Approved',
 'Your {{leave_type}} request from {{start_date}} to {{end_date}} has been automatically approved by the AI system.',
 '["leave_type", "start_date", "end_date", "total_days"]')

ON DUPLICATE KEY UPDATE template_key = template_key;

-- 9. Create stored procedure for checking and updating priority eligibility
DELIMITER //

CREATE PROCEDURE IF NOT EXISTS check_priority_eligibility()
BEGIN
    DECLARE hr_timeout_hours INT;
    
    -- Get timeout configuration
    SELECT CAST(config_value AS UNSIGNED) INTO hr_timeout_hours 
    FROM ai_system_config 
    WHERE config_key = 'hr_response_timeout_hours';
    
    -- Default to 7 hours if not set
    IF hr_timeout_hours IS NULL THEN
        SET hr_timeout_hours = 7;
    END IF;
    
    -- Update requests that are eligible for priority badge
    UPDATE leave_requests lr
    LEFT JOIN leave_priority_badges lpb ON lr.request_id = lpb.request_id
    SET 
        lr.can_set_priority = TRUE,
        lr.priority_eligible_at = NOW()
    WHERE 
        lr.status = 'pending'
        AND lr.ai_mode_at_submission = 'normal'
        AND lr.hr_viewed_at IS NULL
        AND lr.can_set_priority = FALSE
        AND TIMESTAMPDIFF(HOUR, lr.created_at, NOW()) >= hr_timeout_hours
        AND (lpb.id IS NULL OR lpb.priority_level = 'none');
END //

CREATE PROCEDURE IF NOT EXISTS process_priority_escalations()
BEGIN
    DECLARE escalation_timeout_hours INT;
    
    -- Get timeout configuration
    SELECT CAST(config_value AS UNSIGNED) INTO escalation_timeout_hours 
    FROM ai_system_config 
    WHERE config_key = 'priority_escalation_timeout_hours';
    
    -- Default to 24 hours if not set
    IF escalation_timeout_hours IS NULL THEN
        SET escalation_timeout_hours = 24;
    END IF;
    
    -- Process red priority requests that haven't been viewed after 24 hours
    -- These will be marked for AI engine re-evaluation
    INSERT INTO leave_escalation_history (
        request_id, escalation_level, escalated_from, escalated_to,
        escalation_reason, triggered_by, priority_level
    )
    SELECT 
        lr.request_id,
        IFNULL(lr.escalation_count, 0) + 1,
        'system',
        'ai_engine',
        CONCAT('HR did not respond within ', escalation_timeout_hours, ' hours for red priority request'),
        'timeout',
        'red'
    FROM leave_requests lr
    JOIN leave_priority_badges lpb ON lr.request_id = lpb.request_id
    WHERE 
        lr.status = 'pending'
        AND lpb.priority_level = 'red'
        AND lr.hr_viewed_at IS NULL
        AND TIMESTAMPDIFF(HOUR, lpb.badge_set_at, NOW()) >= escalation_timeout_hours
        AND NOT EXISTS (
            SELECT 1 FROM leave_escalation_history leh 
            WHERE leh.request_id = lr.request_id 
            AND leh.escalated_to = 'ai_engine'
            AND leh.is_resolved = FALSE
        );
    
    -- Update escalation count
    UPDATE leave_requests lr
    JOIN leave_priority_badges lpb ON lr.request_id = lpb.request_id
    SET 
        lr.escalation_count = lr.escalation_count + 1,
        lr.last_escalation_at = NOW()
    WHERE 
        lr.status = 'pending'
        AND lpb.priority_level = 'red'
        AND lr.hr_viewed_at IS NULL
        AND TIMESTAMPDIFF(HOUR, lpb.badge_set_at, NOW()) >= escalation_timeout_hours;
END //

DELIMITER ;

-- 10. Create view for pending priority requests
CREATE OR REPLACE VIEW v_pending_priority_requests AS
SELECT 
    lr.request_id,
    lr.emp_id,
    e.full_name as employee_name,
    e.email as employee_email,
    e.department,
    lr.leave_type,
    lr.start_date,
    lr.end_date,
    lr.total_days,
    lr.reason,
    lr.status,
    lr.created_at,
    lr.hr_assigned_at,
    lr.hr_viewed_at,
    lr.can_set_priority,
    lr.priority_eligible_at,
    IFNULL(lpb.priority_level, 'none') as priority_level,
    lpb.priority_reason,
    lpb.badge_set_at,
    TIMESTAMPDIFF(HOUR, lr.created_at, NOW()) as hours_pending,
    CASE 
        WHEN lpb.priority_level = 'red' THEN 1
        WHEN lpb.priority_level = 'yellow' THEN 2
        ELSE 3
    END as priority_sort_order
FROM leave_requests lr
LEFT JOIN employees e ON lr.emp_id = e.emp_id
LEFT JOIN leave_priority_badges lpb ON lr.request_id = lpb.request_id
WHERE lr.status = 'pending'
ORDER BY priority_sort_order, lr.created_at ASC;

-- Success message
SELECT 'AI Leave Mode System migration completed successfully!' as status;
