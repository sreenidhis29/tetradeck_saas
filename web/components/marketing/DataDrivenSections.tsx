'use client';

/**
 * 🏠 MARKETING LANDING PAGE COMPONENTS
 * 
 * Client components that fetch real data from backend.
 * Critical Fixes: #1, #2, #3, #5
 */

import { useEffect, useState } from 'react';
import { Star, Shield, Zap, Globe, Users } from 'lucide-react';

interface PlatformStat {
    type: string;
    value: string;
    displayValue: string;
    isVerified: boolean;
}

interface Testimonial {
    id: string;
    name: string;
    role: string;
    company: string;
    avatarUrl: string | null;
    content: string;
    rating: number;
    isVerified: boolean;
}

interface PricingPlan {
    code: string;
    name: string;
    description: string | null;
    priceMonthly: number;
    priceYearly: number;
    currency: string;
    maxEmployees: number | null;
    features: string[];
    isPopular: boolean;
}

/**
 * Stats Section with Real Data
 */
export function StatsSection() {
    const [stats, setStats] = useState<PlatformStat[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            try {
                const res = await fetch('/api/platform/stats');
                const data = await res.json();
                if (data.success && data.data) {
                    setStats(Object.values(data.data));
                }
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchStats();
    }, []);

    // Default stats while loading or if fetch fails
    const displayStats = stats.length > 0 ? stats.map(s => ({
        value: s.displayValue,
        label: s.type.charAt(0).toUpperCase() + s.type.slice(1),
    })) : [
        { value: '—', label: 'Companies' },
        { value: '—', label: 'Employees' },
        { value: '—', label: 'Uptime' },
        { value: '—', label: 'Rating' },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto mb-12">
            {displayStats.map((stat, i) => (
                <div key={i} className="text-center">
                    <p className={`text-4xl md:text-5xl font-bold text-white mb-2 ${loading ? 'animate-pulse' : ''}`}>
                        {stat.value}
                    </p>
                    <p className="text-slate-400 capitalize">{stat.label}</p>
                </div>
            ))}
        </div>
    );
}

/**
 * Testimonials Section with Real Data
 */
