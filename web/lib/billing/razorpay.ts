/**
 * 💰 CONTINUUM BILLING ENGINE - RAZORPAY (INDIA)
 * 
 * Razorpay is the #1 payment gateway in India.
 * Supports: UPI, Cards, Netbanking, Wallets, EMI, Subscriptions
 * 
 * This is what separates free projects from revenue-generating SaaS.
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

// ============================================================
// PRICING TIERS - The Money Maker (₹ INR)
// ============================================================

export const PRICING_TIERS = {
    FREE: {
        id: 'free',
        name: 'Free',
        price: 0,
        yearlyPrice: 0,
        currency: 'INR',
        interval: 'month' as const,
        razorpayPlanId: null,
        limits: {
            employees: 10,
            leaveTypes: 3,
            apiCalls: 0,
            customReports: false,
            sso: false,
            prioritySupport: false,
            auditLogRetention: 30, // days
            aiAnalysis: false,
            customBranding: false,
            multiLocation: false,
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
        price: 2499, // ₹2,499/month
        yearlyPrice: 24990, // ₹24,990/year (2 months free)
        currency: 'INR',
        interval: 'month' as const,
        razorpayPlanId: process.env.RAZORPAY_STARTER_PLAN_ID,
        limits: {
            employees: 50,
            leaveTypes: 10,
            apiCalls: 1000,
            customReports: true,
            sso: false,
            prioritySupport: false,
            auditLogRetention: 90,
            aiAnalysis: true,
            customBranding: false,
            multiLocation: false,
        },
        features: [
            'Up to 50 employees',
            'Unlimited leave types',
            '🤖 AI-powered leave analysis',
            'Custom reports',
            'Slack integration',
            'Email support',
            '90-day audit logs',
        ],
        popular: false,
    },
    GROWTH: {
        id: 'growth',
        name: 'Growth',
        price: 5999, // ₹5,999/month
        yearlyPrice: 59990, // ₹59,990/year (2 months free)
        currency: 'INR',
        interval: 'month' as const,
        razorpayPlanId: process.env.RAZORPAY_GROWTH_PLAN_ID,
        limits: {
            employees: 200,
            leaveTypes: -1, // unlimited
            apiCalls: 10000,
            customReports: true,
            sso: false,
            prioritySupport: true,
            auditLogRetention: 365,
            aiAnalysis: true,
            customBranding: true,
            multiLocation: true,
        },
        features: [
            'Up to 200 employees',
            'Everything in Starter',
            'API access (10k calls/month)',
            'Webhooks',
            'Priority support',
            '1-year audit log retention',
            'Custom approval workflows',
            'Multi-location support',
            'Custom branding',
        ],
        popular: true, // Most popular badge
    },
    ENTERPRISE: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 14999, // ₹14,999/month base
        yearlyPrice: 149990, // ₹1,49,990/year
        currency: 'INR',
        interval: 'month' as const,
        razorpayPlanId: process.env.RAZORPAY_ENTERPRISE_PLAN_ID,
        limits: {
            employees: -1, // unlimited
            leaveTypes: -1,
            apiCalls: -1,
            customReports: true,
            sso: true,
            prioritySupport: true,
            auditLogRetention: -1, // forever
            aiAnalysis: true,
            customBranding: true,
            multiLocation: true,
        },
        features: [
            'Unlimited employees',
            'Everything in Growth',
            'SSO/SAML integration',
            'Dedicated account manager',
            'Custom SLA (99.9% uptime)',
            'On-premise deployment option',
            'Compliance reports (SOC 2)',
            'Custom integrations',
            'Training sessions',
        ],
        popular: false,
    },
} as const;

export type PricingTier = keyof typeof PRICING_TIERS;

// ============================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================

/**
 * Create a Razorpay subscription for an organization
 */
