/**
 * 💰 CONTINUUM BILLING ENGINE
 * 
 * This is what separates free projects from revenue-generating SaaS.
 * Stripe integration for subscriptions, metering, and enforcement.
 */

import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-12-18.acacia',
    typescript: true,
});

// ============================================================
// PRICING TIERS - The Money Maker
// ============================================================

export const PRICING_TIERS = {
    FREE: {
        id: 'free',
        name: 'Free',
        price: 0,
        currency: 'inr',
        interval: 'month' as const,
        limits: {
            employees: 10,
            leaveTypes: 3,
            apiCalls: 0,
            customReports: false,
            sso: false,
            prioritySupport: false,
            auditLogRetention: 30, // days
        },
        features: [
            'Up to 10 employees',
            'Basic leave management',
            'Attendance tracking',
            'Email notifications',
        ],
    },
    STARTER: {
        id: 'starter',
        name: 'Starter',
        priceId: process.env.STRIPE_STARTER_PRICE_ID,
        price: 2499, // ₹2,499/month
        currency: 'inr',
        interval: 'month' as const,
        limits: {
            employees: 50,
            leaveTypes: 10,
            apiCalls: 1000,
            customReports: true,
            sso: false,
            prioritySupport: false,
            auditLogRetention: 90,
        },
        features: [
            'Up to 50 employees',
            'Unlimited leave types',
            'AI-powered leave analysis',
            'Custom reports',
            'Slack integration',
            'Email support',
        ],
    },
    GROWTH: {
        id: 'growth',
        name: 'Growth',
        priceId: process.env.STRIPE_GROWTH_PRICE_ID,
        price: 5999, // ₹5,999/month
        currency: 'inr',
        interval: 'month' as const,
        limits: {
            employees: 200,
            leaveTypes: -1, // unlimited
            apiCalls: 10000,
            customReports: true,
            sso: false,
            prioritySupport: true,
            auditLogRetention: 365,
        },
        features: [
            'Up to 200 employees',
            'Everything in Starter',
            'API access',
            'Webhooks',
            'Priority support',
            '1-year audit log retention',
            'Custom approval workflows',
        ],
    },
    ENTERPRISE: {
        id: 'enterprise',
        name: 'Enterprise',
        priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
        price: null, // Custom pricing
        currency: 'inr',
        interval: 'month' as const,
        limits: {
            employees: -1, // unlimited
            leaveTypes: -1,
            apiCalls: -1,
            customReports: true,
            sso: true,
            prioritySupport: true,
            auditLogRetention: -1, // forever
        },
        features: [
            'Unlimited employees',
            'Everything in Growth',
            'SSO/SAML',
            'Dedicated account manager',
            'Custom SLA',
            'On-premise option',
            'Compliance reports',
        ],
    },
} as const;

export type PricingTier = keyof typeof PRICING_TIERS;

// ============================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================

/**
 * Create a Stripe checkout session for subscription
 */
export async function createCheckoutSession(
    orgId: string,
    tier: 'STARTER' | 'GROWTH' | 'ENTERPRISE',
    successUrl: string,
    cancelUrl: string
) {
    const org = await prisma.company.findUnique({
        where: { company_id: orgId },
        include: { employees: { where: { is_active: true } } },
    });

    if (!org) throw new Error('Organization not found');

    const tierConfig = PRICING_TIERS[tier];
    if (!tierConfig.priceId) throw new Error('Invalid tier');

    // Create or retrieve Stripe customer
    let customerId = org.stripe_customer_id;
    if (!customerId) {
        const customer = await stripe.customers.create({
            name: org.name,
            email: org.billing_email || undefined,
            metadata: { orgId: org.company_id },
        });
        customerId = customer.id;

        await prisma.company.update({
            where: { company_id: orgId },
            data: { stripe_customer_id: customerId },
        });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
            {
                price: tierConfig.priceId,
                quantity: 1,
            },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
            orgId: org.company_id,
            tier: tier,
        },
        subscription_data: {
            metadata: {
                orgId: org.company_id,
                tier: tier,
            },
        },
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
    });

    return { sessionId: session.id, url: session.url };
}

/**
 * Create a billing portal session for managing subscription
 */
export async function createPortalSession(orgId: string, returnUrl: string) {
    const org = await prisma.company.findUnique({
        where: { company_id: orgId },
    });

    if (!org?.stripe_customer_id) {
        throw new Error('No billing account found');
    }

    const session = await stripe.billingPortal.sessions.create({
        customer: org.stripe_customer_id,
        return_url: returnUrl,
    });

    return { url: session.url };
}

/**
 * Get current subscription status
 */
