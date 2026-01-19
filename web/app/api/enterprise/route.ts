/**
 * Enterprise System Health & Monitoring API
 * 
 * GET /api/enterprise/health - Get comprehensive system health status
 * GET /api/enterprise/metrics - Get observability metrics
 * POST /api/enterprise/backup - Trigger manual backup
 * GET /api/enterprise/backup - List backups
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import {
    performHealthCheck,
    getSystemHealthStatus,
    getDashboardMetrics,
    createFullBackup,
    listBackups,
    getBackupStats,
    getAllFeatureFlags,
    getComplianceStatus,
    getAllModels,
    getDecisionStats
} from "@/lib/enterprise";

// Verify admin access
async function verifyAdminAccess(): Promise<{ authorized: boolean; userId?: string; error?: string }> {
    const { userId } = await auth();
    if (!userId) {
        return { authorized: false, error: "Unauthorized" };
    }
    
    const employee = await prisma.employee.findUnique({
        where: { clerk_id: userId },
        select: { role: true }
    });
    
    if (!employee || !['admin', 'hr'].includes(employee.role || '')) {
        return { authorized: false, error: "Insufficient permissions" };
    }
    
    return { authorized: true, userId };
}

/**
 * GET - Comprehensive system health and status
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'health';
    
    try {
        // Health endpoint is public (for monitoring)
        if (view === 'health') {
            const health = await performHealthCheck();
            return NextResponse.json({
                status: health.overall,
                timestamp: health.timestamp,
                uptime: health.uptime,
                checks: health.checks
            });
        }
        
        // Other views require admin access
        const access = await verifyAdminAccess();
        if (!access.authorized) {
            return NextResponse.json({ error: access.error }, { status: 401 });
        }
        
        switch (view) {
            case 'status': {
                const [health, systemHealth] = await Promise.all([
                    performHealthCheck(),
                    getSystemHealthStatus()
                ]);
                
                return NextResponse.json({
                    overall: systemHealth.status,
                    health: {
                        status: health.overall,
                        uptime: health.uptime,
                        checks: health.checks
                    },
                    system: {
                        activeFailures: systemHealth.activeFailures,
                        degradedFeatures: systemHealth.degradedFeatures,
                        components: systemHealth.components
                    },
                    timestamp: new Date()
                });
            }
            
            case 'metrics': {
                const period = (searchParams.get('period') || '24h') as '1h' | '24h' | '7d' | '30d';
                const metrics = getDashboardMetrics(period);
                
                return NextResponse.json({
                    period,
                    timestamp: metrics.timestamp,
                    requests: metrics.requests,
                    errors: metrics.errors,
                    database: metrics.database,
                    business: metrics.business
                });
            }
            
            case 'backups': {
                const backups = listBackups();
                const stats = getBackupStats();
                
                return NextResponse.json({
                    stats,
                    backups: backups.slice(0, 20) // Last 20 backups
                });
            }
            
            case 'features': {
                const flags = getAllFeatureFlags();
                
                return NextResponse.json({
                    featureFlags: flags,
                    total: flags.length,
                    enabled: flags.filter(f => f.enabled).length
                });
            }
            
            case 'compliance': {
                const status = getComplianceStatus();
                
                return NextResponse.json({
                    compliance: status,
                    policies: status.retentionPolicies
                });
            }
            
            case 'ai': {
                const models = getAllModels();
                const stats = getDecisionStats();
                
                return NextResponse.json({
                    models,
                    stats,
                    timestamp: new Date()
                });
            }
            
            case 'full': {
                // Full enterprise status - all data
                const [health, systemHealth, metrics, backupStats, compliance, aiStats] = await Promise.all([
                    performHealthCheck(),
                    getSystemHealthStatus(),
                    getDashboardMetrics('24h'),
                    getBackupStats(),
                    getComplianceStatus(),
                    getDecisionStats()
                ]);
                
                return NextResponse.json({
                    timestamp: new Date(),
                    environment: process.env.NODE_ENV,
                    version: process.env.npm_package_version || '1.0.0',
                    status: systemHealth.status,
                    
                    health: {
                        overall: health.overall,
                        uptime: health.uptime,
                        checkCount: health.checks.length
                    },
                    
                    system: {
                        activeFailures: systemHealth.activeFailures.length,
                        degradedFeatures: systemHealth.degradedFeatures.length
                    },
                    
                    metrics: {
                        totalRequests: metrics.requests.total,
                        errorRate: metrics.requests.total > 0 
                            ? metrics.errors.total / metrics.requests.total 
                            : 0,
                        avgLatency: metrics.requests.avgDurationMs
                    },
                    
                    backups: {
                        total: backupStats.totalBackups,
                        lastBackup: backupStats.newestBackup
                    },
                    
                    compliance: {
                        pendingRequests: compliance.dataSubjectRequests.pending
                    },
                    
                    ai: {
                        totalDecisions: aiStats.totalDecisions,
                        avgConfidence: Math.round(aiStats.avgConfidence * 100) + '%'
                    }
                });
            }
            
            default:
                return NextResponse.json({ error: "Invalid view parameter" }, { status: 400 });
        }
        
    } catch (error) {
        console.error("[Enterprise API] Error:", error);
        return NextResponse.json(
            { error: "Internal server error", message: (error as Error).message },
            { status: 500 }
        );
    }
}

/**
 * POST - Execute enterprise operations (backup, etc.)
 */
export async function POST(req: NextRequest) {
    const access = await verifyAdminAccess();
    if (!access.authorized) {
        return NextResponse.json({ error: access.error }, { status: 401 });
    }
    
    try {
        const body = await req.json();
        const { action } = body;
        
        switch (action) {
            case 'backup': {
                const backup = await createFullBackup({
                    retentionDays: body.retentionDays || 30,
                    verifyAfterBackup: true
                });
                
                return NextResponse.json({
                    success: true,
                    message: "Backup created successfully",
                    backup: {
                        id: backup.id,
                        type: backup.type,
                        tables: backup.tables.length,
                        sizeBytes: backup.sizeBytes,
                        status: backup.status,
                        checksum: backup.checksum
                    }
                });
            }
            
            default:
                return NextResponse.json({ error: "Unknown action" }, { status: 400 });
        }
        
    } catch (error) {
        console.error("[Enterprise API] POST Error:", error);
        return NextResponse.json(
            { error: "Operation failed", message: (error as Error).message },
            { status: 500 }
        );
    }
}
