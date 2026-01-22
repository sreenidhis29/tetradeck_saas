"use server";

import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";
import { queryAuditLogs, getAuditStats, verifyAuditIntegrity, AuditAction } from "@/lib/audit";

// Verify admin access
async function verifyAdminAccess() {
    const user = await currentUser();
    if (!user) return { success: false, error: "Unauthorized" };
    
    const employee = await prisma.employee.findUnique({
        where: { clerk_id: user.id },
        select: { emp_id: true, role: true, org_id: true }
    });
    
    if (!employee || employee.role !== 'admin') {
        return { success: false, error: "Admin access required" };
    }
    
    return { success: true, employee };
}

// Compliance Dashboard Data
export interface ComplianceDashboardData {
    // Audit Trail Health
    auditIntegrity: {
        isValid: boolean;
        lastChecked: Date;
        invalidLogs: number;
    };
    // Activity Summary
    activitySummary: {
        totalLogs: number;
        securityEvents: number;
        aiDecisions: number;
        lastActivityAt: Date | null;
    };
    // Data Retention
    dataRetention: {
        logsOlderThan90Days: number;
        pendingDeletion: number;
        lastCleanup: Date | null;
    };
    // GDPR Status
    gdprStatus: {
        pendingRequests: number;
        completedThisMonth: number;
        avgResponseTime: string;
    };
    // Security Posture
    securityPosture: {
        failedLogins: number;
        blockedIPs: number;
        csrfViolations: number;
        rateLimitHits: number;
    };
    // Compliance Score
    complianceScore: number;
    issues: ComplianceIssue[];
}

export interface ComplianceIssue {
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    title: string;
    description: string;
    recommendation: string;
    createdAt: Date;
}

