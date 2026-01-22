/**
 * 🏢 ENTERPRISE SIGNUP API
 * 
 * Handles enterprise quote requests and self-serve signup.
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
    calculateEnterpriseQuote, 
    createEnterpriseRequest,
    getEnterpriseFeatures,
} from '@/lib/billing/enterprise';

// GET - Get enterprise pricing and features
export async function GET() {
    const features = getEnterpriseFeatures();
    
    // Calculate sample quotes for different sizes
    const quotes = {
        small: calculateEnterpriseQuote(200, 'yearly'),
        medium: calculateEnterpriseQuote(500, 'yearly'),
        large: calculateEnterpriseQuote(1000, 'yearly'),
        enterprise: calculateEnterpriseQuote(5000, 'yearly'),
    };

    return NextResponse.json({
        features,
        sampleQuotes: quotes,
        faq: [
            {
                q: 'What is included in the Enterprise plan?',
                a: 'Unlimited employees, dedicated support, custom SLA, white-label branding, and more.',
            },
            {
                q: 'Can I get a custom quote?',
                a: 'Yes! Fill out the form below and we\'ll prepare a custom quote within 24 hours.',
            },
            {
                q: 'Is there a setup fee?',
                a: 'No setup fees. We include onboarding and training at no extra cost.',
            },
            {
                q: 'What about data migration?',
                a: 'We offer free data migration from your existing HRIS system.',
            },
        ],
    });
}

// POST - Create enterprise request
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        const {
            companyName,
            companySize,
            industry,
            contactName,
            contactEmail,
            contactPhone,
            requirements,
            expectedEmployees,
            billingCycle = 'yearly',
        } = body;

        // Validate required fields
        if (!companyName || !contactEmail || !contactName) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const result = await createEnterpriseRequest({
            companyName,
            companySize,
            industry,
            contactName,
            contactEmail,
            contactPhone,
            requirements,
            expectedEmployees: expectedEmployees || 500,
            billingCycle,
        });

        // TODO: Send email notification to sales team
        // TODO: Send confirmation email to customer

        return NextResponse.json({
            success: true,
            requestId: result.id,
            quote: result.quote,
            message: 'Thank you! Our team will contact you within 24 hours.',
        });
    } catch (error: any) {
        console.error('Enterprise request error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to process request' },
            { status: 500 }
        );
    }
}
