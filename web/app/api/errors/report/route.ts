import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSecurityHeaders, checkRateLimit, sanitizeString, applySecurityHeaders } from "@/lib/security";
import { headers as getHeaders } from "next/headers";

// Error Report Interface
interface ErrorReport {
    errorId: string;
    message: string;
    stack?: string;
    componentStack?: string;
    url: string;
    timestamp: string;
    userAgent: string;
}

// Helper to get client IP
async function getClientIP(): Promise<string> {
    const headersList = await getHeaders();
    return headersList.get('x-forwarded-for')?.split(',')[0] || 
           headersList.get('x-real-ip') || 
           'unknown';
}

export async function POST(request: NextRequest) {
    const secHeaders = getSecurityHeaders();
    const ip = await getClientIP();

    try {
        // Rate limiting
        const rateLimit = await checkRateLimit(request, { windowMs: 60000, maxRequests: 30 });
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: "Rate limit exceeded" },
                { status: 429, headers: secHeaders }
            );
        }

        const body: ErrorReport = await request.json();

        // Validate required fields
        if (!body.errorId || !body.message || !body.url) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400, headers: secHeaders }
            );
        }

        // Sanitize inputs (existing sanitizeString auto-limits to 10000 chars)
        const sanitizedReport = {
            errorId: sanitizeString(body.errorId).substring(0, 50),
            message: sanitizeString(body.message).substring(0, 1000),
            stack: body.stack ? sanitizeString(body.stack).substring(0, 5000) : null,
            componentStack: body.componentStack ? sanitizeString(body.componentStack).substring(0, 5000) : null,
            url: sanitizeString(body.url).substring(0, 500),
            timestamp: body.timestamp,
            userAgent: sanitizeString(body.userAgent).substring(0, 500),
            ip
        };

        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error('[Error Report]', sanitizedReport);
        }

        // In production, you would:
        // 1. Store in database
        // 2. Send to error tracking service (Sentry, etc.)
        // 3. Alert on critical errors

        // Store in audit log
        await prisma.auditLog.create({
            data: {
                actor_type: 'system',
                actor_id: 'error-reporter',
                action: 'CLIENT_ERROR',
                entity_type: 'Error',
                entity_id: sanitizedReport.errorId,
                details: JSON.parse(JSON.stringify(sanitizedReport)),
                ip_address: ip,
                user_agent: sanitizedReport.userAgent,
                target_org: 'system',
                request_id: crypto.randomUUID()
            }
        }).catch(err => {
            // Don't fail the request if logging fails
            console.error('Failed to log error to database:', err);
        });

        return NextResponse.json(
            { 
                success: true, 
                errorId: sanitizedReport.errorId,
                message: "Error reported successfully" 
            },
            { status: 200, headers: secHeaders }
        );

    } catch (error) {
        console.error('Error processing error report:', error);
        return NextResponse.json(
            { error: "Failed to process error report" },
            { status: 500, headers: secHeaders }
        );
    }
}

// Health check for error reporting endpoint
export async function GET() {
    const secHeaders = getSecurityHeaders();
    
    return NextResponse.json(
        { 
            status: "ok", 
            endpoint: "/api/errors/report",
            timestamp: new Date().toISOString()
        },
        { status: 200, headers: secHeaders }
    );
}