// Get compliance dashboard data
export async function getComplianceDashboard(): Promise<{ success: boolean; data?: ComplianceDashboardData; error?: string }> {
    const authResult = await verifyAdminAccess();
    if (!authResult.success) return authResult;
    
    const { employee } = authResult;
    const orgId = employee!.org_id || 'default';

    try {
        // Check audit integrity
        const integrityResult = await verifyAuditIntegrity(orgId);
        
        // Get audit stats
        const statsResult = await getAuditStats(orgId, 30);
        
        // Count old logs
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const oldLogsCount = await prisma.auditLog.count({
            where: {
                target_org: orgId,
                created_at: { lt: ninetyDaysAgo }
            }
        });

        // Get security-related logs
        const securityLogs = await prisma.auditLog.findMany({
            where: {
                target_org: orgId,
                action: {
                    in: [
                        'LOGIN_FAILED',
                        'IP_BLOCKED',
                        'CSRF_VIOLATION',
                        'RATE_LIMIT_EXCEEDED',
                        'UNAUTHORIZED_ACCESS'
                    ]
                },
                created_at: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
            }
        });

        // Count security events by type
        const failedLogins = securityLogs.filter(l => l.action === 'LOGIN_FAILED').length;
        const blockedIPs = securityLogs.filter(l => l.action === 'IP_BLOCKED').length;
        const csrfViolations = securityLogs.filter(l => l.action === 'CSRF_VIOLATION').length;
        const rateLimitHits = securityLogs.filter(l => l.action === 'RATE_LIMIT_EXCEEDED').length;

        // Get last activity
        const lastActivity = await prisma.auditLog.findFirst({
            where: { target_org: orgId },
            orderBy: { created_at: 'desc' },
            select: { created_at: true }
        });

        // Generate compliance issues
        const issues: ComplianceIssue[] = [];

        if (!integrityResult.isValid) {
            issues.push({
                id: 'audit-integrity',
                severity: 'critical',
                category: 'Audit Trail',
                title: 'Audit Log Integrity Compromised',
                description: `${integrityResult.invalidLogs?.length || 0} audit log entries have invalid integrity hashes.`,
                recommendation: 'Investigate potential tampering and restore from backup if necessary.',
                createdAt: new Date()
            });
        }

        if (oldLogsCount > 10000) {
            issues.push({
                id: 'data-retention',
                severity: 'medium',
                category: 'Data Retention',
                title: 'Large Volume of Old Audit Logs',
                description: `${oldLogsCount} logs older than 90 days need review.`,
                recommendation: 'Review data retention policy and archive or delete old logs.',
                createdAt: new Date()
            });
        }

        if (failedLogins > 50) {
            issues.push({
                id: 'brute-force',
                severity: 'high',
                category: 'Security',
                title: 'Excessive Failed Login Attempts',
                description: `${failedLogins} failed login attempts in the last 30 days.`,
                recommendation: 'Investigate potential brute force attacks and implement stronger authentication.',
                createdAt: new Date()
            });
        }

        if (rateLimitHits > 100) {
            issues.push({
                id: 'rate-limit',
                severity: 'medium',
                category: 'Security',
                title: 'High Rate Limit Violations',
                description: `${rateLimitHits} rate limit violations in the last 30 days.`,
                recommendation: 'Review API usage patterns and adjust rate limits if needed.',
                createdAt: new Date()
            });
        }

        // Calculate compliance score (0-100)
        let complianceScore = 100;
        issues.forEach(issue => {
            switch (issue.severity) {
                case 'critical': complianceScore -= 25; break;
                case 'high': complianceScore -= 15; break;
                case 'medium': complianceScore -= 10; break;
                case 'low': complianceScore -= 5; break;
            }
        });
        complianceScore = Math.max(0, complianceScore);

        const dashboardData: ComplianceDashboardData = {
            auditIntegrity: {
                isValid: integrityResult.isValid,
                lastChecked: new Date(),
                invalidLogs: integrityResult.invalidLogs?.length || 0
            },
            activitySummary: {
                totalLogs: statsResult.success && 'stats' in statsResult && statsResult.stats ? statsResult.stats.totalLogs : 0,
                securityEvents: statsResult.success && 'stats' in statsResult && statsResult.stats ? statsResult.stats.securityEvents : 0,
                aiDecisions: statsResult.success && 'stats' in statsResult && statsResult.stats ? statsResult.stats.aiDecisions : 0,
                lastActivityAt: lastActivity?.created_at || null
            },
            dataRetention: {
                logsOlderThan90Days: oldLogsCount,
                pendingDeletion: 0,
                lastCleanup: null
            },
            gdprStatus: {
                pendingRequests: 0,
                completedThisMonth: 0,
                avgResponseTime: 'N/A'
            },
            securityPosture: {
                failedLogins,
                blockedIPs,
                csrfViolations,
                rateLimitHits
            },
            complianceScore,
            issues
        };

        return { success: true, data: dashboardData };

    } catch (error) {
        console.error("Get Compliance Dashboard Error:", error);
        return { success: false, error: "Failed to load compliance dashboard" };
    }
}

// Get audit logs with filtering
export async function getAuditLogs(filters: {
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
}) {
    const authResult = await verifyAdminAccess();
    if (!authResult.success) return authResult;
    
    const { employee } = authResult;

    try {
        const result = await queryAuditLogs({
            orgId: employee!.org_id || 'default',
            action: filters.action as AuditAction | undefined,
            entityType: filters.entityType,
            startDate: filters.startDate ? new Date(filters.startDate) : undefined,
            endDate: filters.endDate ? new Date(filters.endDate) : undefined,
            limit: filters.limit || 50,
            offset: filters.offset || 0
        });

        return result;

    } catch (error) {
        console.error("Get Audit Logs Error:", error);
        return { success: false, error: "Failed to fetch audit logs" };
    }
}

// Run data integrity check
export async function runIntegrityCheck() {
    const authResult = await verifyAdminAccess();
    if (!authResult.success) return authResult;
    
    const { employee } = authResult;

    try {
        const result = await verifyAuditIntegrity(employee!.org_id || 'default');
        return result;

    } catch (error) {
        console.error("Run Integrity Check Error:", error);
        return { success: false, error: "Failed to run integrity check" };
    }
}

