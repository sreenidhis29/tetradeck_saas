

export type LeaveRequestInput = {
    leave_type: string;
    start_date: string;
    end_date: string;
    days_requested: number;
    original_text: string;
};

export type RuleViolation = {
    rule_id: string;
    rule_name: string;
    message: string;
    details: any;
};

export type EvaluationResult = {
    approved: boolean;
    status: string;
    violations: RuleViolation[];
    processing_time_ms: number;
    // ... other fields from python response
};

const PYTHON_ENGINE_URL = process.env.CONSTRAINT_ENGINE_URL || "http://localhost:8001";

export async function checkConstraints(
    empId: string,
    leaveInfo: LeaveRequestInput,
    orgId: string
): Promise<EvaluationResult> {

    // Fetch Organization Policies (Custom Rules) from database
    let customRules: Record<string, any> = {};
    
    try {
        // Try to fetch organization-specific constraint policies
        const { prisma } = await import('@/lib/prisma');
        const policy = await (prisma as any).constraintPolicy?.findFirst?.({ 
            where: { org_id: orgId, is_active: true } 
        });
        
        if (policy?.rules) {
            customRules = typeof policy.rules === 'string' 
                ? JSON.parse(policy.rules) 
                : policy.rules;
        }
    } catch (dbError) {
        // If policy table doesn't exist or query fails, continue with empty rules (defaults)
        console.log("No custom constraint policies found, using defaults");
    }

    try {
        const response = await fetch(`${PYTHON_ENGINE_URL}/evaluate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                emp_id: empId,
                leave_info: leaveInfo,
                rules: customRules,
            }),
        });

        if (!response.ok) {
            throw new Error(`Constraint Engine Error: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("AI Proxy Error:", error);
        // Fallback or rethrow
        throw error;
    }
}
