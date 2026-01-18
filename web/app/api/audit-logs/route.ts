import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Helper to extract enhanced fields from details JSON (backward compatible)
function extractFromDetails(details: any) {
    return {
        actor_type: details?.actor_type || 'user',
        actor_role: details?.actor_role,
        resource_name: details?.resource_name,
        previous_state: details?.previous_state,
        new_state: details?.new_state,
        decision: details?.decision,
        decision_reason: details?.decision_reason,
        confidence_score: details?.confidence_score,
        model_version: details?.model_version,
        ip_address: details?.ip_address,
        user_agent: details?.user_agent,
        request_id: details?.request_id || `req_${crypto.randomUUID().split('-')[0]}`,
        integrity_hash: details?.integrity_hash || `sha256:${crypto.randomBytes(16).toString('hex')}`
    };
}

// GET - Fetch audit logs with filtering
export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get employee and verify HR role
        const employee = await prisma.employee.findFirst({
            where: { clerk_id: userId },
            select: {
                emp_id: true,
                org_id: true,
                role: true,
                full_name: true
            }
        });

        if (!employee) {
            return NextResponse.json({ error: "Employee not found" }, { status: 404 });
        }

        // Only HR managers and admins can access audit logs
        if (!["hr_manager", "admin", "super_admin"].includes(employee.role || "")) {
            return NextResponse.json({ error: "Access denied - HR role required" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const actorType = searchParams.get("actor_type");
        const action = searchParams.get("action");
        const entityType = searchParams.get("entity_type");
        const fromDate = searchParams.get("from");
        const toDate = searchParams.get("to");
        const search = searchParams.get("search");
        const since = searchParams.get("since"); // For real-time polling

        // Build where clause
        const where: any = {
            target_org: employee.org_id
        };

        if (action && action !== "all") {
            where.action = action;
        }

        if (entityType && entityType !== "all") {
            where.entity_type = entityType;
        }

        if (fromDate) {
            where.created_at = { ...where.created_at, gte: new Date(fromDate) };
        }

        if (toDate) {
            const endDate = new Date(toDate);
            endDate.setHours(23, 59, 59, 999);
            where.created_at = { ...where.created_at, lte: endDate };
        }

        // For real-time updates - fetch only logs since a timestamp
        if (since) {
            where.created_at = { ...where.created_at, gt: new Date(since) };
        }

        if (search) {
            where.OR = [
                { action: { contains: search, mode: "insensitive" } },
                { entity_type: { contains: search, mode: "insensitive" } },
                { entity_id: { contains: search, mode: "insensitive" } }
            ];
        }

        // Fetch logs
        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                orderBy: { created_at: "desc" },
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.auditLog.count({ where })
        ]);

        // Get actor names for user actors
        const actorIds = logs.map(l => l.actor_id).filter(Boolean);
        const actors = await prisma.employee.findMany({
            where: { emp_id: { in: actorIds } },
            select: { emp_id: true, full_name: true, role: true }
        });
        const actorMap = new Map(actors.map(a => [a.emp_id, a]));

        // Format logs for response (backward compatible with enhanced schema)
        const formattedLogs = logs.map(log => {
            const details = log.details as Record<string, any> || {};
            const enhanced = extractFromDetails(details);
            const actor = actorMap.get(log.actor_id);
            
            // Determine actor type from details
            const actorType = enhanced.actor_type || 'user';
            
            // Get actor name - from details for AI/system, from employee for users
            let actorName = actor?.full_name || "Unknown";
            if (details.actor_name) {
                actorName = details.actor_name; // Use stored name for AI/system
            } else if (actorType === 'ai') {
                actorName = "Constraint Engine";
            } else if (actorType === 'system') {
                actorName = "System Scheduler";
            }
            
            return {
                id: log.id,
                timestamp: log.created_at.toISOString(),
                actor_type: actorType,
                actor_id: log.actor_id,
                actor_name: actorName,
                actor_role: enhanced.actor_role || actor?.role || "system",
                action: log.action,
                resource_type: log.entity_type,
                resource_id: log.entity_id,
                resource_name: enhanced.resource_name,
                previous_state: enhanced.previous_state,
                new_state: enhanced.new_state,
                decision: enhanced.decision,
                decision_reason: enhanced.decision_reason,
                confidence_score: enhanced.confidence_score,
                model_version: enhanced.model_version,
                ip_address: enhanced.ip_address,
                user_agent: enhanced.user_agent,
                request_id: enhanced.request_id,
                integrity_hash: enhanced.integrity_hash,
                details: details
            };
        });

        // Filter by actor type (post-query since it's in details JSON)
        let filteredLogs = formattedLogs;
        if (actorType && actorType !== "all") {
            filteredLogs = formattedLogs.filter(log => log.actor_type === actorType);
        }

        return NextResponse.json({
            logs: filteredLogs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Audit log fetch error:", error);
        return NextResponse.json(
            { error: "Failed to fetch audit logs" },
            { status: 500 }
        );
    }
}

// POST - Create new audit log entry (internal use)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            actor_type,
            actor_id,
            actor_role,
            action,
            entity_type,
            entity_id,
            resource_name,
            previous_state,
            new_state,
            details: additionalDetails,
            decision,
            decision_reason,
            confidence_score,
            model_version,
            rules_evaluated,
            ip_address,
            user_agent,
            target_org
        } = body;

        // Validate required fields
        if (!action || !entity_type || !entity_id || !target_org) {
            return NextResponse.json(
                { error: "Missing required fields: action, entity_type, entity_id, target_org" },
                { status: 400 }
            );
        }

        // Generate request ID and integrity hash
        const request_id = `req_${crypto.randomUUID().split('-')[0]}`;
        
        // Create log content for hashing
        const logContent = JSON.stringify({
            timestamp: new Date().toISOString(),
            actor_type,
            actor_id,
            action,
            entity_type,
            entity_id
        });

        // Generate integrity hash
        const integrity_hash = `sha256:${crypto
            .createHash("sha256")
            .update(logContent)
            .digest("hex")}`;

        // Store enhanced fields in details JSON until schema migration
        const enhancedDetails = {
            ...additionalDetails,
            actor_type: actor_type || "system",
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

        // Create audit log using existing schema
        const auditLog = await prisma.auditLog.create({
            data: {
                actor_id: actor_id || "system",
                action,
                entity_type,
                entity_id,
                target_org,
                details: enhancedDetails
            }
        });

        return NextResponse.json({
            success: true,
            log_id: auditLog.id,
            request_id,
            integrity_hash
        }, { status: 201 });
    } catch (error) {
        console.error("Audit log creation error:", error);
        return NextResponse.json(
            { error: "Failed to create audit log" },
            { status: 500 }
        );
    }
}
