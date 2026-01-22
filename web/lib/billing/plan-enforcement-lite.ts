/**
 * 🚧 PLAN ENFORCEMENT MIDDLEWARE
 * 
 * This is what makes people UPGRADE.
 * Blocks actions when limits are reached + shows upgrade prompts.
 */

import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { checkPlanLimit, getSubscriptionStatus, PRICING_TIERS, type PricingTier } from './razorpay-lite';

// Define limits type based on the first tier
type TierLimits = {
    employees: number;
    apiCalls: number;
    sso: boolean;
    aiAnalysis: boolean;
};

export type PlanCheckResult = {
    allowed: boolean;
    tier: string;
    limits: TierLimits;
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
    action: 'employees' | 'apiCalls' | 'sso' | 'aiAnalysis',
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
                error: `Plan limit reached for ${action}`,
                planLimited: true,
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
    
    const defaultLimits: TierLimits = {
        employees: 10,
        apiCalls: 0,
        sso: false,
        aiAnalysis: false,
    };
    
    if (!status) {
        return {
            allowed: false,
            tier: 'FREE',
            limits: defaultLimits,
            usage: {
                employees: { current: 0, max: 10, percentage: 0 },
                apiCalls: { current: 0, max: 0, percentage: 0 },
            },
        };
    }

    const tierLimits = status.tierConfig.limits as TierLimits;

    const result: PlanCheckResult = {
        allowed: !status.isOverLimit,
        tier: status.tier,
        limits: tierLimits,
        usage: {
            employees: {
                current: status.employeeCount,
                max: status.employeeLimit === -1 ? 'Unlimited' : status.employeeLimit,
                percentage: status.usagePercentage,
            },
            apiCalls: {
                current: 0, // Would come from usage tracking
                max: tierLimits.apiCalls === -1 ? 'Unlimited' : tierLimits.apiCalls,
                percentage: 0,
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
 * Feature flag based on plan
 */
export function isPlanFeatureEnabled(
    tier: string,
    feature: keyof TierLimits
): boolean {
    const tierConfig = PRICING_TIERS[tier as PricingTier] || PRICING_TIERS.FREE;
    const value = tierConfig.limits[feature];
    
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    return false;
}
