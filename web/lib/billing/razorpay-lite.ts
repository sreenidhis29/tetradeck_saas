/**
 * 💰 CONTINUUM BILLING ENGINE - RAZORPAY LITE
 * 
 * Simplified billing engine that works with current schema.
 * Run `npx prisma db push && npx prisma generate` to use the full version.
 */

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// ============================================================
// PRICING TIERS (₹ INR)
// ============================================================

export type PricingTier = 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';

export const PRICING_TIERS = {
    FREE: {
        id: 'free',
        name: 'Free',
        price: 0,
        yearlyPrice: 0,
        currency: 'INR',
        interval: 'month',
        limits: {
            employees: 10,
            apiCalls: 0,
            sso: false,
            aiAnalysis: false,
        },
        features: [
            'Up to 10 employees',
            'Basic leave management',
            'Attendance tracking',
            'Email notifications',
            'Mobile responsive',
        ],
        popular: false,
    },
    STARTER: {
        id: 'starter',
        name: 'Starter',
        price: 2499,
        yearlyPrice: 24990,
        currency: 'INR',
        interval: 'month',
        limits: {
            employees: 50,
            apiCalls: 1000,
            sso: false,
            aiAnalysis: false,
        },
        features: [
            'Up to 50 employees',
            'Custom leave policies',
            'Payroll integration ready',
            'Team calendars',
            'Export to Excel/PDF',
            'Email support',
        ],
        popular: false,
    },
    GROWTH: {
        id: 'growth',
        name: 'Growth',
        price: 5999,
        yearlyPrice: 59990,
        currency: 'INR',
        interval: 'month',
        limits: {
            employees: 200,
            apiCalls: 10000,
            sso: true,
            aiAnalysis: true,
        },
        features: [
            'Up to 200 employees',
            'AI leave suggestions',
            'Custom workflows',
            'API access',
            'SSO integration',
            'Priority support',
            'Audit logs (1 year)',
        ],
        popular: true,
    },
    ENTERPRISE: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 14999,
        yearlyPrice: 149990,
        currency: 'INR',
        interval: 'month',
        limits: {
            employees: -1, // unlimited
            apiCalls: -1,
            sso: true,
            aiAnalysis: true,
        },
        features: [
            'Unlimited employees',
            'White-label option',
            'Custom integrations',
            'Dedicated account manager',
            'SLA guarantee',
            '24/7 phone support',
            'On-premise option',
        ],
        popular: false,
    },
} as const;

/**
 * Initialize Razorpay client lazily
 */
function getRazorpay() {
    const Razorpay = require('razorpay');
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID!,
        key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
}

/**
 * Create Razorpay order for checkout
 */
export async function createPaymentOrder(
    orgId: string,
    tier: 'STARTER' | 'GROWTH' | 'ENTERPRISE',
    billingCycle: 'monthly' | 'yearly' = 'monthly'
) {
    const tierConfig = PRICING_TIERS[tier];
    const amount = billingCycle === 'yearly' ? tierConfig.yearlyPrice : tierConfig.price;

    try {
        const razorpay = getRazorpay();
        const order = await razorpay.orders.create({
            amount: amount * 100, // Razorpay expects paise
            currency: 'INR',
            receipt: `order_${orgId}_${Date.now()}`,
            notes: {
                orgId,
                tier,
                billingCycle,
            },
        });

        return {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
        };
    } catch (error: any) {
        console.error('Razorpay order creation error:', error);
        throw new Error(`Failed to create order: ${error.message}`);
    }
}

/**
 * Verify Razorpay payment signature
 */
export function verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string
): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return false;

    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

    return expectedSignature === signature;
}

/**
 * Get subscription status for an organization
 */
export async function getSubscriptionStatus(orgId: string) {
    const subscription = await prisma.subscription.findFirst({
        where: { org_id: orgId },
        orderBy: { created_at: 'desc' },
    });

    const employees = await prisma.employee.count({
        where: { org_id: orgId, is_active: true },
    });

    const currentTier = (subscription?.plan || 'FREE') as PricingTier;
    const tierConfig = PRICING_TIERS[currentTier];

    const employeeLimit = tierConfig.limits.employees;
    const isOverLimit = employeeLimit !== -1 && employees > employeeLimit;

    return {
        tier: currentTier,
        tierConfig,
        status: subscription?.status || 'free',
        currentPeriodEnd: subscription?.current_period_end,
        cancelAtPeriodEnd: false,
        employeeCount: employees,
        employeeLimit,
        usagePercentage: employeeLimit === -1 ? 0 : Math.round((employees / employeeLimit) * 100),
        isOverLimit,
    };
}

