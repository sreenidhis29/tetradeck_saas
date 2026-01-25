/**
 * 📊 PLATFORM STATS API
 * 
 * Serves real platform statistics from database.
 * Critical Fix #1 - Replace hardcoded marketing stats
 */

import { NextResponse } from 'next/server';
import { getPlatformStats } from '@/app/actions/platform-stats';

export async function GET() {
    try {
        const result = await getPlatformStats();
        return NextResponse.json(result);
    } catch (error) {
        console.error('Platform stats API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Revalidate every 5 minutes
export const revalidate = 300;