export async function createSubscription(
    orgId: string,
    tier: 'STARTER' | 'GROWTH' | 'ENTERPRISE',
    billingCycle: 'monthly' | 'yearly' = 'monthly'
) {
    const org = await prisma.company.findFirst({
        where: { id: orgId },
        include: { 
            employees: { 
                where: { is_active: true, role: 'hr' },
                take: 1 
            } 
        },
    });

    if (!org) throw new Error('Organization not found');

    const tierConfig = PRICING_TIERS[tier];
    if (!tierConfig.razorpayPlanId) throw new Error('Invalid tier');

    // Get or create Razorpay customer
    let customerId = org.razorpay_customer_id;
    if (!customerId) {
        const customer = await razorpay.customers.create({
            name: org.name,
            email: org.billing_email || org.employees[0]?.email,
            contact: org.billing_phone || undefined,
            notes: { orgId: org.company_id },
        });
        customerId = customer.id;

        await prisma.company.update({
            where: { id: orgId },
            data: { razorpay_customer_id: customerId },
        });
    }

    // Calculate amount based on billing cycle
    const amount = billingCycle === 'yearly' ? tierConfig.yearlyPrice : tierConfig.price;
    const totalCount = billingCycle === 'yearly' ? 1 : 12; // 1 yearly payment or 12 monthly

    // Create subscription
    const subscription = await razorpay.subscriptions.create({
        plan_id: tierConfig.razorpayPlanId,
        customer_id: customerId,
        total_count: totalCount,
        quantity: 1,
        notes: {
            orgId: org.company_id,
            tier: tier,
            billingCycle,
        },
    });

    // Store subscription in database
    await prisma.subscription.create({
        data: {
            subscription_id: `sub_${Date.now()}`,
            org_id: orgId,
            razorpay_subscription_id: subscription.id,
            razorpay_customer_id: customerId,
            plan: tier,
            billing_cycle: billingCycle,
            status: 'created',
            current_period_start: new Date(),
            current_period_end: new Date(subscription.current_end! * 1000),
        },
    });

    return {
        subscriptionId: subscription.id,
        shortUrl: subscription.short_url, // Razorpay hosted checkout
    };
}

/**
 * Create a one-time payment order (for yearly or custom amounts)
 */
export async function createPaymentOrder(
    orgId: string,
    tier: 'STARTER' | 'GROWTH' | 'ENTERPRISE',
    billingCycle: 'monthly' | 'yearly' = 'monthly'
) {
    const org = await prisma.company.findFirst({
        where: { id: orgId },
    });

    if (!org) throw new Error('Organization not found');

    const tierConfig = PRICING_TIERS[tier];
    const amount = billingCycle === 'yearly' ? tierConfig.yearlyPrice : tierConfig.price;

    // Create Razorpay order
    const order = await razorpay.orders.create({
        amount: amount * 100, // Razorpay expects paise
        currency: 'INR',
        receipt: `order_${orgId}_${Date.now()}`,
        notes: {
            orgId: org.id,
            tier: tier,
            billingCycle,
        },
    });

    return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        orgName: org.name,
        tier,
        billingCycle,
    };
}

/**
 * Verify Razorpay payment signature
 */
export function verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string
): boolean {
    const text = orderId + '|' + paymentId;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(text)
        .digest('hex');

    return expectedSignature === signature;
}

/**
 * Verify Razorpay subscription signature
 */
export function verifySubscriptionSignature(
    subscriptionId: string,
    paymentId: string,
    signature: string
): boolean {
    const text = paymentId + '|' + subscriptionId;
    const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(text)
        .digest('hex');

    return expectedSignature === signature;
}

/**
 * Get current subscription status
 */
