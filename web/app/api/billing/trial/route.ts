/**
 * 🎯 TRIAL MANAGEMENT API
 * 
 * Start trials, check status, handle conversions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { startTrial, getTrialInfo, convertTrial } from '@/lib/billing/trial';

// GET - Get current trial status
export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const employee = await prisma.employee.findFirst({
            where: { clerk_id: userId },
            select: { org_id: true },
        });

        if (!employee?.org_id) {
            return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
        }

        const trialInfo = await getTrialInfo(employee.org_id);
        
        return NextResponse.json({
            trial: trialInfo,
            canStartTrial: !trialInfo, // Can start if not already trialing
        });
    } catch (error: any) {
        console.error('Trial API error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to get trial status' },
            { status: 500 }
        );
    }
}

// POST - Start a trial or convert to paid
export async function POST(request: NextRequest) {
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

        // Only HR/Admin can manage subscriptions
        if (!['hr', 'admin'].includes(employee.role || '')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const body = await request.json();
        const { action, tier, billingCycle } = body;

        if (action === 'start') {
            await startTrial(employee.org_id);
            const trialInfo = await getTrialInfo(employee.org_id);
            
            return NextResponse.json({
                success: true,
                message: 'Trial started! Enjoy 14 days of Growth features.',
                trial: trialInfo,
            });
        } else if (action === 'convert') {
            if (!tier || !['STARTER', 'GROWTH', 'ENTERPRISE'].includes(tier)) {
                return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
            }

            await convertTrial(employee.org_id, tier, billingCycle || 'monthly');
            
            return NextResponse.json({
                success: true,
                message: `Successfully upgraded to ${tier}!`,
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Trial API error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to process request' },
            { status: 500 }
        );
    }
}
