import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

/**
 * Debug endpoint to diagnose onboarding issues
 * Access: /api/debug/onboarding
 * 
 * Checks:
 * 1. Environment variables configured
 * 2. Database connection
 * 3. Clerk auth working
 * 4. User record exists
 */
export async function GET(request: NextRequest) {
    const checks: Record<string, { status: string; details?: string }> = {};

    // 1. Check environment variables (without exposing values)
    checks.database_url = {
        status: process.env.DATABASE_URL ? "✅ SET" : "❌ MISSING",
        details: process.env.DATABASE_URL ? 
            `postgresql://*****@${process.env.DATABASE_URL.split('@')[1]?.substring(0, 30) || 'unknown'}...` : 
            "DATABASE_URL environment variable is not set"
    };

    checks.direct_url = {
        status: process.env.DIRECT_URL ? "✅ SET" : "⚠️ MISSING (optional)",
    };

    checks.clerk_secret = {
        status: process.env.CLERK_SECRET_KEY ? "✅ SET" : "❌ MISSING",
    };

    checks.clerk_publishable = {
        status: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "✅ SET" : "❌ MISSING",
    };

    // 2. Check database connection
    try {
        const start = Date.now();
        await prisma.$queryRaw`SELECT 1 as test`;
        const latency = Date.now() - start;
        checks.database_connection = {
            status: "✅ CONNECTED",
            details: `Latency: ${latency}ms`
        };
    } catch (error: any) {
        checks.database_connection = {
            status: "❌ FAILED",
            details: error?.message || "Unknown database error"
        };
    }

    // 3. Check Clerk authentication
    try {
        const user = await currentUser();
        if (user) {
            checks.clerk_auth = {
                status: "✅ AUTHENTICATED",
                details: `User: ${user.emailAddresses[0]?.emailAddress || 'no email'}`
            };

            // 4. Check if user exists in database
            try {
                const employee = await prisma.employee.findUnique({
                    where: { clerk_id: user.id },
                    select: { 
                        emp_id: true, 
                        email: true, 
                        onboarding_status: true,
                        org_id: true 
                    }
                });

                if (employee) {
                    checks.user_record = {
                        status: "✅ EXISTS",
                        details: `ID: ${employee.emp_id}, Status: ${employee.onboarding_status || 'unknown'}, Org: ${employee.org_id || 'none'}`
                    };
                } else {
                    checks.user_record = {
                        status: "⚠️ NOT FOUND",
                        details: "User authenticated but no employee record exists. This is normal for new users."
                    };
                }
            } catch (error: any) {
                checks.user_record = {
                    status: "❌ QUERY FAILED",
                    details: error?.message
                };
            }
        } else {
            checks.clerk_auth = {
                status: "⚠️ NOT AUTHENTICATED",
                details: "No user session. Login required to test full flow."
            };
        }
    } catch (error: any) {
        checks.clerk_auth = {
            status: "❌ ERROR",
            details: error?.message
        };
    }

    // Count critical issues
    const criticalIssues = Object.values(checks).filter(c => c.status.includes("❌")).length;
    const warnings = Object.values(checks).filter(c => c.status.includes("⚠️")).length;

    return NextResponse.json({
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        vercel: process.env.VERCEL ? "yes" : "no",
        summary: criticalIssues > 0 
            ? `❌ ${criticalIssues} critical issue(s) found` 
            : warnings > 0 
                ? `⚠️ ${warnings} warning(s)` 
                : "✅ All checks passed",
        checks
    }, { status: criticalIssues > 0 ? 500 : 200 });
}