export async function getSubscriptionStatus(orgId: string) {
    const org = await prisma.company.findUnique({
        where: { company_id: orgId },
        include: {
            subscriptions: {
                where: { status: { in: ['active', 'trialing', 'pending', 'created'] } },
                orderBy: { created_at: 'desc' },
                take: 1,
            },
            employees: { where: { is_active: true }, select: { emp_id: true } },
        },
    });

    if (!org) return null;

    const subscription = org.subscriptions[0];
    const currentTier = subscription?.plan || 'FREE';
    const tierConfig = PRICING_TIERS[currentTier as PricingTier] || PRICING_TIERS.FREE;
    const employeeCount = org.employees.length;

    return {
        tier: currentTier,
        tierConfig,
        status: subscription?.status || 'free',
        currentPeriodEnd: subscription?.current_period_end,
        cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
        employeeCount,
        employeeLimit: tierConfig.limits.employees,
        isOverLimit: tierConfig.limits.employees !== -1 && employeeCount > tierConfig.limits.employees,
        usagePercentage: tierConfig.limits.employees === -1 
            ? 0 
            : Math.round((employeeCount / tierConfig.limits.employees) * 100),
        billingCycle: subscription?.billing_cycle || 'monthly',
        razorpaySubscriptionId: subscription?.razorpay_subscription_id,
    };
}

/**
 * Cancel subscription at period end
 */
export async function cancelSubscription(orgId: string) {
    const subscription = await prisma.subscription.findFirst({
        where: { org_id: orgId, status: 'active' },
    });

    if (!subscription?.razorpay_subscription_id) {
        throw new Error('No active subscription found');
    }

    // Cancel in Razorpay
    await razorpay.subscriptions.cancel(subscription.razorpay_subscription_id, {
        cancel_at_cycle_end: 1, // Cancel at end of billing cycle
    });

    // Update in database
    await prisma.subscription.update({
        where: { id: subscription.id },
        data: { cancel_at_period_end: true },
    });

    return { success: true };
}

/**
 * Resume cancelled subscription
 */
export async function resumeSubscription(orgId: string) {
    const subscription = await prisma.subscription.findFirst({
        where: { org_id: orgId, cancel_at_period_end: true },
    });

    if (!subscription?.razorpay_subscription_id) {
        throw new Error('No cancelled subscription found');
    }

    // Resume in Razorpay (create new subscription with same plan)
    // Razorpay doesn't have resume, so we update our record
    await prisma.subscription.update({
        where: { id: subscription.id },
        data: { cancel_at_period_end: false },
    });

    return { success: true };
}

// ============================================================
// PLAN ENFORCEMENT - The Gate Keeper
// ============================================================

/**
 * Check if organization can perform an action based on their plan
 */
export async function checkPlanLimit(
    orgId: string,
    action: 'add_employee' | 'create_leave_type' | 'api_call' | 'custom_report' | 'sso' | 'ai_analysis' | 'custom_branding' | 'multi_location'
): Promise<{ allowed: boolean; reason?: string; upgradeRequired?: PricingTier }> {
    const status = await getSubscriptionStatus(orgId);
    if (!status) return { allowed: false, reason: 'Organization not found' };

    const limits = status.tierConfig.limits;

    switch (action) {
        case 'add_employee':
            if (limits.employees === -1) return { allowed: true };
            if (status.employeeCount >= limits.employees) {
                return {
                    allowed: false,
                    reason: `Your ${status.tier} plan allows up to ${limits.employees} employees. Upgrade to add more.`,
                    upgradeRequired: getNextTier(status.tier as PricingTier),
                };
            }
            return { allowed: true };

        case 'create_leave_type':
            if (limits.leaveTypes === -1) return { allowed: true };
            const leaveTypeCount = await prisma.leaveBalance.groupBy({
                by: ['leave_type'],
                where: { employee: { org_id: orgId } },
            });
            if (leaveTypeCount.length >= limits.leaveTypes) {
                return {
                    allowed: false,
                    reason: `Your ${status.tier} plan allows ${limits.leaveTypes} leave types.`,
                    upgradeRequired: 'STARTER',
                };
            }
            return { allowed: true };

        case 'api_call':
            if (limits.apiCalls === -1) return { allowed: true };
            if (limits.apiCalls === 0) {
                return {
                    allowed: false,
                    reason: 'API access requires a paid plan.',
                    upgradeRequired: 'STARTER',
                };
            }
            // Check monthly API usage
            const apiUsage = await getMonthlyUsage(orgId, 'api_call');
            if (apiUsage >= limits.apiCalls) {
                return {
                    allowed: false,
                    reason: `API limit reached (${limits.apiCalls}/month). Upgrade for more.`,
                    upgradeRequired: getNextTier(status.tier as PricingTier),
                };
            }
            return { allowed: true };

        case 'custom_report':
            if (!limits.customReports) {
                return {
                    allowed: false,
                    reason: 'Custom reports require a Starter plan or higher.',
                    upgradeRequired: 'STARTER',
                };
            }
            return { allowed: true };

        case 'ai_analysis':
            if (!limits.aiAnalysis) {
                return {
                    allowed: false,
                    reason: 'AI-powered analysis requires a Starter plan or higher.',
                    upgradeRequired: 'STARTER',
                };
            }
            return { allowed: true };

        case 'sso':
            if (!limits.sso) {
                return {
                    allowed: false,
                    reason: 'SSO/SAML requires an Enterprise plan.',
                    upgradeRequired: 'ENTERPRISE',
                };
            }
            return { allowed: true };

        case 'custom_branding':
            if (!limits.customBranding) {
                return {
                    allowed: false,
                    reason: 'Custom branding requires a Growth plan or higher.',
                    upgradeRequired: 'GROWTH',
                };
            }
            return { allowed: true };

        case 'multi_location':
            if (!limits.multiLocation) {
                return {
                    allowed: false,
                    reason: 'Multi-location support requires a Growth plan or higher.',
                    upgradeRequired: 'GROWTH',
                };
            }
            return { allowed: true };

        default:
            return { allowed: true };
    }
}

