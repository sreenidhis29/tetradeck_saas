import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

interface ServiceHealthResult {
    name: string;
    description: string;
    endpoint: string;
    status: 'online' | 'offline' | 'degraded';
    responseTime: number | null;
    version: string | null;
    details: Record<string, any>;
    lastCheck: string;
}

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Define AI services to check
        const services = [
            {
                name: "Leave Constraint Engine",
                description: "Evaluates leave requests against company policies and team constraints",
                endpoint: "http://127.0.0.1:8001/health"
            },
            {
                name: "Attendance Reminder Service",
                description: "Sends automated check-in/out reminders to employees",
                endpoint: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/attendance/reminder`
            }
        ];

        const results: ServiceHealthResult[] = [];

        for (const service of services) {
            const startTime = Date.now();
            let result: ServiceHealthResult = {
                ...service,
                status: 'offline',
                responseTime: null,
                version: null,
                details: {},
                lastCheck: new Date().toISOString()
            };

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const response = await fetch(service.endpoint, {
                    method: 'GET',
                    signal: controller.signal,
                    cache: 'no-store'
                });

                clearTimeout(timeoutId);
                const responseTime = Date.now() - startTime;

                if (response.ok) {
                    const data = await response.json().catch(() => ({}));
                    result = {
                        ...service,
                        status: responseTime > 2000 ? 'degraded' : 'online',
                        responseTime,
                        version: data.version || data.model_version || 'v1.0',
                        details: {
                            total_rules: data.total_rules,
                            database: data.database,
                            schedule: data.schedule,
                            ...data
                        },
                        lastCheck: new Date().toISOString()
                    };
                } else {
                    result = {
                        ...service,
                        status: 'degraded',
                        responseTime,
                        version: null,
                        details: { error: `HTTP ${response.status}` },
                        lastCheck: new Date().toISOString()
                    };
                }
            } catch (error) {
                result = {
                    ...service,
                    status: 'offline',
                    responseTime: null,
                    version: null,
                    details: { 
                        error: error instanceof Error 
                            ? (error.name === 'AbortError' ? 'Request timeout' : error.message)
                            : 'Connection failed' 
                    },
                    lastCheck: new Date().toISOString()
                };
            }

            results.push(result);
        }

        // Calculate summary
        const summary = {
            total: results.length,
            online: results.filter(r => r.status === 'online').length,
            degraded: results.filter(r => r.status === 'degraded').length,
            offline: results.filter(r => r.status === 'offline').length
        };

        return NextResponse.json({
            services: results,
            summary,
            checkedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("AI services health check error:", error);
        return NextResponse.json(
            { error: "Failed to check AI services" },
            { status: 500 }
        );
    }
}
