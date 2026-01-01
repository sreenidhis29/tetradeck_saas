/**
 * Audit Logging Service
 * 
 * Provides comprehensive audit logging for compliance and security.
 * Tracks all sensitive actions with full context for auditing.
 * 
 * @module services/auditService
 */

const db = require('../config/db');
const env = require('../config/environment');
const crypto = require('crypto');

// Audit event categories
const CATEGORIES = {
    AUTHENTICATION: 'authentication',
    AUTHORIZATION: 'authorization',
    USER_MANAGEMENT: 'user_management',
    LEAVE_MANAGEMENT: 'leave_management',
    ONBOARDING: 'onboarding',
    PAYROLL: 'payroll',
    EMPLOYEE_DATA: 'employee_data',
    SYSTEM: 'system',
    DATA_ACCESS: 'data_access',
    DATA_EXPORT: 'data_export',
    COMPLIANCE: 'compliance',
};

// Severity levels
const SEVERITY = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical',
};

/**
 * Generate a unique audit event ID
 * @returns {string} Unique event ID
 */
function generateEventId() {
    return `AUD-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/**
 * Log an audit event
 * @param {Object} event - Audit event details
 * @returns {Promise<string>} Event ID
 */
async function log(event) {
    if (!env.compliance.auditLogEnabled) {
        return null;
    }

    const eventId = generateEventId();
    const timestamp = new Date();

    const auditRecord = {
        eventId,
        action: event.action,
        category: event.category || CATEGORIES.SYSTEM,
        severity: event.severity || SEVERITY.INFO,
        userId: event.userId || null,
        targetUserId: event.targetUserId || null,
        resourceType: event.resourceType || null,
        resourceId: event.resourceId || null,
        details: event.details || {},
        ipAddress: event.ipAddress || null,
        userAgent: event.userAgent || null,
        timestamp,
        tenantId: event.tenantId || env.multiTenant.defaultTenantId,
    };

    try {
        // Try to insert into database
        await db.execute(`
            INSERT INTO audit_logs (
                event_id, action, category, severity,
                user_id, target_user_id, resource_type, resource_id,
                details, ip_address, user_agent, tenant_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            auditRecord.eventId,
            auditRecord.action,
            auditRecord.category,
            auditRecord.severity,
            auditRecord.userId,
            auditRecord.targetUserId,
            auditRecord.resourceType,
            auditRecord.resourceId,
            JSON.stringify(auditRecord.details),
            auditRecord.ipAddress,
            auditRecord.userAgent,
            auditRecord.tenantId,
            timestamp,
        ]);
    } catch (error) {
        // Fallback to console logging if database fails
        console.log(JSON.stringify({
            type: 'AUDIT_LOG',
            ...auditRecord,
            details: auditRecord.details,
            dbError: error.message,
        }));
    }

    return eventId;
}

/**
 * Log authentication events
 */
const auth = {
    loginSuccess: (userId, ipAddress, userAgent) => log({
        action: 'LOGIN_SUCCESS',
        category: CATEGORIES.AUTHENTICATION,
        userId,
        ipAddress,
        userAgent,
    }),

    loginFailed: (email, reason, ipAddress) => log({
        action: 'LOGIN_FAILED',
        category: CATEGORIES.AUTHENTICATION,
        severity: SEVERITY.WARNING,
        details: { email, reason },
        ipAddress,
    }),

    logout: (userId, ipAddress) => log({
        action: 'LOGOUT',
        category: CATEGORIES.AUTHENTICATION,
        userId,
        ipAddress,
    }),

    tokenRefresh: (userId, ipAddress) => log({
        action: 'TOKEN_REFRESH',
        category: CATEGORIES.AUTHENTICATION,
        userId,
        ipAddress,
    }),

    passwordChange: (userId, ipAddress) => log({
        action: 'PASSWORD_CHANGE',
        category: CATEGORIES.AUTHENTICATION,
        userId,
        ipAddress,
    }),

    twoFactorEnabled: (userId) => log({
        action: 'TWO_FACTOR_ENABLED',
        category: CATEGORIES.AUTHENTICATION,
        userId,
    }),
};

