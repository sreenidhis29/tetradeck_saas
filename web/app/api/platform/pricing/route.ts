/**
 * 💰 PRICING API
 * 
 * Serves real pricing plans from database.
 * Critical Fixes #2, #3 - Replace hardcoded prices
 */

import { NextResponse } from 'next/server';
import { getPricingPlans } from '@/app/actions/platform-stats';

export async function GET() {
    try {
        const result = await getPricingPlans();
        return NextResponse.json(result);
    } catch (error) {
        console.error('Pricing API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Revalidate every hour
export const revalidate = 3600;