function getNextTier(currentTier: PricingTier): PricingTier {
    const tiers: PricingTier[] = ['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE'];
    const currentIndex = tiers.indexOf(currentTier);
    return tiers[Math.min(currentIndex + 1, tiers.length - 1)];
}

// ============================================================
// USAGE TRACKING & ANALYTICS
// ============================================================

/**
 * Track feature usage for metering and analytics
 */
export async function trackUsage(
    orgId: string,
    feature: string,
    quantity: number = 1,
    metadata?: Record<string, any>
) {
    await prisma.usageRecord.create({
        data: {
            org_id: orgId,
            feature,
            quantity,
            recorded_at: new Date(),
            metadata: metadata || undefined,
        },
    });
}

/**
 * Get monthly usage for a feature
 */
export async function getMonthlyUsage(orgId: string, feature: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await prisma.usageRecord.aggregate({
        where: {
            org_id: orgId,
            feature,
            recorded_at: { gte: startOfMonth },
        },
        _sum: { quantity: true },
    });

    return result._sum.quantity || 0;
}

/**
 * Get usage analytics for dashboard
 */
export async function getUsageAnalytics(orgId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const status = await getSubscriptionStatus(orgId);
    if (!status) return null;

    const [apiCalls, reports, logins] = await Promise.all([
        getMonthlyUsage(orgId, 'api_call'),
        getMonthlyUsage(orgId, 'report_generated'),
        getMonthlyUsage(orgId, 'user_login'),
    ]);

    return {
        tier: status.tier,
        employees: {
            current: status.employeeCount,
            limit: status.employeeLimit === -1 ? '∞' : status.employeeLimit,
            percentage: status.usagePercentage,
        },
        apiCalls: {
            current: apiCalls,
            limit: status.tierConfig.limits.apiCalls === -1 ? '∞' : status.tierConfig.limits.apiCalls,
            percentage: status.tierConfig.limits.apiCalls === -1 
                ? 0 
                : Math.round((apiCalls / status.tierConfig.limits.apiCalls) * 100),
        },
        reports: reports,
        logins: logins,
        billingCycle: status.billingCycle,
        renewsOn: status.currentPeriodEnd,
    };
}

// ============================================================
// WEBHOOK HANDLERS
// ============================================================

/**
 * Handle Razorpay webhook events
 */
