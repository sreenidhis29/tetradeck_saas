/**
 * 💰 RAZORPAY BILLING API
 * 
 * Create orders, subscriptions, get status
 * Supports: UPI, Cards, Netbanking, Wallets, EMI
 */

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { 
    createPaymentOrder,
    getSubscriptionStatus,
    getTrialStatus,
    PRICING_TIERS,
    getUsageAnalytics,
    getInvoices,
} from '@/lib/billing/razorpay-lite';

// POST /api/billing/checkout - Create order or subscription
export async function POST(request: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true, role: true, email: true, full_name: true },
        });

        if (!employee?.org_id || !['hr', 'admin'].includes(employee.role || '')) {
            return NextResponse.json({ error: 'Only HR/Admin can manage billing' }, { status: 403 });
        }

        const { tier, billingCycle = 'monthly' } = await request.json();
        
        if (!['STARTER', 'GROWTH', 'ENTERPRISE'].includes(tier)) {
            return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
        }

        // Use Razorpay Orders (works for all billing cycles)
        const order = await createPaymentOrder(
            employee.org_id,
            tier,
            billingCycle
        );
        
        // Return data needed for Razorpay checkout
        return NextResponse.json({
            ...order,
            prefill: {
                name: employee.full_name,
                email: employee.email,
            },
        });
    } catch (error: any) {
        console.error('Checkout error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create checkout' },
            { status: 500 }
        );
    }
}

// GET /api/billing/checkout - Get subscription status and analytics
export async function GET(request: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true },
        });

        if (!employee?.org_id) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const [status, trial, analytics, invoices] = await Promise.all([
            getSubscriptionStatus(employee.org_id),
            getTrialStatus(employee.org_id),
            getUsageAnalytics(employee.org_id),
            getInvoices(employee.org_id),
        ]);

        return NextResponse.json({
            ...status,
            trial,
            analytics,
            invoices,
            tiers: PRICING_TIERS,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        console.error('Status error:', error);
        return NextResponse.json(
            { error: 'Failed to get subscription status' },
            { status: 500 }
        );
    }
}
