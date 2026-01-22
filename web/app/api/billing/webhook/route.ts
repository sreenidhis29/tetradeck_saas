/**
 * 🔔 RAZORPAY WEBHOOK HANDLER
 * 
 * This keeps subscriptions in sync with Razorpay.
 * CRITICAL: This must work 100% of the time or you lose money.
 * 
 * Configure webhook URL in Razorpay Dashboard:
 * https://your-domain.com/api/billing/webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleRazorpayWebhook } from '@/lib/billing/razorpay-lite';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const signature = request.headers.get('x-razorpay-signature');

        if (!signature) {
            return NextResponse.json(
                { error: 'Missing x-razorpay-signature header' },
                { status: 400 }
            );
        }

        const result = await handleRazorpayWebhook(body, signature);
        
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Webhook error:', error);
        return NextResponse.json(
            { error: error.message || 'Webhook handler failed' },
            { status: 400 }
        );
    }
}