export async function handleRazorpayWebhook(
    body: any,
    signature: string
) {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;
    
    // Verify webhook signature
    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(body))
        .digest('hex');

    if (expectedSignature !== signature) {
        throw new Error('Webhook signature verification failed');
    }

    const event = body.event;
    const payload = body.payload;

    switch (event) {
        case 'subscription.activated':
            await handleSubscriptionActivated(payload.subscription.entity);
            break;

        case 'subscription.charged':
            await handleSubscriptionCharged(payload.subscription.entity, payload.payment.entity);
            break;

        case 'subscription.cancelled':
            await handleSubscriptionCancelled(payload.subscription.entity);
            break;

        case 'subscription.halted':
            await handleSubscriptionHalted(payload.subscription.entity);
            break;

        case 'payment.captured':
            await handlePaymentCaptured(payload.payment.entity);
            break;

        case 'payment.failed':
            await handlePaymentFailed(payload.payment.entity);
            break;

        case 'order.paid':
            await handleOrderPaid(payload.order.entity, payload.payment.entity);
            break;
    }

    return { received: true };
}

async function handleSubscriptionActivated(subscription: any) {
    const orgId = subscription.notes?.orgId;
    if (!orgId) return;

    await prisma.subscription.updateMany({
        where: { razorpay_subscription_id: subscription.id },
        data: {
            status: 'active',
            current_period_start: new Date(subscription.current_start * 1000),
            current_period_end: new Date(subscription.current_end * 1000),
        },
    });

    console.log(`✅ Subscription activated: ${orgId}`);
}

async function handleSubscriptionCharged(subscription: any, payment: any) {
    const orgId = subscription.notes?.orgId;
    if (!orgId) return;

    // Update subscription period
    await prisma.subscription.updateMany({
        where: { razorpay_subscription_id: subscription.id },
        data: {
            status: 'active',
            current_period_start: new Date(subscription.current_start * 1000),
            current_period_end: new Date(subscription.current_end * 1000),
        },
    });

    // Record payment
    await prisma.payment.create({
        data: {
            payment_id: `pay_${Date.now()}`,
            org_id: orgId,
            razorpay_payment_id: payment.id,
            razorpay_order_id: payment.order_id,
            amount: payment.amount / 100, // Convert from paise
            currency: payment.currency,
            status: 'captured',
            method: payment.method,
        },
    });

    console.log(`💰 Subscription charged: ${orgId} - ₹${payment.amount / 100}`);
}

async function handleSubscriptionCancelled(subscription: any) {
    const orgId = subscription.notes?.orgId;
    if (!orgId) return;

    await prisma.subscription.updateMany({
        where: { razorpay_subscription_id: subscription.id },
        data: {
            status: 'cancelled',
            canceled_at: new Date(),
        },
    });

    // TODO: Send cancellation email
    console.log(`⚠️ Subscription cancelled: ${orgId}`);
}

async function handleSubscriptionHalted(subscription: any) {
    const orgId = subscription.notes?.orgId;
    if (!orgId) return;

    await prisma.subscription.updateMany({
        where: { razorpay_subscription_id: subscription.id },
        data: { status: 'halted' },
    });

    // TODO: Send payment retry email
    console.log(`❌ Subscription halted (payment failed): ${orgId}`);
}

async function handlePaymentCaptured(payment: any) {
    const orgId = payment.notes?.orgId;
    if (!orgId) return;

    await prisma.payment.updateMany({
        where: { razorpay_payment_id: payment.id },
        data: { status: 'captured' },
    });
}

async function handlePaymentFailed(payment: any) {
    const orgId = payment.notes?.orgId;
    if (!orgId) return;

    await prisma.payment.updateMany({
        where: { razorpay_payment_id: payment.id },
        data: { 
            status: 'failed',
            error_code: payment.error_code,
            error_description: payment.error_description,
        },
    });

    // TODO: Send payment failed email with retry link
    console.log(`❌ Payment failed: ${orgId} - ${payment.error_description}`);
}