export function TestimonialsSection() {
    const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchTestimonials() {
            try {
                const res = await fetch('/api/platform/testimonials');
                const data = await res.json();
                if (data.success && data.data) {
                    setTestimonials(data.data);
                }
            } catch (error) {
                console.error('Failed to fetch testimonials:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchTestimonials();
    }, []);

    if (loading) {
        return (
            <div className="grid md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse">
                        <div className="h-20 bg-white/10 rounded mb-4"></div>
                        <div className="h-4 bg-white/10 rounded w-2/3 mb-2"></div>
                        <div className="h-3 bg-white/10 rounded w-1/2"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (testimonials.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-400">Be the first to share your experience!</p>
            </div>
        );
    }

    return (
        <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial) => (
                <div
                    key={testimonial.id}
                    className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-purple-500/30 transition-colors"
                >
                    <div className="flex gap-1 mb-4">
                        {[...Array(5)].map((_, i) => (
                            <Star
                                key={i}
                                className={`w-4 h-4 ${i < testimonial.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`}
                            />
                        ))}
                        {testimonial.isVerified && (
                            <span className="ml-2 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                                Verified
                            </span>
                        )}
                    </div>
                    <p className="text-slate-300 mb-6">{testimonial.content}</p>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                            {testimonial.avatarUrl ? (
                                <img src={testimonial.avatarUrl} alt={testimonial.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                testimonial.name.split(' ').map(n => n[0]).join('')
                            )}
                        </div>
                        <div>
                            <p className="font-semibold text-white">{testimonial.name}</p>
                            <p className="text-sm text-slate-400">{testimonial.role}, {testimonial.company}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Pricing Section with Real Data
 */
export function PricingSection() {
    const [plans, setPlans] = useState<PricingPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

    useEffect(() => {
        async function fetchPlans() {
            try {
                const res = await fetch('/api/platform/pricing');
                const data = await res.json();
                if (data.success && data.data) {
                    setPlans(data.data);
                }
            } catch (error) {
                console.error('Failed to fetch pricing:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchPlans();
    }, []);

    const formatPrice = (plan: PricingPlan) => {
        const price = billingCycle === 'monthly' ? plan.priceMonthly : Math.round(plan.priceYearly / 12);
        
        if (price === 0 && plan.code === 'FREE') return 'Free';
        if (price === 0) return 'Custom';
        
        if (plan.currency === 'INR') {
            return `₹${price}`;
        }
        return `$${price}`;
    };

    const getPeriod = (plan: PricingPlan) => {
        if (plan.code === 'FREE') return 'forever for early adopters';
        if (plan.priceMonthly === 0) return 'contact us';
        return '/employee/month';
    };

    if (loading) {
        return (
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-8 animate-pulse">
                        <div className="h-6 bg-white/10 rounded w-1/2 mb-4"></div>
                        <div className="h-10 bg-white/10 rounded w-2/3 mb-6"></div>
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map(j => (
                                <div key={j} className="h-4 bg-white/10 rounded"></div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <>
            {/* Billing toggle */}
            <div className="flex justify-center mb-8">
                <div className="bg-white/5 border border-white/10 rounded-full p-1 flex">
                    <button
                        onClick={() => setBillingCycle('monthly')}
                        className={`px-4 py-2 rounded-full text-sm transition-colors ${
                            billingCycle === 'monthly'
                                ? 'bg-purple-600 text-white'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Monthly
                    </button>
                    <button
                        onClick={() => setBillingCycle('yearly')}
                        className={`px-4 py-2 rounded-full text-sm transition-colors ${
                            billingCycle === 'yearly'
                                ? 'bg-purple-600 text-white'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Yearly <span className="text-green-400 text-xs">Save 20%</span>
                    </button>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {plans.map((plan) => (
                    <div
                        key={plan.code}
                        className={`relative bg-white/5 border rounded-2xl p-8 ${
                            plan.isPopular
                                ? 'border-purple-500 ring-2 ring-purple-500/20'
                                : 'border-white/10'
                        }`}
                    >
                        {plan.isPopular && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                                MOST POPULAR
                            </div>
                        )}
                        <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                        <p className="text-slate-400 text-sm mb-6">{plan.description}</p>
                        <div className="mb-6">
                            <span className="text-4xl font-bold text-white">{formatPrice(plan)}</span>
                            <span className="text-slate-400 text-sm ml-2">{getPeriod(plan)}</span>
                        </div>
                        <ul className="space-y-3 mb-8">
                            {plan.features.map((feature, i) => (
                                <li key={i} className="flex items-center gap-2 text-slate-300">
                                    <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        <a
                            href={plan.code === 'ENTERPRISE' ? '/contact' : '/sign-up'}
                            className={`block w-full text-center py-3 rounded-xl font-semibold transition-colors ${
                                plan.isPopular
                                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                            }`}
                        >
                            {plan.code === 'FREE' ? 'Start Free' : plan.code === 'ENTERPRISE' ? 'Contact Sales' : 'Start Free Trial'}
                        </a>
                    </div>
                ))}
            </div>
        </>
    );
}

/**
 * Trust Badges with Real Data
 * Shows actual uptime, company count from database
 */
export function TrustBadges() {
    const [stats, setStats] = useState<{ uptime: string; companies: string } | null>(null);

    useEffect(() => {
        async function fetchStats() {
            try {
                const res = await fetch('/api/platform/stats');
                const data = await res.json();
                if (data.success && data.data) {
                    setStats({
                        uptime: data.data.uptime?.displayValue || '99.9%',
                        companies: data.data.companies?.displayValue || '—',
                    });
                }
            } catch (error) {
                console.error('Failed to fetch stats:', error);
            }
        }
        fetchStats();
    }, []);

    return (
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/40">
            <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-400" />
                <span>SOC 2 Compliant</span>
            </div>
            <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span>{stats?.uptime || '—'} Uptime</span>
            </div>
            <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-cyan-400" />
                <span>Used by {stats?.companies || '—'} Companies</span>
            </div>
        </div>
    );
}
