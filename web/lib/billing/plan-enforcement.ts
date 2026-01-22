/**
 * 🚧 PLAN ENFORCEMENT MIDDLEWARE
 * 
 * This is what makes people UPGRADE.
 * Blocks actions when limits are reached + shows upgrade prompts.
 */

import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { checkPlanLimit, getSubscriptionStatus, PRICING_TIERS, type PricingTier, getUsageAnalytics } from './razorpay-lite';

export type PlanCheckResult = {
    allowed: boolean;
    tier: string;
    limits: typeof PRICING_TIERS.FREE.limits;
    usage: {
        employees: { current: number; max: number | string; percentage: number };
        apiCalls: { current: number; max: number | string; percentage: number };
    };
    trial?: {
        isTrialing: boolean;
        daysLeft: number;
        isExpiring: boolean;
    };
    upgradeRequired?: PricingTier;
    upgradeMessage?: string;
};

/**
 * Server action wrapper that checks plan limits before executing
 */
export function withPlanLimit<T extends (...args: any[]) => Promise<any>>(
    action: Parameters<typeof checkPlanLimit>[1],
    handler: T
): T {
    return (async (...args: Parameters<T>) => {
        // Get current user's org
        const user = await currentUser();
        if (!user) {
            return { success: false, error: 'Unauthorized' };
        }

        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true },
        });

        if (!employee?.org_id) {
            return { success: false, error: 'Organization not found' };
        }

        // Check plan limit
        const check = await checkPlanLimit(employee.org_id, action);
        
        if (!check.allowed) {
            return {
                success: false,
                error: check.reason,
                planLimited: true,
                upgradeRequired: check.upgradeRequired,
            };
        }

        // Execute the actual handler
        return handler(...args);
    }) as T;
}

/**
 * Get plan status for UI display
 */
export async function getPlanStatus(orgId: string): Promise<PlanCheckResult> {
    const status = await getSubscriptionStatus(orgId);
    
    if (!status) {
        return {
            allowed: false,
            tier: 'FREE',
            limits: PRICING_TIERS.FREE.limits,
            usage: {
                employees: { current: 0, max: 10, percentage: 0 },
            },
        };
    }

    const result: PlanCheckResult = {
        allowed: !status.isOverLimit,
        tier: status.tier,
        limits: status.tierConfig.limits,
        usage: {
            employees: {
                current: status.employeeCount,
                max: status.employeeLimit === -1 ? Infinity : status.employeeLimit,
                percentage: status.usagePercentage,
            },
        },
    };

    // Add upgrade prompts at 80% usage
    if (status.usagePercentage >= 80 && status.tier !== 'ENTERPRISE') {
        result.upgradeMessage = `You're using ${status.usagePercentage}% of your employee limit. Upgrade for more capacity.`;
        result.upgradeRequired = status.tier === 'FREE' ? 'STARTER' : status.tier === 'STARTER' ? 'GROWTH' : 'ENTERPRISE';
    }

    if (status.isOverLimit) {
        result.upgradeMessage = `You've exceeded your plan limit. Upgrade now to continue adding employees.`;
        result.upgradeRequired = status.tier === 'FREE' ? 'STARTER' : status.tier === 'STARTER' ? 'GROWTH' : 'ENTERPRISE';
    }

    return result;
}

/**
 * API Route middleware for plan enforcement
 */
export function withApiPlanCheck(action: 'api_call') {
    return async (request: NextRequest) => {
        const apiKey = request.headers.get('x-api-key');
        
        if (!apiKey) {
            return NextResponse.json(
                { error: 'API key required' },
                { status: 401 }
            );
        }

        // Look up org by API key
        const apiKeyRecord = await prisma.apiKey.findUnique({
            where: { key: apiKey, is_active: true },
            include: { company: true },
        });

        if (!apiKeyRecord) {
            return NextResponse.json(
                { error: 'Invalid API key' },
                { status: 401 }
            );
        }

        // Check plan allows API access
        const check = await checkPlanLimit(apiKeyRecord.org_id, action);
        
        if (!check.allowed) {
            return NextResponse.json(
                { 
                    error: check.reason,
                    upgrade_url: `${process.env.NEXT_PUBLIC_APP_URL}/hr/settings/billing`,
                },
                { status: 403 }
            );
        }

        // Track usage
        await prisma.usageRecord.create({
            data: {
                org_id: apiKeyRecord.org_id,
                feature: 'api_call',
                quantity: 1,
                recorded_at: new Date(),
            },
        });

        return null; // Continue to handler
    };
}

/**
 * Feature flag based on plan
 */
export function isPlanFeatureEnabled(
    tier: string,
    feature: keyof typeof PRICING_TIERS.FREE.limits
): boolean {
    const tierConfig = PRICING_TIERS[tier as PricingTier] || PRICING_TIERS.FREE;
    const value = tierConfig.limits[feature];
    
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return false;
}
