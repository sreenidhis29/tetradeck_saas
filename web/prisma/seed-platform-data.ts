/**
 * Platform Data Seeder
 * Seeds initial data for PlatformStats, PricingPlan, and Testimonial tables
 * Run with: npx tsx prisma/seed-platform-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding platform data...\n');

    // 1. Seed Platform Stats (tracks real metrics over time)
    console.log('📊 Creating initial platform stats...');
    const statsData = [
        { stat_type: 'companies', stat_value: '1', display_value: '1+', is_verified: true },
        { stat_type: 'employees', stat_value: '0', display_value: '0', is_verified: true },
        { stat_type: 'uptime', stat_value: '100', display_value: '100%', is_verified: true },
        { stat_type: 'rating', stat_value: '5.0', display_value: '5.0/5', is_verified: false },
    ];
    
    for (const stat of statsData) {
        await prisma.platformStats.upsert({
            where: { stat_type: stat.stat_type },
            update: stat,
            create: stat,
        });
    }
    console.log('  ✅ Platform stats initialized');

    // 2. Seed Pricing Plans
    console.log('\n💰 Creating pricing plans...');
    const plans = [
        {
            code: 'FREE',
            name: 'Starter',
            description: 'Perfect for small teams just getting started',
            price_monthly: 0,
            price_yearly: 0,
            currency: 'INR',
            max_employees: 10,
            max_hr_admins: 1,
            features: JSON.stringify([
                'Up to 10 employees',
                'Basic leave management',
                'Email notifications',
                'Standard support',
            ]),
            sla_uptime: 95.00,
            sla_support: 'Community',
            is_popular: false,
            is_active: true,
            sort_order: 1,
        },
        {
            code: 'GROWTH',
            name: 'Professional',
            description: 'For growing teams that need more power',
            price_monthly: 2499,
            price_yearly: 24990,
            currency: 'INR',
            max_employees: 50,
            max_hr_admins: 3,
            features: JSON.stringify([
                'Up to 50 employees',
                'AI-powered leave analysis',
                'Custom leave types',
                'Advanced analytics',
                'Priority support',
                'Attendance tracking',
            ]),
            sla_uptime: 99.00,
            sla_support: 'Email (48h)',
            sla_response: '48 hours',
            is_popular: true,
            is_active: true,
            sort_order: 2,
        },
        {
            code: 'ENTERPRISE',
            name: 'Enterprise',
            description: 'For large organizations with complex needs',
            price_monthly: 5999,
            price_yearly: 59990,
            currency: 'INR',
            max_employees: null,
            max_hr_admins: 999,
            features: JSON.stringify([
                'Unlimited employees',
                'AI escalation engine',
                'Custom workflows',
                'SSO & SAML',
                'Dedicated account manager',
                'SLA guarantees',
                'API access',
                'Custom integrations',
            ]),
            sla_uptime: 99.90,
            sla_support: '24/7 Phone',
            sla_response: '1 hour',
            is_popular: false,
            is_active: true,
            sort_order: 3,
        },
    ];

    for (const plan of plans) {
        await prisma.pricingPlan.upsert({
            where: { code: plan.code },
            update: plan,
            create: plan,
        });
        console.log(`  ✅ Plan "${plan.name}" created/updated`);
    }

    // 3. Seed Sample Testimonials (these should be replaced with real ones)
    console.log('\n💬 Creating sample testimonials...');
    const testimonials = [
        {
            name: 'Priya Sharma',
            role: 'HR Director',
            company: 'TechCorp Solutions',
            content: 'Continuum has transformed how we manage leave requests. The AI recommendations are surprisingly accurate and have reduced our approval time by 60%.',
            rating: 5,
            is_verified: false, // Mark as unverified until real testimonials come in
            is_featured: true,
            is_active: true,
            sort_order: 1,
        },
        {
            name: 'Rahul Mehta',
            role: 'CEO',
            company: 'StartupXYZ',
            content: 'As a fast-growing startup, we needed a system that could scale with us. Continuum delivered exactly that with excellent support.',
            rating: 5,
            is_verified: false,
            is_featured: true,
            is_active: true,
            sort_order: 2,
        },
        {
            name: 'Anjali Reddy',
            role: 'Operations Manager',
            company: 'Global Industries',
            content: 'The attendance tracking and real-time analytics have given us insights we never had before. Highly recommend!',
            rating: 4,
            is_verified: false,
            is_featured: false,
            is_active: true,
            sort_order: 3,
        },
    ];

    for (const testimonial of testimonials) {
        // Create with a unique ID for each testimonial
        await prisma.testimonial.create({
            data: testimonial,
        });
        console.log(`  ✅ Testimonial from "${testimonial.name}" created`);
    }

    // 4. Initialize uptime record
    console.log('\n⏱️ Creating initial uptime record...');
    await prisma.uptimeRecord.create({
        data: {
            service: 'web',
            status: 'operational',
            latency_ms: 120,
        }
    });
    console.log('  ✅ Initial uptime record created');

    console.log('\n✨ Platform data seeding complete!\n');

    // Print summary
    const statsCount = await prisma.platformStats.count();
    const plansCount = await prisma.pricingPlan.count();
    const testimonialsCount = await prisma.testimonial.count();
    const uptimeCount = await prisma.uptimeRecord.count();

    console.log('📋 Summary:');
    console.log(`  - Platform Stats: ${statsCount}`);
    console.log(`  - Pricing Plans: ${plansCount}`);
    console.log(`  - Testimonials: ${testimonialsCount}`);
    console.log(`  - Uptime Records: ${uptimeCount}`);
}

main()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
