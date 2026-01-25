/**
 * 📝 TESTIMONIALS API
 * 
 * Serves verified testimonials from database.
 * Critical Fix #5 - Replace fake testimonials
 */

import { NextResponse } from 'next/server';
import { getTestimonials } from '@/app/actions/platform-stats';

export async function GET() {
    try {
        const result = await getTestimonials();
        return NextResponse.json(result);
    } catch (error) {
        console.error('Testimonials API error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// Revalidate every hour
export const revalidate = 3600;