/**
 * Log user management events
 */
const userManagement = {
    created: (userId, targetUserId, details) => log({
        action: 'USER_CREATED',
        category: CATEGORIES.USER_MANAGEMENT,
        userId,
        targetUserId,
        resourceType: 'user',
        resourceId: targetUserId,
        details,
    }),

    updated: (userId, targetUserId, changes) => log({
        action: 'USER_UPDATED',
        category: CATEGORIES.USER_MANAGEMENT,
        userId,
        targetUserId,
        resourceType: 'user',
        resourceId: targetUserId,
        details: { changes },
    }),

    deleted: (userId, targetUserId) => log({
        action: 'USER_DELETED',
        category: CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY.WARNING,
        userId,
        targetUserId,
        resourceType: 'user',
        resourceId: targetUserId,
    }),

    roleChanged: (userId, targetUserId, oldRole, newRole) => log({
        action: 'ROLE_CHANGED',
        category: CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY.WARNING,
        userId,
        targetUserId,
        resourceType: 'user',
        resourceId: targetUserId,
        details: { oldRole, newRole },
    }),

    deactivated: (userId, targetUserId, reason) => log({
        action: 'USER_DEACTIVATED',
        category: CATEGORIES.USER_MANAGEMENT,
        severity: SEVERITY.WARNING,
        userId,
        targetUserId,
        resourceType: 'user',
        resourceId: targetUserId,
        details: { reason },
    }),
};

/**
 * Log leave management events
 */
const leave = {
    requested: (userId, leaveId, details) => log({
        action: 'LEAVE_REQUESTED',
        category: CATEGORIES.LEAVE_MANAGEMENT,
        userId,
        resourceType: 'leave_request',
        resourceId: leaveId,
        details,
    }),

    approved: (userId, leaveId, approverId) => log({
        action: 'LEAVE_APPROVED',
        category: CATEGORIES.LEAVE_MANAGEMENT,
        userId: approverId,
        targetUserId: userId,
        resourceType: 'leave_request',
        resourceId: leaveId,
    }),

    rejected: (userId, leaveId, approverId, reason) => log({
        action: 'LEAVE_REJECTED',
        category: CATEGORIES.LEAVE_MANAGEMENT,
        userId: approverId,
        targetUserId: userId,
        resourceType: 'leave_request',
        resourceId: leaveId,
        details: { reason },
    }),

    cancelled: (userId, leaveId, reason) => log({
        action: 'LEAVE_CANCELLED',
        category: CATEGORIES.LEAVE_MANAGEMENT,
        userId,
        resourceType: 'leave_request',
        resourceId: leaveId,
        details: { reason },
    }),

    balanceAdjusted: (userId, targetUserId, adjustments) => log({
        action: 'LEAVE_BALANCE_ADJUSTED',
        category: CATEGORIES.LEAVE_MANAGEMENT,
        severity: SEVERITY.WARNING,
        userId,
        targetUserId,
        resourceType: 'leave_balance',
        details: adjustments,
    }),
};

/**
 * Log onboarding events
 */
const onboarding = {
    started: (userId, onboardingId, details) => log({
        action: 'ONBOARDING_STARTED',
        category: CATEGORIES.ONBOARDING,
        userId,
        resourceType: 'onboarding',
        resourceId: onboardingId,
        details,
    }),

    taskCompleted: (userId, onboardingId, taskId, taskName) => log({
        action: 'ONBOARDING_TASK_COMPLETED',
        category: CATEGORIES.ONBOARDING,
        userId,
        resourceType: 'onboarding_task',
        resourceId: taskId,
        details: { onboardingId, taskName },
    }),

    completed: (userId, onboardingId) => log({
        action: 'ONBOARDING_COMPLETED',
        category: CATEGORIES.ONBOARDING,
        userId,
        resourceType: 'onboarding',
        resourceId: onboardingId,
    }),

    documentSigned: (userId, documentId, documentName) => log({
        action: 'DOCUMENT_SIGNED',
        category: CATEGORIES.ONBOARDING,
        userId,
        resourceType: 'document',
        resourceId: documentId,
        details: { documentName },
    }),
};

