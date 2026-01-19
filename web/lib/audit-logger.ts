import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { sendSecurityAlertEmail } from "@/lib/email-service";

export interface AuditLogParams {
    actor_type?: "user" | "system" | "ai";
    actor_id: string;
    actor_role?: string;
    action: string;
    entity_type: string;
    entity_id: string;
    resource_name?: string;
    previous_state?: Record<string, any>;
    new_state?: Record<string, any>;
    details?: Record<string, any>;
    decision?: "approved" | "rejected" | "pending_review";
    decision_reason?: string;
    confidence_score?: number;
    model_version?: string;
    rules_evaluated?: string[];
    ip_address?: string;
    user_agent?: string;
    target_org: string;
    /** Flag suspicious activity to trigger security alerts */
    isSuspicious?: boolean;
    suspiciousSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Creates an immutable audit log entry with integrity hash chaining
 * Currently stores enhanced fields in the details JSON until schema migration
 * 
 * Usage:
 * ```ts
 * await createAuditLog({
 *     actor_type: "user",
 *     actor_id: employee.emp_id,
 *     actor_role: employee.role,
 *     action: "LEAVE_REQUEST_CREATED",
 *     entity_type: "LeaveRequest",
 *     entity_id: leaveRequest.id,
 *     resource_name: "Annual Leave - 5 days",
 *     new_state: { status: "pending", days: 5 },
 *     target_org: employee.company_id
 * });
 * ```
 */
export async function createAuditLog(params: AuditLogParams) {
    const {
        actor_type = "user",
        actor_id,
        actor_role,
        action,
        entity_type,
        entity_id,
        resource_name,
        previous_state,
        new_state,
        details,
        decision,
        decision_reason,
        confidence_score,
        model_version,
        rules_evaluated,
        ip_address,
        user_agent,
        target_org,
        isSuspicious = false,
        suspiciousSeverity = 'MEDIUM'
    } = params;

    try {
        // Generate unique request ID
        const request_id = `req_${crypto.randomUUID().split("-")[0]}`;
        const timestamp = new Date();

        // Create content to hash for integrity
        const hashContent = JSON.stringify({
            timestamp: timestamp.toISOString(),
            actor_type,
            actor_id,
            action,
            entity_type,
            entity_id
        });

        // Generate SHA-256 integrity hash
        const integrity_hash = `sha256:${crypto
            .createHash("sha256")
            .update(hashContent)
            .digest("hex")}`;

        // Store enhanced fields in details JSON (backward compatible)
        const enhancedDetails = {
            ...details,
            actor_type,
            actor_role,
            resource_name,
            previous_state,
            new_state,
            decision,
            decision_reason,
            confidence_score,
            model_version,
            rules_evaluated,
            ip_address,
            user_agent,
            request_id,
            integrity_hash
        };

        // Create the audit log entry using existing schema
        const auditLog = await prisma.auditLog.create({
            data: {
                actor_id,
                action,
                entity_type,
                entity_id,
                target_org,
                details: enhancedDetails,
                created_at: timestamp
            }
        });

        // Send security alert if suspicious activity detected
        if (isSuspicious || actor_type === 'system' && action.includes('FAILED') || actor_id === 'anonymous') {
            // Get admin/HR emails to notify
            const admins = await prisma.employee.findMany({
                where: {
                    OR: [
                        { role: 'admin' },
                        { role: 'hr' }
                    ]
                },
                select: { email: true }
            });

            // Determine alert type based on action
            let alertType: 'SUSPICIOUS_LOGIN' | 'FAILED_ATTEMPTS' | 'UNUSUAL_ACTIVITY' | 'DATA_ACCESS' | 'ANONYMOUS_ACTION' | 'PERMISSION_CHANGE' = 'UNUSUAL_ACTIVITY';
            
            if (action.includes('LOGIN') || action.includes('AUTH')) {
                alertType = action.includes('FAILED') ? 'FAILED_ATTEMPTS' : 'SUSPICIOUS_LOGIN';
            } else if (actor_id === 'anonymous' || actor_id === 'unknown') {
                alertType = 'ANONYMOUS_ACTION';
            } else if (action.includes('PERMISSION') || action.includes('ROLE')) {
                alertType = 'PERMISSION_CHANGE';
            } else if (action.includes('EXPORT') || action.includes('DOWNLOAD') || action.includes('ACCESS')) {
                alertType = 'DATA_ACCESS';
            }

            // Send alerts to all admins
            for (const admin of admins) {
                sendSecurityAlertEmail(admin.email, {
                    alertType,
                    severity: suspiciousSeverity,
                    details: `${action} on ${entity_type} (ID: ${entity_id}). ${decision_reason || ''}`,
                    ipAddress: ip_address,
                    userAgent: user_agent,
                    timestamp: timestamp.toISOString(),
                    affectedUser: actor_id !== 'anonymous' ? actor_id : undefined
                }).catch(err => console.error('Security alert email failed:', err));
            }
        }

        return {
            success: true,
            log_id: auditLog.id,
            request_id,
            integrity_hash
        };
    } catch (error) {
        console.error("Failed to create audit log:", error);
        // Audit logging should never break the main flow
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}

/**
 * Creates an AI decision audit log with full explainability
 * 
 * Usage:
 * ```ts
 * await createAIDecisionLog({
 *     actor_id: "constraint_engine_v2",
 *     action: "LEAVE_REQUEST_ANALYZED",
 *     entity_type: "LeaveRequest",
 *     entity_id: request.id,
 *     decision: "rejected",
 *     decision_reason: "Insufficient leave balance",
 *     confidence_score: 0.95,
 *     model_version: "constraint-engine-v2.1.0",
 *     rules_evaluated: ["RULE001", "RULE002", "RULE003"],
 *     target_org: company_id
 * });
 * ```
 */
export async function createAIDecisionLog(params: {
    actor_id?: string;
    action: string;
    entity_type: string;
    entity_id: string;
    resource_name?: string;
    previous_state?: Record<string, any>;
    new_state?: Record<string, any>;
    decision: "approved" | "rejected" | "pending_review";
    decision_reason: string;
    confidence_score: number;
    model_version: string;
    rules_evaluated?: string[];
    details?: Record<string, any>;
    target_org: string;
}) {
    return createAuditLog({
        actor_type: "ai",
        actor_id: params.actor_id || "ai_constraint_engine",
        actor_role: "ai_service",
        ...params
    });
}

/**
 * Creates a system event audit log
 */
export async function createSystemLog(params: {
    action: string;
    entity_type: string;
    entity_id: string;
    resource_name?: string;
    details?: Record<string, any>;
    target_org: string;
}) {
    return createAuditLog({
        actor_type: "system",
        actor_id: "system_scheduler",
        actor_role: "system",
        ...params
    });
}

/**
 * Action constants for consistent audit logging
 */
export const AUDIT_ACTIONS = {
    // Authentication
    USER_LOGIN: "USER_LOGIN",
    USER_LOGOUT: "USER_LOGOUT",
    PASSWORD_CHANGED: "PASSWORD_CHANGED",
    
    // Leave Management
    LEAVE_REQUEST_CREATED: "LEAVE_REQUEST_CREATED",
    LEAVE_REQUEST_UPDATED: "LEAVE_REQUEST_UPDATED",
    LEAVE_REQUEST_APPROVED: "LEAVE_REQUEST_APPROVED",
    LEAVE_REQUEST_REJECTED: "LEAVE_REQUEST_REJECTED",
    LEAVE_REQUEST_CANCELLED: "LEAVE_REQUEST_CANCELLED",
    LEAVE_REQUEST_ANALYZED: "LEAVE_REQUEST_ANALYZED",
    
    // Attendance
    ATTENDANCE_CHECK_IN: "ATTENDANCE_CHECK_IN",
    ATTENDANCE_CHECK_OUT: "ATTENDANCE_CHECK_OUT",
    ATTENDANCE_MODIFIED: "ATTENDANCE_MODIFIED",
    ATTENDANCE_REMINDER_SENT: "ATTENDANCE_REMINDER_SENT",
    
    // Employee Management
    EMPLOYEE_CREATED: "EMPLOYEE_CREATED",
    EMPLOYEE_UPDATED: "EMPLOYEE_UPDATED",
    EMPLOYEE_DEACTIVATED: "EMPLOYEE_DEACTIVATED",
    
    // Team Management
    TEAM_CREATED: "TEAM_CREATED",
    TEAM_UPDATED: "TEAM_UPDATED",
    TEAM_MEMBER_ADDED: "TEAM_MEMBER_ADDED",
    TEAM_MEMBER_REMOVED: "TEAM_MEMBER_REMOVED",
    
    // Policy Changes
    POLICY_CREATED: "POLICY_CREATED",
    POLICY_UPDATED: "POLICY_UPDATED",
    POLICY_DELETED: "POLICY_DELETED",
    
    // AI Decisions
    AI_DECISION_MADE: "AI_DECISION_MADE",
    AI_RULE_EVALUATED: "AI_RULE_EVALUATED",
    AI_RECOMMENDATION_GENERATED: "AI_RECOMMENDATION_GENERATED",
    
    // System Events
    EMAIL_SENT: "EMAIL_SENT",
    NOTIFICATION_SENT: "NOTIFICATION_SENT",
    SCHEDULED_TASK_RUN: "SCHEDULED_TASK_RUN",
    DATA_EXPORTED: "DATA_EXPORTED",
    REPORT_GENERATED: "REPORT_GENERATED"
} as const;

/**
 * Entity type constants
 */
export const ENTITY_TYPES = {
    LEAVE_REQUEST: "LeaveRequest",
    EMPLOYEE: "Employee",
    ATTENDANCE: "Attendance",
    TEAM: "Team",
    POLICY: "Policy",
    SESSION: "Session",
    EMAIL: "Email",
    NOTIFICATION: "Notification"
} as const;
