/**
 * 🎯 SELF-SERVE TRIAL SYSTEM
 * 
 * Automatic trial activation on signup.
 * Tracks trial usage, sends conversion reminders, handles upgrades.
 * 
 * Flow: Signup → 14-day trial (Growth features) → Convert or downgrade
 */

import { prisma } from '@/lib/prisma';
import { PRICING_TIERS } from './razorpay-lite';

const TRIAL_DURATION_DAYS = 14;
const TRIAL_PLAN = 'GROWTH'; // What tier to give trial users

interface TrialInfo {
    isTrialing: boolean;
    daysLeft: number;
    daysUsed: number;
    trialEnd: Date | null;
    plan: string;
    isExpiring: boolean; // < 3 days left
    isExpired: boolean;
    percentComplete: number;
    features: string[];
}

/**
 * Start a trial for a new organization
 */
export async function startTrial(orgId: string): Promise<void> {
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DURATION_DAYS);

    // Check if already has a subscription
    const existing = await prisma.subscription.findFirst({
        where: { org_id: orgId },
    });

    if (existing) {
        // Update to trial if on free
        if (existing.plan === 'FREE' && existing.status !== 'trialing') {
            await prisma.subscription.update({
                where: { id: existing.id },
                data: {
                    plan: TRIAL_PLAN,
                    status: 'trialing',
                    current_period_start: now,
                    current_period_end: trialEnd,
                },
            });
        }
    } else {
        // Create new trial subscription
        await prisma.subscription.create({
            data: {
                org_id: orgId,
                plan: TRIAL_PLAN,
                status: 'trialing',
                current_period_start: now,
                current_period_end: trialEnd,
            },
        });
    }

    console.log(`✅ Trial started for org ${orgId}, expires ${trialEnd.toISOString()}`);
}

/**
 * Get trial status for an organization
 */
export async function getTrialInfo(orgId: string): Promise<TrialInfo | null> {
    const subscription = await prisma.subscription.findFirst({
        where: { org_id: orgId },
    });

    if (!subscription || subscription.status !== 'trialing') {
        return null;
    }

    const now = new Date();
    const trialEnd = subscription.current_period_end;
    
    if (!trialEnd) return null;

    const daysLeft = Math.max(0, Math.ceil(
        (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ));
    
    const daysUsed = TRIAL_DURATION_DAYS - daysLeft;
    const isExpired = daysLeft === 0;
    const isExpiring = daysLeft <= 3 && daysLeft > 0;

    const tierConfig = PRICING_TIERS[TRIAL_PLAN as keyof typeof PRICING_TIERS];

    return {
        isTrialing: true,
        daysLeft,
        daysUsed,
        trialEnd,
        plan: TRIAL_PLAN,
        isExpiring,
        isExpired,
        percentComplete: Math.round((daysUsed / TRIAL_DURATION_DAYS) * 100),
        features: tierConfig?.features || [],
    };
}

/**
 * Handle trial expiration - downgrade to free
 */
export async function handleTrialExpiration(orgId: string): Promise<void> {
    const subscription = await prisma.subscription.findFirst({
        where: { org_id: orgId, status: 'trialing' },
    });

    if (!subscription) return;

    const trialEnd = subscription.current_period_end;
    if (!trialEnd || new Date() < trialEnd) return;

    // Downgrade to free
    await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
            plan: 'FREE',
            status: 'active',
        },
    });

    console.log(`⚠️ Trial expired for org ${orgId}, downgraded to FREE`);
}

/**
 * Convert trial to paid subscription
 */
export async function convertTrial(
    orgId: string, 
    tier: 'STARTER' | 'GROWTH' | 'ENTERPRISE',
    billingCycle: 'monthly' | 'yearly' = 'monthly'
): Promise<void> {
    const now = new Date();
    const periodEnd = new Date(now);
    
    if (billingCycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await prisma.subscription.updateMany({
        where: { org_id: orgId },
        data: {
            plan: tier,
            status: 'active',
            current_period_start: now,
            current_period_end: periodEnd,
        },
    });

    console.log(`🎉 Trial converted to ${tier} for org ${orgId}`);
}

/**
 * Get organizations with expiring trials (for email reminders)
 */
export async function getExpiringTrials(daysLeft: number = 3): Promise<string[]> {
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + daysLeft);

    const subscriptions = await prisma.subscription.findMany({
        where: {
            status: 'trialing',
            current_period_end: {
                lte: threshold,
                gt: now,
            },
        },
        select: { org_id: true },
    });

    return subscriptions.map(s => s.org_id);
}

/**
 * Check all trials and handle expirations
 * (Run this via cron job daily)
 */
export async function processTrialExpirations(): Promise<number> {
    const expiredTrials = await prisma.subscription.findMany({
        where: {
            status: 'trialing',
            current_period_end: { lt: new Date() },
        },
    });

    for (const sub of expiredTrials) {
        await handleTrialExpiration(sub.org_id);
    }

    return expiredTrials.length;
}
