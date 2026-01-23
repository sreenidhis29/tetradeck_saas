import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Backend connectivity check - No auth required
 * Tests: Database, AI Service, Environment
 */
export async function GET(request: NextRequest) {
    const checks: Record<string, any> = {};
    
    // 1. Environment Variables
    checks.env = {
        DATABASE_URL: process.env.DATABASE_URL ? "✅ SET" : "❌ MISSING",
        DIRECT_URL: process.env.DIRECT_URL ? "✅ SET" : "⚠️ MISSING",
        CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ? "✅ SET" : "❌ MISSING",
        AI_SERVICE_URL: process.env.AI_SERVICE_URL || "❌ MISSING",
        CONSTRAINT_ENGINE_URL: process.env.CONSTRAINT_ENGINE_URL || "❌ MISSING",
    };
    
    // 2. Database Connection
    try {
        const start = Date.now();
        await prisma.$queryRaw`SELECT 1`;
        checks.database = {
            status: "✅ CONNECTED",
            latency: `${Date.now() - start}ms`
        };
    } catch (error: any) {
        checks.database = {
            status: "❌ FAILED",
            error: error?.message || "Unknown error"
        };
    }
    
    // 3. AI Service Connection
    const aiUrl = process.env.AI_SERVICE_URL || process.env.CONSTRAINT_ENGINE_URL;
    if (aiUrl) {
        try {
            const start = Date.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const res = await fetch(`${aiUrl}/health`, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (res.ok) {
                const data = await res.json();
                checks.ai_service = {
                    status: "✅ CONNECTED",
                    latency: `${Date.now() - start}ms`,
                    response: data
                };
            } else {
                checks.ai_service = {
                    status: "⚠️ UNHEALTHY",
                    httpStatus: res.status
                };
            }
        } catch (error: any) {
            checks.ai_service = {
                status: "❌ UNREACHABLE",
                url: aiUrl,
                error: error?.name === 'AbortError' ? "Timeout (10s)" : error?.message
            };
        }
    } else {
        checks.ai_service = {
            status: "❌ NOT CONFIGURED",
            hint: "Set AI_SERVICE_URL or CONSTRAINT_ENGINE_URL env var"
        };
    }
    
    // Overall status
    const allPassing = 
        checks.database.status?.includes("✅") && 
        checks.ai_service.status?.includes("✅");
    
    return NextResponse.json({
        status: allPassing ? "healthy" : "issues_detected",
        timestamp: new Date().toISOString(),
        checks
    });
}