// Get SLA compliance metrics
export async function getSLAMetrics() {
    const authResult = await verifyAdminAccess();
    if (!authResult.success) return authResult;
    
    const { employee } = authResult;

    try {
        // Get leave requests with SLA data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const leaveRequests = await prisma.leaveRequest.findMany({
            where: {
                employee: { org_id: employee!.org_id },
                created_at: { gte: thirtyDaysAgo }
            },
            select: {
                request_id: true,
                status: true,
                sla_deadline: true,
                sla_breached: true,
                created_at: true,
                updated_at: true
            }
        });

        const totalRequests = leaveRequests.length;
        const breachedCount = leaveRequests.filter(r => r.sla_breached).length;
        const pendingCount = leaveRequests.filter(r => r.status === 'pending' || r.status === 'escalated').length;
        
        // Calculate average response time
        const resolvedRequests = leaveRequests.filter(r => 
            r.status === 'approved' || r.status === 'rejected'
        );
        
        let avgResponseTimeHours = 0;
        if (resolvedRequests.length > 0) {
            const totalHours = resolvedRequests.reduce((sum, r) => {
                const diff = new Date(r.updated_at).getTime() - new Date(r.created_at).getTime();
                return sum + (diff / (1000 * 60 * 60));
            }, 0);
            avgResponseTimeHours = totalHours / resolvedRequests.length;
        }

        // SLA compliance rate
        const slaComplianceRate = totalRequests > 0 
            ? ((totalRequests - breachedCount) / totalRequests) * 100 
            : 100;

        return {
            success: true,
            metrics: {
                totalRequests,
                resolvedRequests: resolvedRequests.length,
                pendingRequests: pendingCount,
                slaBreaches: breachedCount,
                slaComplianceRate: slaComplianceRate.toFixed(1),
                avgResponseTimeHours: avgResponseTimeHours.toFixed(1),
                period: '30 days'
            }
        };

    } catch (error) {
        console.error("Get SLA Metrics Error:", error);
        return { success: false, error: "Failed to fetch SLA metrics" };
    }
}

// Export audit logs
export async function exportAuditLogs(format: 'csv' | 'json', days: number = 30) {
    const authResult = await verifyAdminAccess();
    if (!authResult.success) return authResult;
    
    const { employee } = authResult;

    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const logs = await prisma.auditLog.findMany({
            where: {
                target_org: employee!.org_id || 'default',
                created_at: { gte: startDate }
            },
            orderBy: { created_at: 'desc' },
            include: {
                actor: {
                    select: { full_name: true, email: true }
                }
            }
        });

        if (format === 'json') {
            return {
                success: true,
                data: JSON.stringify(logs, null, 2),
                filename: `audit-logs-${new Date().toISOString().split('T')[0]}.json`,
                contentType: 'application/json'
            };
        }

        // CSV format
        const headers = [
            'Timestamp',
            'Action',
            'Actor',
            'Actor Email',
            'Entity Type',
            'Entity ID',
            'IP Address',
            'Decision',
            'Details'
        ].join(',');

        const rows = logs.map(log => [
            log.created_at.toISOString(),
            log.action,
            `"${log.actor?.full_name || 'System'}"`,
            `"${log.actor?.email || 'N/A'}"`,
            log.entity_type,
            log.entity_id,
            log.ip_address || 'N/A',
            log.decision || 'N/A',
            `"${JSON.stringify(log.details || {}).replace(/"/g, '""')}"`
        ].join(','));

        return {
            success: true,
            data: [headers, ...rows].join('\n'),
            filename: `audit-logs-${new Date().toISOString().split('T')[0]}.csv`,
            contentType: 'text/csv'
        };

    } catch (error) {
        console.error("Export Audit Logs Error:", error);
        return { success: false, error: "Failed to export audit logs" };
    }
}
