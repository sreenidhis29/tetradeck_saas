import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSecurityHeaders } from "@/lib/security";

// Health Check Response
interface HealthCheck {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version: string;
    uptime: number;
    checks: {
        database: HealthStatus;
        memory: HealthStatus;
        disk: HealthStatus;
    };
    metrics?: {
        responseTime: number;
        activeConnections?: number;
        requestsPerMinute?: number;
    };
}

interface HealthStatus {
    status: 'pass' | 'warn' | 'fail';
    message?: string;
    latency?: number;
}

// Track start time for uptime calculation
const startTime = Date.now();

export async function GET(request: NextRequest) {
    const headers = getSecurityHeaders();
    const startCheck = Date.now();

    // Database health check
    let dbStatus: HealthStatus = { status: 'fail', message: 'Connection failed' };
    try {
        const dbStart = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        const dbLatency = Date.now() - dbStart;
        
        dbStatus = {
            status: dbLatency < 100 ? 'pass' : dbLatency < 500 ? 'warn' : 'fail',
            message: dbLatency < 100 ? 'Connection healthy' : 'High latency',
            latency: dbLatency
        };
    } catch (error) {
        dbStatus = {
            status: 'fail',
            message: error instanceof Error ? error.message : 'Unknown error'
        };
    }

    // Memory health check
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    const memoryStatus: HealthStatus = {
        status: heapUsagePercent < 70 ? 'pass' : heapUsagePercent < 90 ? 'warn' : 'fail',
        message: `${heapUsedMB}MB / ${heapTotalMB}MB (${heapUsagePercent.toFixed(1)}%)`
    };

    // Disk health check (placeholder - would use fs in real implementation)
    const diskStatus: HealthStatus = {
        status: 'pass',
        message: 'Disk space available'
    };

    // Calculate overall status
    const allChecks = [dbStatus, memoryStatus, diskStatus];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (allChecks.some(c => c.status === 'fail')) {
        overallStatus = 'unhealthy';
    } else if (allChecks.some(c => c.status === 'warn')) {
        overallStatus = 'degraded';
    }

    const responseTime = Date.now() - startCheck;

    const healthCheck: HealthCheck = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: Math.round((Date.now() - startTime) / 1000),
        checks: {
            database: dbStatus,
            memory: memoryStatus,
            disk: diskStatus
        },
        metrics: {
            responseTime
        }
    };

    // Return appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(healthCheck, { status: statusCode, headers });
}

// Liveness probe - simple check
export async function HEAD(request: NextRequest) {
    return new NextResponse(null, { status: 200 });
}