/**
 * Get trial status
 */
export async function getTrialStatus(orgId: string) {
    const subscription = await prisma.subscription.findFirst({
        where: { org_id: orgId, status: 'trialing' },
    });

    if (!subscription) return null;

    const now = new Date();
    const trialEnd = subscription.current_period_end;
    
    if (!trialEnd) return null;

    const daysLeft = Math.ceil(
        (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
        isTrialing: true,
        daysLeft: Math.max(0, daysLeft),
        isExpiring: daysLeft <= 3,
        plan: subscription.plan,
    };
}

/**
 * Get usage analytics
 */
export async function getUsageAnalytics(orgId: string) {
    const employees = await prisma.employee.count({
        where: { org_id: orgId, is_active: true },
    });

    const subscription = await prisma.subscription.findFirst({
        where: { org_id: orgId },
    });

    const tier = (subscription?.plan || 'FREE') as PricingTier;
    const limits = PRICING_TIERS[tier].limits;

    return {
        employees: {
            current: employees,
            limit: limits.employees === -1 ? 'Unlimited' : limits.employees,
            percentage: limits.employees === -1 ? 0 : Math.round((employees / limits.employees) * 100),
        },
        apiCalls: {
            current: 0, // Would come from usage tracking
            limit: limits.apiCalls === -1 ? 'Unlimited' : limits.apiCalls,
            percentage: 0,
        },
        reports: 0,
        logins: 0,
    };
}

/**
 * Get invoices for an organization
 */
export async function getInvoices(orgId: string) {
    // For now, return empty array until Payment model is available
    return [];
}

/**
 * Check if a feature is allowed for current plan
 */
export async function checkPlanLimit(
    orgId: string,
    feature: keyof typeof PRICING_TIERS.FREE.limits
): Promise<{ allowed: boolean; currentUsage?: number; limit?: number }> {
    const status = await getSubscriptionStatus(orgId);
    const limits = status.tierConfig.limits;
    const limit = limits[feature];

    if (typeof limit === 'boolean') {
        return { allowed: limit };
    }

    if (limit === -1) {
        return { allowed: true };
    }

    // For employees, we already have the count
    if (feature === 'employees') {
        return {
            allowed: status.employeeCount < limit,
            currentUsage: status.employeeCount,
            limit,
        };
    }

    return { allowed: true, limit };
}

/**
 * Handle Razorpay webhook events
 */
export async function handleRazorpayWebhook(
    body: any,
    signature: string
): Promise<{ success: boolean; message: string }> {
    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
        return { success: false, message: 'Webhook secret not configured' };
    }

    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(body))
        .digest('hex');

    if (expectedSignature !== signature) {
        return { success: false, message: 'Invalid signature' };
    }

    const event = body.event;
    const payload = body.payload;

    console.log(`Razorpay webhook: ${event}`);

    switch (event) {
        case 'payment.captured':
            await handlePaymentCaptured(payload);
            break;
        case 'payment.failed':
            await handlePaymentFailed(payload);
            break;
        case 'order.paid':
            await handleOrderPaid(payload);
            break;
        default:
            console.log(`Unhandled webhook event: ${event}`);
    }

    return { success: true, message: `Processed ${event}` };
}

async function handlePaymentCaptured(payload: any) {
    const payment = payload.payment?.entity;
    if (!payment) return;

    console.log('Payment captured:', payment.id, payment.amount / 100, 'INR');
}

async function handlePaymentFailed(payload: any) {
    const payment = payload.payment?.entity;
    if (!payment) return;

    console.log('Payment failed:', payment.id, payment.error_code, payment.error_description);
}

async function handleOrderPaid(payload: any) {
    const order = payload.order?.entity;
    if (!order) return;

    console.log('Order paid:', order.id);
    
    const notes = order.notes || {};
    const orgId = notes.orgId;
    const tier = notes.tier;
    const billingCycle = notes.billingCycle;

    if (!orgId || !tier) return;

    // Update subscription
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const existing = await prisma.subscription.findFirst({
        where: { org_id: orgId },
    });

    if (existing) {
        await prisma.subscription.update({
            where: { id: existing.id },
            data: {
                plan: tier,
                status: 'active',
                current_period_start: now,
                current_period_end: periodEnd,
            },
        });
    } else {
        await prisma.subscription.create({
            data: {
                org_id: orgId,
                plan: tier,
                status: 'active',
                current_period_start: now,
                current_period_end: periodEnd,
            },
        });
    }
}

// Re-export for backwards compatibility
export {
    createPaymentOrder as createOrder,
};
