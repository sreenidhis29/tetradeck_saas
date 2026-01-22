import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Audit Actions Enum
export enum AuditAction {
    // Authentication
    LOGIN = "LOGIN",
    LOGOUT = "LOGOUT",
    LOGIN_FAILED = "LOGIN_FAILED",
    PASSWORD_RESET = "PASSWORD_RESET",
    TWO_FACTOR_ENABLED = "2FA_ENABLED",
    TWO_FACTOR_DISABLED = "2FA_DISABLED",
    
    // Leave Management
    LEAVE_CREATED = "LEAVE_CREATED",
    LEAVE_UPDATED = "LEAVE_UPDATED",
    LEAVE_APPROVED = "LEAVE_APPROVED",
    LEAVE_REJECTED = "LEAVE_REJECTED",
    LEAVE_CANCELLED = "LEAVE_CANCELLED",
    LEAVE_ESCALATED = "LEAVE_ESCALATED",
    LEAVE_RECORDS_VIEWED = "LEAVE_RECORDS_VIEWED",
    LEAVE_EXPORTED = "LEAVE_EXPORTED",
    LEAVE_BALANCE_ADJUSTED = "LEAVE_BALANCE_ADJUSTED",
    
    // AI Decisions
    AI_DECISION = "AI_DECISION",
    AI_OVERRIDE = "AI_OVERRIDE",
    AI_ANALYSIS_FAILED = "AI_ANALYSIS_FAILED",
    
    // Employee
    EMPLOYEE_CREATED = "EMPLOYEE_CREATED",
    EMPLOYEE_UPDATED = "EMPLOYEE_UPDATED",
    EMPLOYEE_DELETED = "EMPLOYEE_DELETED",
    EMPLOYEE_ONBOARDED = "EMPLOYEE_ONBOARDED",
    EMPLOYEE_REGISTERED = "EMPLOYEE_REGISTERED",
    EMPLOYEE_APPROVED = "EMPLOYEE_APPROVED",
    EMPLOYEE_REJECTED = "EMPLOYEE_REJECTED",
    
    // Payroll
    PAYROLL_CALCULATED = "PAYROLL_CALCULATED",
    PAYROLL_PROCESSED = "PAYROLL_PROCESSED",
    PAYROLL_APPROVED = "PAYROLL_APPROVED",
    PAYROLL_PAID = "PAYROLL_PAID",
    PAYROLL_EXPORTED = "PAYROLL_EXPORTED",
    
    // Settings
    SETTINGS_UPDATED = "SETTINGS_UPDATED",
    HOLIDAY_ADDED = "HOLIDAY_ADDED",
    HOLIDAY_REMOVED = "HOLIDAY_REMOVED",
    POLICY_UPDATED = "POLICY_UPDATED",
    
    // Security
    SUSPICIOUS_ACTIVITY = "SUSPICIOUS_ACTIVITY",
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
    CSRF_VIOLATION = "CSRF_VIOLATION",
    IP_BLOCKED = "IP_BLOCKED",
    UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS",
    
    // Data
    DATA_EXPORTED = "DATA_EXPORTED",
    DATA_DELETED = "DATA_DELETED",
    GDPR_REQUEST = "GDPR_REQUEST",
    
    // System
    SYSTEM_ERROR = "SYSTEM_ERROR",
    SYSTEM_MAINTENANCE = "SYSTEM_MAINTENANCE",
    BACKUP_CREATED = "BACKUP_CREATED",
    BACKUP_RESTORED = "BACKUP_RESTORED"
}

// Audit Log Input
interface AuditLogInput {
    action: AuditAction;
    actorId: string;
    actorType?: "user" | "system" | "ai";
    actorRole?: string;
    entityType: string;
    entityId: string;
    resourceName?: string;
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    decision?: string;
    decisionReason?: string;
    confidenceScore?: number;
    modelVersion?: string;
    rulesEvaluated?: string[];
    orgId: string;
}

// Generate integrity hash for tamper-proof logging
function generateIntegrityHash(data: Record<string, unknown>): string {
    const sortedData = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(sortedData).digest('hex');
}

// Get previous log hash for chain integrity
async function getPreviousLogHash(orgId: string): Promise<string | null> {
    const lastLog = await prisma.auditLog.findFirst({
        where: { target_org: orgId },
        orderBy: { created_at: 'desc' },
        select: { integrity_hash: true }
    });
    return lastLog?.integrity_hash || null;
}

// Main audit logging function
export async function logAudit(input: AuditLogInput): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const requestId = input.requestId || crypto.randomUUID();
        
        // Get previous hash for chain integrity
        const prevHash = await getPreviousLogHash(input.orgId);
        
        // Prepare log data - cast to Prisma-compatible JSON types
        const logData = {
            actor_type: input.actorType || "user",
            actor_id: input.actorId,
            actor_role: input.actorRole,
            action: input.action,
            entity_type: input.entityType,
            entity_id: input.entityId,
            resource_name: input.resourceName,
            previous_state: input.previousState ? JSON.parse(JSON.stringify(input.previousState)) : null,
            new_state: input.newState ? JSON.parse(JSON.stringify(input.newState)) : null,
            details: input.details ? JSON.parse(JSON.stringify(input.details)) : null,
            ip_address: input.ipAddress,
            user_agent: input.userAgent,
            request_id: requestId,
            decision: input.decision,
            decision_reason: input.decisionReason,
            confidence_score: input.confidenceScore,
            model_version: input.modelVersion,
            rules_evaluated: input.rulesEvaluated ? JSON.parse(JSON.stringify(input.rulesEvaluated)) : null,
            target_org: input.orgId,
            prev_hash: prevHash
        };
        
        // Generate integrity hash
        const integrityHash = generateIntegrityHash(logData as Record<string, unknown>);
        
        // Create audit log
        const log = await prisma.auditLog.create({
            data: {
                ...logData,
                integrity_hash: integrityHash
            }
        });
        
        return { success: true, id: log.id };
        
    } catch (error) {
        console.error("Audit Log Error:", error);
        return { success: false, error: "Failed to create audit log" };
    }
}

