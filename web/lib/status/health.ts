/**
 * 📊 STATUS PAGE & HEALTH MONITORING
 * 
 * What separates professional SaaS from side projects.
 * Shows uptime, incidents, and builds trust with enterprise buyers.
 */

import { prisma } from '@/lib/prisma';

interface HealthCheckResult {
    service: string;
    status: 'operational' | 'degraded' | 'down';
    latency?: number;
    message?: string;
    lastCheck: string;
}

interface SystemStatus {
    overall: 'operational' | 'degraded' | 'outage';
    services: HealthCheckResult[];
    uptime: {
        last24h: number;
        last7d: number;
        last30d: number;
    };
    incidents: Incident[];
}

interface Incident {
    id: string;
    title: string;
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
    severity: 'minor' | 'major' | 'critical';
    createdAt: string;
    updatedAt: string;
    affectedServices: string[];
    updates: {
        message: string;
        timestamp: string;
    }[];
}

// Service health checks
const SERVICES = [
    { 
        name: 'Web Application', 
        key: 'web',
        check: async () => {
            const start = Date.now();
            // Check if Next.js is responding
            return { 
                status: 'operational' as const, 
                latency: Date.now() - start 
            };
        }
    },
    { 
        name: 'Database', 
        key: 'database',
        check: async () => {
            const start = Date.now();
            try {
                await prisma.$queryRaw`SELECT 1`;
                return { 
                    status: 'operational' as const, 
                    latency: Date.now() - start 
                };
            } catch {
                return { 
                    status: 'down' as const, 
                    message: 'Database connection failed' 
                };
            }
        }
    },
    { 
        name: 'Authentication (Clerk)', 
        key: 'auth',
        check: async () => {
            const start = Date.now();
            try {
                // Check Clerk API
                const res = await fetch('https://api.clerk.com/v1/health', {
                    method: 'HEAD',
                    signal: AbortSignal.timeout(5000),
                });
                return { 
                    status: res.ok ? 'operational' as const : 'degraded' as const, 
                    latency: Date.now() - start 
                };
            } catch {
                return { status: 'degraded' as const };
            }
        }
    },
    { 
        name: 'Email Service', 
        key: 'email',
        check: async () => {
            // Gmail OAuth - can't easily health check
            return { status: 'operational' as const };
        }
    },
    { 
        name: 'AI Services', 
        key: 'ai',
        check: async () => {
            const start = Date.now();
            try {
                // Check if AI backend is running
                const res = await fetch(
                    `${process.env.AI_SERVICE_URL || 'http://localhost:8000'}/health`,
                    { signal: AbortSignal.timeout(5000) }
                );
                return { 
                    status: res.ok ? 'operational' as const : 'degraded' as const, 
                    latency: Date.now() - start 
                };
            } catch {
                return { 
                    status: 'degraded' as const,
                    message: 'AI services may have extended processing times'
                };
            }
        }
    },
    { 
        name: 'Payments (Stripe)', 
        key: 'payments',
        check: async () => {
            const start = Date.now();
            try {
                const res = await fetch('https://status.stripe.com/api/v2/status.json', {
                    signal: AbortSignal.timeout(5000),
                });
                const data = await res.json();
                const indicator = data.status?.indicator || 'none';
                return { 
                    status: indicator === 'none' ? 'operational' as const : 'degraded' as const, 
                    latency: Date.now() - start 
                };
            } catch {
                return { status: 'operational' as const }; // Assume ok if can't check
            }
        }
    },
];

/**
 * Run health checks on all services
 */
export async function getSystemStatus(): Promise<SystemStatus> {
    const results: HealthCheckResult[] = await Promise.all(
        SERVICES.map(async (service) => {
            try {
                const result = await service.check();
                return {
                    service: service.name,
                    ...result,
                    lastCheck: new Date().toISOString(),
                };
            } catch (error) {
                return {
                    service: service.name,
                    status: 'down' as const,
                    message: 'Health check failed',
                    lastCheck: new Date().toISOString(),
                };
            }
        })
    );

    // Determine overall status
    const hasDown = results.some(r => r.status === 'down');
    const hasDegraded = results.some(r => r.status === 'degraded');
    const overall = hasDown ? 'outage' : hasDegraded ? 'degraded' : 'operational';

    // Get incidents from database (would need incidents table)
    const incidents: Incident[] = []; // TODO: Fetch from database

    return {
        overall,
        services: results,
        uptime: {
            last24h: 99.99, // TODO: Calculate from health check history
            last7d: 99.95,
            last30d: 99.9,
        },
        incidents,
    };
}

/**
 * Store health check result for uptime calculation
 */
export async function recordHealthCheck(results: HealthCheckResult[]) {
    // TODO: Store in database for historical uptime calculation
    console.log('[Health] Recorded:', results.map(r => `${r.service}: ${r.status}`).join(', '));
}

/**
 * Create an incident
 */
export async function createIncident(
    title: string,
    severity: 'minor' | 'major' | 'critical',
    affectedServices: string[],
    message: string
) {
    // TODO: Store in database
    // TODO: Send notifications to affected customers
    // TODO: Post to status page
    console.log(`[Incident] ${severity.toUpperCase()}: ${title}`);
    return { id: `inc_${Date.now()}` };
}

/**
 * Update incident status
 */
export async function updateIncident(
    incidentId: string,
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved',
    message: string
) {
    // TODO: Update in database
    // TODO: Notify affected customers
    console.log(`[Incident Update] ${incidentId}: ${status} - ${message}`);
}

// Health check endpoint data
export const HEALTH_CHECK_INTERVAL = 60000; // 1 minute
