/**
 * 🏢 AUTOMATED ENTERPRISE TIER
 * 
 * Self-serve enterprise signup with custom onboarding.
 * No more "Contact Us" - let them upgrade instantly.
 */

import { prisma } from '@/lib/prisma';
import { PRICING_TIERS } from './razorpay-lite';

interface EnterpriseRequest {
    companyName: string;
    companySize: string;
    industry: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    requirements?: string;
    expectedEmployees?: number;
    billingCycle: 'monthly' | 'yearly';
}

interface EnterpriseQuote {
    basePrice: number;
    discount: number;
    finalPrice: number;
    features: string[];
    sla: {
        uptime: string;
        support: string;
        responseTime: string;
    };
    customizations: string[];
}

// Enterprise pricing brackets
const ENTERPRISE_PRICING = {
    base: 14999, // ₹14,999/month
    perEmployee: 50, // ₹50/employee/month after 500
    volumeDiscounts: [
        { minEmployees: 500, discount: 10 },
        { minEmployees: 1000, discount: 15 },
        { minEmployees: 2500, discount: 20 },
        { minEmployees: 5000, discount: 25 },
    ],
    yearlyDiscount: 20, // 20% off yearly
};

/**
 * Calculate enterprise quote based on requirements
 */
export function calculateEnterpriseQuote(
    expectedEmployees: number,
    billingCycle: 'monthly' | 'yearly'
): EnterpriseQuote {
    let basePrice = ENTERPRISE_PRICING.base;
    
    // Add per-employee pricing for large orgs
    if (expectedEmployees > 500) {
        basePrice += (expectedEmployees - 500) * ENTERPRISE_PRICING.perEmployee;
    }

    // Apply volume discount
    let discount = 0;
    for (const tier of ENTERPRISE_PRICING.volumeDiscounts) {
        if (expectedEmployees >= tier.minEmployees) {
            discount = tier.discount;
        }
    }

    // Apply yearly discount
    if (billingCycle === 'yearly') {
        discount += ENTERPRISE_PRICING.yearlyDiscount;
    }

    const discountAmount = Math.round(basePrice * (discount / 100));
    const finalPrice = basePrice - discountAmount;

    return {
        basePrice,
        discount,
        finalPrice,
        features: [
            'Unlimited employees',
            'White-label branding',
            'Custom integrations',
            'Dedicated account manager',
            'Priority support queue',
            'Custom SLA (99.99% uptime)',
            'On-premise deployment option',
            'SSO/SAML integration',
            'Advanced audit logs',
            'API access with higher limits',
            'Custom training sessions',
            'Quarterly business reviews',
        ],
        sla: {
            uptime: '99.99%',
            support: '24/7 Phone & Chat',
            responseTime: '< 1 hour for critical issues',
        },
        customizations: [
            'Custom domain (hr.yourcompany.com)',
            'Brand colors and logo',
            'Custom email templates',
            'Dedicated database instance',
        ],
    };
}

/**
 * Create enterprise request (sales lead)
 */
export async function createEnterpriseRequest(
    request: EnterpriseRequest
): Promise<{ id: string; quote: EnterpriseQuote }> {
    const quote = calculateEnterpriseQuote(
        request.expectedEmployees || 500,
        request.billingCycle
    );

    // Log as audit for sales team
    const entry = await prisma.auditLog.create({
        data: {
            action: 'ENTERPRISE_REQUEST',
            entity_type: 'enterprise_lead',
            entity_id: `ent_${Date.now()}`,
            actor_type: 'user',
            actor_id: request.contactEmail,
            target_org: 'PENDING',
            details: {
                ...request,
                quote,
                requestedAt: new Date().toISOString(),
            },
        },
    });

    return { id: entry.id, quote };
}

/**
 * Auto-provision enterprise account
 */
export async function provisionEnterpriseAccount(
    orgId: string,
    expectedEmployees: number,
    billingCycle: 'monthly' | 'yearly'
): Promise<void> {
    const now = new Date();
    const periodEnd = new Date(now);
    
    if (billingCycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Check if subscription exists
    const existing = await prisma.subscription.findFirst({
        where: { org_id: orgId },
    });

    if (existing) {
        await prisma.subscription.update({
            where: { id: existing.id },
            data: {
                plan: 'ENTERPRISE',
                status: 'active',
                current_period_start: now,
                current_period_end: periodEnd,
            },
        });
    } else {
        await prisma.subscription.create({
            data: {
                org_id: orgId,
                plan: 'ENTERPRISE',
                status: 'active',
                current_period_start: now,
                current_period_end: periodEnd,
            },
        });
    }

    console.log(`🏢 Enterprise account provisioned for org ${orgId}`);
}

/**
 * Get enterprise features for UI
 */
export function getEnterpriseFeatures() {
    const tier = PRICING_TIERS.ENTERPRISE;
    return {
        pricing: {
            starting: tier.price,
            yearly: tier.yearlyPrice,
            currency: 'INR',
            customQuote: true,
        },
        features: tier.features,
        limits: tier.limits,
        sla: {
            uptime: '99.99%',
            support: '24/7 Phone',
            responseTime: '< 1 hour',
            dedicatedManager: true,
        },
        compliance: [
            'SOC 2 Type II',
            'ISO 27001',
            'GDPR Ready',
            'HIPAA Compatible',
        ],
        integrations: [
            'SAP SuccessFactors',
            'Workday',
            'Oracle HCM',
            'Microsoft 365',
            'Google Workspace',
            'Slack',
            'Custom HRIS',
        ],
    };
}