async function handleOrderPaid(order: any, payment: any) {
    const orgId = order.notes?.orgId;
    const tier = order.notes?.tier as PricingTier;
    const billingCycle = order.notes?.billingCycle || 'monthly';

    if (!orgId || !tier) return;

    // Create subscription record for one-time payment
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'yearly' ? 12 : 1));

    await prisma.subscription.create({
        data: {
            subscription_id: `sub_${Date.now()}`,
            org_id: orgId,
            razorpay_order_id: order.id,
            plan: tier,
            billing_cycle: billingCycle,
            status: 'active',
            current_period_start: new Date(),
            current_period_end: periodEnd,
        },
    });

    // Record payment
    await prisma.payment.create({
        data: {
            payment_id: `pay_${Date.now()}`,
            org_id: orgId,
            razorpay_payment_id: payment.id,
            razorpay_order_id: order.id,
            amount: payment.amount / 100,
            currency: payment.currency,
            status: 'captured',
            method: payment.method,
        },
    });

    console.log(`✅ Order paid: ${orgId} -> ${tier} (${billingCycle})`);
}

// ============================================================
// TRIAL MANAGEMENT
// ============================================================

/**
 * Start a free trial for an organization
 */
export async function startTrial(orgId: string, days: number = 14) {
    const existingTrial = await prisma.subscription.findFirst({
        where: { org_id: orgId },
    });

    if (existingTrial) {
        throw new Error('Organization already has a subscription or trial');
    }

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + days);

    await prisma.subscription.create({
        data: {
            subscription_id: `trial_${Date.now()}`,
            org_id: orgId,
            plan: 'GROWTH', // Trial gets Growth features (best value demo)
            status: 'trialing',
            trial_end: trialEnd,
            current_period_start: new Date(),
            current_period_end: trialEnd,
        },
    });

    // Track trial start
    await trackUsage(orgId, 'trial_started', 1, { days });

    return { trialEnd, plan: 'GROWTH' };
}

/**
 * Get trial status
 */
export async function getTrialStatus(orgId: string) {
    const subscription = await prisma.subscription.findFirst({
        where: { org_id: orgId, status: 'trialing' },
    });

    if (!subscription?.trial_end) return null;

    const now = new Date();
    const daysLeft = Math.ceil(
        (subscription.trial_end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
        isTrialing: true,
        plan: subscription.plan,
        trialEnd: subscription.trial_end,
        daysLeft: Math.max(0, daysLeft),
        isExpiring: daysLeft <= 3,
        isExpired: daysLeft <= 0,
    };
}

/**
 * Convert trial to paid subscription
 */
export async function convertTrial(
    orgId: string,
    tier: 'STARTER' | 'GROWTH' | 'ENTERPRISE',
    billingCycle: 'monthly' | 'yearly' = 'monthly'
) {
    // Delete trial subscription
    await prisma.subscription.deleteMany({
        where: { org_id: orgId, status: 'trialing' },
    });

    // Create paid subscription
    return createSubscription(orgId, tier, billingCycle);
}

// ============================================================
// INVOICE MANAGEMENT
// ============================================================

/**
 * Get invoice history for an organization
 */
export async function getInvoices(orgId: string) {
    const payments = await prisma.payment.findMany({
        where: { org_id: orgId, status: 'captured' },
        orderBy: { created_at: 'desc' },
        take: 24, // Last 2 years monthly
    });

    return payments.map(p => ({
        id: p.payment_id,
        date: p.created_at,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        method: p.method,
        razorpayPaymentId: p.razorpay_payment_id,
    }));
}

/**
 * Get invoice PDF URL from Razorpay
 */
export async function getInvoiceUrl(paymentId: string) {
    // Razorpay provides invoice URL for successful payments
    const payment = await razorpay.payments.fetch(paymentId);
    return payment.invoice_id 
        ? `https://api.razorpay.com/v1/invoices/${payment.invoice_id}/pdf`
        : null;
}

export { razorpay };