// Query audit logs with filters
export async function queryAuditLogs(filters: {
    orgId: string;
    actorId?: string;
    action?: AuditAction;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
}) {
    try {
        const where: Record<string, unknown> = {
            target_org: filters.orgId
        };
        
        if (filters.actorId) where.actor_id = filters.actorId;
        if (filters.action) where.action = filters.action;
        if (filters.entityType) where.entity_type = filters.entityType;
        if (filters.entityId) where.entity_id = filters.entityId;
        
        if (filters.startDate || filters.endDate) {
            where.created_at = {};
            if (filters.startDate) (where.created_at as Record<string, Date>).gte = filters.startDate;
            if (filters.endDate) (where.created_at as Record<string, Date>).lte = filters.endDate;
        }
        
        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { created_at: 'desc' },
                take: filters.limit || 50,
                skip: filters.offset || 0,
                include: {
                    actor: {
                        select: {
                            full_name: true,
                            email: true,
                            role: true
                        }
                    }
                }
            }),
            prisma.auditLog.count({ where })
        ]);
        
        return { success: true, logs, total };
        
    } catch (error) {
        console.error("Query Audit Logs Error:", error);
        return { success: false, error: "Failed to query audit logs" };
    }
}

// Verify audit log chain integrity
export async function verifyAuditIntegrity(orgId: string): Promise<{
    success: boolean;
    isValid: boolean;
    invalidLogs?: string[];
    error?: string;
}> {
    try {
        const logs = await prisma.auditLog.findMany({
            where: { target_org: orgId },
            orderBy: { created_at: 'asc' }
        });
        
        const invalidLogs: string[] = [];
        
        for (let i = 0; i < logs.length; i++) {
            const log = logs[i];
            
            // Verify chain linkage
            if (i > 0 && log.prev_hash !== logs[i - 1].integrity_hash) {
                invalidLogs.push(log.id);
            }
            
            // Verify integrity hash
            const logData = {
                actor_type: log.actor_type,
                actor_id: log.actor_id,
                actor_role: log.actor_role,
                action: log.action,
                entity_type: log.entity_type,
                entity_id: log.entity_id,
                resource_name: log.resource_name,
                previous_state: log.previous_state,
                new_state: log.new_state,
                details: log.details,
                ip_address: log.ip_address,
                user_agent: log.user_agent,
                request_id: log.request_id,
                decision: log.decision,
                decision_reason: log.decision_reason,
                confidence_score: log.confidence_score,
                model_version: log.model_version,
                rules_evaluated: log.rules_evaluated,
                target_org: log.target_org,
                prev_hash: log.prev_hash
            };
            
            const expectedHash = generateIntegrityHash(logData as Record<string, unknown>);
            if (log.integrity_hash !== expectedHash) {
                invalidLogs.push(log.id);
            }
        }
        
        return {
            success: true,
            isValid: invalidLogs.length === 0,
            invalidLogs: invalidLogs.length > 0 ? invalidLogs : undefined
        };
        
    } catch (error) {
        console.error("Verify Audit Integrity Error:", error);
        return { success: false, isValid: false, error: "Failed to verify audit integrity" };
    }
}

// Get audit statistics
export async function getAuditStats(orgId: string, days: number = 30) {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const logs = await prisma.auditLog.findMany({
            where: {
                target_org: orgId,
                created_at: { gte: startDate }
            },
            select: {
                action: true,
                actor_type: true,
                entity_type: true,
                created_at: true
            }
        });
        
        // Group by action
        const actionCounts: Record<string, number> = {};
        const entityCounts: Record<string, number> = {};
        const dailyCounts: Record<string, number> = {};
        
        logs.forEach(log => {
            // Action counts
            actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
            
            // Entity counts
            entityCounts[log.entity_type] = (entityCounts[log.entity_type] || 0) + 1;
            
            // Daily counts
            const date = log.created_at.toISOString().split('T')[0];
            dailyCounts[date] = (dailyCounts[date] || 0) + 1;
        });
        
        // Security events
        const securityEvents = logs.filter(l => 
            l.action.includes('SUSPICIOUS') || 
            l.action.includes('BLOCKED') ||
            l.action.includes('VIOLATION') ||
            l.action.includes('UNAUTHORIZED')
        ).length;
        
        // AI decisions
        const aiDecisions = logs.filter(l => l.actor_type === 'ai').length;
        
        return {
            success: true,
            stats: {
                totalLogs: logs.length,
                actionBreakdown: actionCounts,
                entityBreakdown: entityCounts,
                dailyActivity: dailyCounts,
                securityEvents,
                aiDecisions,
                period: { startDate, endDate: new Date() }
            }
        };
        
    } catch (error) {
        console.error("Get Audit Stats Error:", error);
        return { success: false, error: "Failed to get audit statistics" };
    }
}
