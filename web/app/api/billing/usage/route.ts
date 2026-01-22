/**
 * 📊 USAGE ANALYTICS API
 * 
 * Returns usage data for billing dashboard and metered billing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getOrgAnalytics, getUsageSummary } from '@/lib/billing/usage-tracking';

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const employee = await prisma.employee.findFirst({
            where: { clerk_id: userId },
            select: { org_id: true, role: true },
        });

        if (!employee?.org_id) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        // Only HR/Admin can view analytics
        if (!['hr', 'admin'].includes(employee.role || '')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'summary';

        if (type === 'full') {
            const analytics = await getOrgAnalytics(employee.org_id);
            return NextResponse.json(analytics);
        } else {
            const summary = await getUsageSummary(employee.org_id);
            return NextResponse.json(summary);
        }
    } catch (error: any) {
        console.error('Usage API error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to get usage data' },
            { status: 500 }
        );
    }
}
