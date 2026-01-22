/**
 * 🔐 RAZORPAY PAYMENT VERIFICATION API
 * 
 * Verifies payment signature after successful checkout.
 * This is a critical security step - never skip this!
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { PRICING_TIERS } from '@/lib/billing/razorpay-lite';

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { orderId, paymentId, signature, tier, billingCycle } = await req.json();

        if (!orderId || !paymentId || !signature) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Verify signature
        const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
        if (!razorpaySecret) {
            console.error('RAZORPAY_KEY_SECRET not configured');
            return NextResponse.json({ error: 'Payment verification unavailable' }, { status: 500 });
        }

        const body = orderId + '|' + paymentId;
        const expectedSignature = crypto
            .createHmac('sha256', razorpaySecret)
            .update(body)
            .digest('hex');

        if (expectedSignature !== signature) {
            console.error('Invalid Razorpay signature', { orderId, paymentId });
            return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 });
        }

        // Signature verified! Payment is authentic.
        console.log('✅ Payment verified:', { orderId, paymentId, tier });

        // Get user's organization
        const employee = await prisma.employee.findFirst({
            where: { clerk_id: userId },
            include: { company: true },
        });

        if (!employee || !employee.company) {
            return NextResponse.json({ error: 'Employee or company not found' }, { status: 404 });
        }

        const tierConfig = PRICING_TIERS[tier as keyof typeof PRICING_TIERS];
        if (!tierConfig) {
            return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
        }

        // Calculate period end based on billing cycle
        const now = new Date();
        const periodEnd = new Date(now);
        if (billingCycle === 'yearly') {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
        }

        const companyId = employee.company.id;

        // Update or create subscription
        const existingSubscription = await prisma.subscription.findFirst({
            where: { org_id: companyId },
        });

        if (existingSubscription) {
            await prisma.subscription.update({
                where: { id: existingSubscription.id },
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
                    org_id: companyId,
                    plan: tier,
                    status: 'active',
                    current_period_start: now,
                    current_period_end: periodEnd,
                },
            });
        }

        // Log the payment (simplified to use existing schema)
        await prisma.auditLog.create({
            data: {
                action: 'SUBSCRIPTION_UPGRADED',
                entity_type: 'subscription',
                entity_id: orderId,
                actor_id: employee.emp_id,
                actor_type: 'user',
                target_org: companyId,
                details: {
                    tier,
                    billingCycle,
                    paymentId,
                    orderId,
                },
            },
        });

        return NextResponse.json({
            success: true,
            tier,
            periodEnd: periodEnd.toISOString(),
        });

    } catch (error: any) {
        console.error('Payment verification error:', error);
        return NextResponse.json({ 
            error: 'Failed to verify payment',
            details: error?.message,
        }, { status: 500 });
    }
}