/**
 * Log data access and export events
 */
const dataAccess = {
    viewed: (userId, resourceType, resourceId, details) => log({
        action: 'DATA_VIEWED',
        category: CATEGORIES.DATA_ACCESS,
        userId,
        resourceType,
        resourceId,
        details,
    }),

    exported: (userId, exportType, recordCount, format) => log({
        action: 'DATA_EXPORTED',
        category: CATEGORIES.DATA_EXPORT,
        severity: SEVERITY.WARNING,
        userId,
        details: { exportType, recordCount, format },
    }),

    bulkAccess: (userId, resourceType, count) => log({
        action: 'BULK_DATA_ACCESS',
        category: CATEGORIES.DATA_ACCESS,
        severity: SEVERITY.WARNING,
        userId,
        resourceType,
        details: { recordCount: count },
    }),
};

/**
 * Log compliance events
 */
const compliance = {
    gdprRequest: (userId, requestType, details) => log({
        action: `GDPR_${requestType.toUpperCase()}`,
        category: CATEGORIES.COMPLIANCE,
        severity: SEVERITY.WARNING,
        userId,
        details,
    }),

    dataRetentionPurge: (recordType, count) => log({
        action: 'DATA_RETENTION_PURGE',
        category: CATEGORIES.COMPLIANCE,
        severity: SEVERITY.WARNING,
        details: { recordType, recordCount: count },
    }),

    policyAccepted: (userId, policyName, policyVersion) => log({
        action: 'POLICY_ACCEPTED',
        category: CATEGORIES.COMPLIANCE,
        userId,
        details: { policyName, policyVersion },
    }),
};

/**
 * Query audit logs
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} Audit log entries
 */
async function query(filters = {}) {
    let sql = `SELECT * FROM audit_logs WHERE 1=1`;
    const params = [];

    if (filters.userId) {
        sql += ` AND (user_id = ? OR target_user_id = ?)`;
        params.push(filters.userId, filters.userId);
    }

    if (filters.action) {
        sql += ` AND action = ?`;
        params.push(filters.action);
    }

    if (filters.category) {
        sql += ` AND category = ?`;
        params.push(filters.category);
    }

    if (filters.severity) {
        sql += ` AND severity = ?`;
        params.push(filters.severity);
    }

    if (filters.resourceType) {
        sql += ` AND resource_type = ?`;
        params.push(filters.resourceType);
    }

    if (filters.resourceId) {
        sql += ` AND resource_id = ?`;
        params.push(filters.resourceId);
    }

    if (filters.startDate) {
        sql += ` AND created_at >= ?`;
        params.push(filters.startDate);
    }

    if (filters.endDate) {
        sql += ` AND created_at <= ?`;
        params.push(filters.endDate);
    }

    sql += ` ORDER BY created_at DESC`;

    if (filters.limit) {
        sql += ` LIMIT ?`;
        params.push(filters.limit);
    }

    if (filters.offset) {
        sql += ` OFFSET ?`;
        params.push(filters.offset);
    }

    try {
        return await db.query(sql, params);
    } catch (error) {
        console.error('Audit query error:', error.message);
        return [];
    }
}

/**
 * Get audit summary for a user
 * @param {number} userId - User ID
 * @param {number} days - Number of days to look back
 * @returns {Promise<Object>} Audit summary
 */
async function getUserSummary(userId, days = 30) {
    try {
        const summary = await db.query(`
            SELECT 
                category,
                action,
                COUNT(*) as count,
                MAX(created_at) as last_occurrence
            FROM audit_logs
            WHERE (user_id = ? OR target_user_id = ?)
                AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY category, action
            ORDER BY count DESC
        `, [userId, userId, days]);

        return summary;
    } catch (error) {
        console.error('Audit summary error:', error.message);
        return [];
    }
}

module.exports = {
    log,
    query,
    getUserSummary,
    CATEGORIES,
    SEVERITY,
    auth,
    userManagement,
    leave,
    onboarding,
    dataAccess,
    compliance,
};
