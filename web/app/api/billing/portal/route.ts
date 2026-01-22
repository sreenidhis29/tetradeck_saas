/**
 * 🏦 BILLING PORTAL API
 * 
 * Let customers manage their subscription (update card, cancel, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { createPortalSession } from '@/lib/billing/stripe';

export async function POST(request: NextRequest) {
    try {
        const user = await currentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const employee = await prisma.employee.findUnique({
            where: { clerk_id: user.id },
            select: { org_id: true, role: true },
        });

        if (!employee?.org_id || !['hr', 'admin'].includes(employee.role || '')) {
            return NextResponse.json(
                { error: 'Only HR/Admin can manage billing' },
                { status: 403 }
            );
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const { url } = await createPortalSession(
            employee.org_id,
            `${baseUrl}/hr/settings/billing`
        );

        return NextResponse.json({ url });
    } catch (error: any) {
        console.error('Portal error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create portal session' },
            { status: 500 }
        );
    }
}
