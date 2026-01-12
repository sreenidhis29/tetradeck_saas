"use server";

import { prisma } from "@/lib/prisma";
import { currentUser } from "@clerk/nextjs/server";

export type AIAnalysisResult = {
    approved: boolean;
    message: string;
    violations: string[];
    suggestions: string[];
    confidence?: number;
};

export async function analyzeLeaveRequest(
    leaveDetails: {
        type: string;
        reason: string;
        startDate: string;
        endDate: string;
        days: number;
    }
) {
    const user = await currentUser();
    if (!user) return { error: "Unauthorized" };

    try {
        // 1. Fetch Context (Employee, Company, Policy, Team Stats)
        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            include: {
                company: {
                    include: { policies: true }
                }
            }
        });

        if (!employee || !employee.company) {
            return { error: "Employee not linked to company" };
        }

        // 2. Fetch or Calculate Team Stats (Mocked for now as we don't have full history Query built here)
        // In a real scenario, we'd query LeaveRequests where status=APPROVED and date overlaps.
        const teamState = {
            teamSize: 10, // Mock
            alreadyOnLeave: 1, // Mock
            min_coverage: 3,
            max_concurrent_leave: 2,
            blackoutDates: [] // Populate from policy if complex
        };

        // 3. Get Rules from Policy
        const activePolicy = employee.company.policies.find(p => p.is_active) || { rules: {} };
        const rules = activePolicy.rules as any;

        // Merge policy rules into team state if needed, or pass separately.
        // The Python agent expects `team_state` to contain coverage constraints.
        if (rules.min_coverage) teamState.min_coverage = rules.min_coverage;
        if (rules.max_concurrent) teamState.max_concurrent_leave = rules.max_concurrent;

        // 4. Construct Payload
        const payload = {
            text: leaveDetails.reason,
            employee_id: employee.emp_id,
            extracted_info: {
                type: leaveDetails.type,
                dates: [leaveDetails.startDate], // Python agent currently looks at 'dates' array or 'duration'
                duration: leaveDetails.days
            },
            team_state: {
                team: teamState,
                blackoutDates: rules.blackoutDates || []
            },
            leave_balance: {
                remaining: 12 // Mocked for now, or fetch from LeaveBalance table
            }
        };

        // 5. Call Python Agent
        // Assuming running on localhost:8001
        const agentUrl = (process.env.CONSTRAINT_ENGINE_URL || "http://127.0.0.1:8001") + "/analyze";

        let analysis: AIAnalysisResult;

        try {
            const response = await fetch(agentUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error(`Agent returned ${response.status}`);
            }

            analysis = await response.json();
        } catch (agentError) {
            console.error("AI Agent Unreachable:", agentError);
            // Fallback / Manual Review Mode
            return {
                fallback: true,
                message: "AI Agent unreachable. Marked for Manual Review.",
                approved: false // Default to manual
            };
        }

        return { success: true, analysis };

    } catch (error) {
        console.error("Analysis Error:", error);
        return { error: "Failed to analyze request" };
    }
}