export async function getSubscriptionStatus(orgId: string) {
    const org = await prisma.company.findUnique({
        where: { company_id: orgId },
        include: {
            subscriptions: {
                where: { status: { in: ['active', 'trialing', 'past_due'] } },
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
    };
}

// ============================================================
// PLAN ENFORCEMENT - The Gate Keeper
// ============================================================

/**
 * Check if organization can perform an action based on their plan
 */
export async function checkPlanLimit(
    orgId: string,
    action: 'add_employee' | 'create_leave_type' | 'api_call' | 'custom_report' | 'sso'
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
                    upgradeRequired: status.tier === 'FREE' ? 'STARTER' : status.tier === 'STARTER' ? 'GROWTH' : 'ENTERPRISE',
                };
            }
            return { allowed: true };

        case 'create_leave_type':
            if (limits.leaveTypes === -1) return { allowed: true };
            // Check current leave type count
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
            // TODO: Check monthly API call count from usage table
            return { allowed: true };

        case 'custom_report':
            if (!limits.customReports) {
                return {
                    allowed: false,
                    reason: 'Custom reports require a paid plan.',
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

        default:
            return { allowed: true };
    }
}

/**
 * Track feature usage for metering
 */
export async function trackUsage(
    orgId: string,
    feature: string,
    quantity: number = 1
) {
    await prisma.usageRecord.create({
        data: {
            org_id: orgId,
            feature,
            quantity,
            recorded_at: new Date(),
        },
    });
}

// ============================================================
// WEBHOOK HANDLERS
// ============================================================

/**
 * Handle Stripe webhook events
 */
export async function handleStripeWebhook(
    body: string,
    signature: string
) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    
    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
        throw new Error(`Webhook signature verification failed`);
    }

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            await handleCheckoutComplete(session);
            break;
        }

        case 'customer.subscription.updated': {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionUpdate(subscription);
            break;
        }

        case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription;
            await handleSubscriptionCanceled(subscription);
            break;
        }

        case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice;
            await handlePaymentFailed(invoice);
            break;
        }

        case 'invoice.paid': {
            const invoice = event.data.object as Stripe.Invoice;
            await handlePaymentSucceeded(invoice);
            break;
        }
    }

    return { received: true };
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
    const orgId = session.metadata?.orgId;
    const tier = session.metadata?.tier;
    const subscriptionId = session.subscription as string;

    if (!orgId || !subscriptionId) return;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    await prisma.subscription.create({
        data: {
            subscription_id: `sub_${Date.now()}`,
            org_id: orgId,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: session.customer as string,
            plan: tier || 'STARTER',
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000),
            current_period_end: new Date(subscription.current_period_end * 1000),
        },
    });

    console.log(`✅ New subscription: ${orgId} -> ${tier}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const orgId = subscription.metadata?.orgId;
    if (!orgId) return;

    await prisma.subscription.updateMany({
        where: { 
            org_id: orgId,
            stripe_subscription_id: subscription.id,
        },
        data: {
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000),
            cancel_at_period_end: subscription.cancel_at_period_end,
        },
    });
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
    const orgId = subscription.metadata?.orgId;
    if (!orgId) return;

    await prisma.subscription.updateMany({
        where: { 
            org_id: orgId,
            stripe_subscription_id: subscription.id,
        },
        data: {
            status: 'canceled',
            canceled_at: new Date(),
        },
    });

    // TODO: Send cancellation email, schedule data export
    console.log(`⚠️ Subscription canceled: ${orgId}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    
    const org = await prisma.company.findFirst({
        where: { stripe_customer_id: customerId },
    });

    if (org) {
        // TODO: Send payment failed email with retry link
        console.log(`❌ Payment failed: ${org.name}`);
    }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    
    // Update subscription status to active
    await prisma.subscription.updateMany({
        where: { stripe_customer_id: customerId },
        data: { status: 'active' },
    });
}

// ============================================================
// TRIAL MANAGEMENT
// ============================================================

/**
 * Start a free trial for an organization
 */
export async function startTrial(orgId: string, days: number = 14) {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + days);

    await prisma.subscription.create({
        data: {
            subscription_id: `trial_${Date.now()}`,
            org_id: orgId,
            plan: 'STARTER', // Trial gets Starter features
            status: 'trialing',
            trial_end: trialEnd,
            current_period_start: new Date(),
            current_period_end: trialEnd,
        },
    });

    return { trialEnd };
}

/**
 * Check if trial is expiring soon
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
        trialEnd: subscription.trial_end,
        daysLeft: Math.max(0, daysLeft),
        isExpiring: daysLeft <= 3,
        isExpired: daysLeft <= 0,
    };
}

export { stripe };
