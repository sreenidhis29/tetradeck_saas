'use client';

/**
 * 💰 BILLING & SUBSCRIPTION PAGE - RAZORPAY
 * 
 * This is where the money comes in.
 * Beautiful pricing cards + Razorpay checkout (UPI, Cards, Netbanking)
 */

import { useState, useEffect } from 'react';
import Script from 'next/script';
import { 
    Check, Zap, Building2, Rocket, Crown, AlertTriangle, 
    CreditCard, Download, Calendar, TrendingUp, Users, 
    Activity, Smartphone, Receipt, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

declare global {
    interface Window {
        Razorpay: any;
    }
}

interface PricingTier {
    id: string;
    name: string;
    price: number;
    yearlyPrice?: number;
    currency: string;
    interval: string;
    features: string[];
    popular?: boolean;
    limits: {
        employees: number;
        apiCalls: number;
        sso: boolean;
        aiAnalysis?: boolean;
    };
}

interface Invoice {
    id: string;
    date: string;
    amount: number;
    currency: string;
    status: string;
    method: string;
}

interface SubscriptionStatus {
    tier: string;
    status: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    employeeCount: number;
    employeeLimit: number;
    usagePercentage: number;
    isOverLimit: boolean;
    billingCycle?: string;
    trial?: {
        isTrialing: boolean;
        daysLeft: number;
        isExpiring: boolean;
        plan?: string;
    };
    analytics?: {
        employees: { current: number; limit: number | string; percentage: number };
        apiCalls: { current: number; limit: number | string; percentage: number };
        reports: number;
        logins: number;
    };
    invoices?: Invoice[];
    tiers: Record<string, PricingTier>;
    razorpayKeyId?: string;
}

const TIER_ICONS: Record<string, React.ReactNode> = {
    FREE: <Zap className="w-6 h-6" />,
    STARTER: <Rocket className="w-6 h-6" />,
    GROWTH: <Building2 className="w-6 h-6" />,
    ENTERPRISE: <Crown className="w-6 h-6" />,
};

const TIER_COLORS: Record<string, string> = {
    FREE: 'from-slate-500 to-slate-600',
    STARTER: 'from-blue-500 to-blue-600',
    GROWTH: 'from-purple-500 to-purple-600',
    ENTERPRISE: 'from-amber-500 to-amber-600',
};

export default function BillingPage() {
    const [status, setStatus] = useState<SubscriptionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
    const [razorpayLoaded, setRazorpayLoaded] = useState(false);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/billing/checkout');
            const data = await res.json();
            setStatus(data);
        } catch (error) {
            toast.error('Failed to load billing status');
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async (tier: string) => {
        if (!razorpayLoaded) {
            toast.error('Payment system loading, please wait...');
            return;
        }

        setCheckoutLoading(tier);
        try {
            const res = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tier, billingCycle }),
            });

            const orderData = await res.json();
            
            if (orderData.error) {
                toast.error(orderData.error);
                setCheckoutLoading(null);
                return;
            }

            // Open Razorpay checkout
            const options = {
                key: status?.razorpayKeyId || orderData.keyId,
                amount: orderData.amount,
                currency: orderData.currency || 'INR',
                name: 'Continuum',
                description: `${tier} Plan - ${billingCycle === 'yearly' ? 'Annual' : 'Monthly'}`,
                order_id: orderData.orderId,
                prefill: orderData.prefill || {},
                theme: {
                    color: '#8b5cf6',
                    backdrop_color: '#0a0a0f',
                },
                modal: {
                    ondismiss: () => {
                        setCheckoutLoading(null);
                    },
                },
                handler: async (response: any) => {
                    // Verify payment on server
                    const verifyRes = await fetch('/api/billing/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            orderId: orderData.orderId,
                            paymentId: response.razorpay_payment_id,
                            signature: response.razorpay_signature,
                            tier,
                            billingCycle,
                        }),
                    });

                    const verifyData = await verifyRes.json();
                    
                    if (verifyData.success) {
                        toast.success(`🎉 Welcome to ${tier}! Your subscription is now active.`);
                        fetchStatus(); // Refresh status
                    } else {
                        toast.error('Payment verification failed. Please contact support.');
                    }
                    setCheckoutLoading(null);
                },
            };

            const razorpay = new window.Razorpay(options);
            razorpay.on('payment.failed', function(response: any) {
                toast.error(`Payment failed: ${response.error.description}`);
                setCheckoutLoading(null);
            });
            razorpay.open();
        } catch (error) {
            toast.error('Failed to start checkout');
            setCheckoutLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    const tiers = status?.tiers || {};
    const currentTier = status?.tier || 'FREE';
    const yearlySavings = 2; // 2 months free on yearly

    return (
        <>
            {/* Load Razorpay Script */}
            <Script 
                src="https://checkout.razorpay.com/v1/checkout.js"
                onLoad={() => setRazorpayLoaded(true)}
            />

            <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-4xl font-bold tracking-tighter mb-2">
                            Billing & Subscription
                        </h1>
                        <p className="text-slate-400">
                            Manage your subscription, view invoices, and track usage
                        </p>
                    </div>

                    {/* Trial Banner */}
                    {status?.trial?.isTrialing && (
                        <div className={`rounded-2xl p-6 mb-8 ${
                            status.trial.isExpiring 
                                ? 'bg-amber-500/10 border border-amber-500/30' 
                                : 'bg-purple-500/10 border border-purple-500/30'
                        }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-purple-500/20 rounded-xl">
                                        <Sparkles className="w-6 h-6 text-purple-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg">
                                            {status.trial.isExpiring ? '⏰ Trial Expiring Soon!' : '🎉 Free Trial Active'}
                                        </h3>
                                        <p className="text-slate-400">
                                            {status.trial.daysLeft} days left • Enjoying {status.trial.plan || 'GROWTH'} features
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleUpgrade('GROWTH')}
                                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl font-semibold hover:shadow-lg transition-all"
                                >
                                    Upgrade Now
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Current Plan Banner */}
                <div className={`bg-gradient-to-r ${TIER_COLORS[currentTier]} p-6 rounded-2xl mb-8 relative overflow-hidden`}>
                        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm"></div>
                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/20 rounded-xl">
                                    {TIER_ICONS[currentTier]}
                                </div>
                                <div>
                                    <p className="text-white/70 text-sm">Current Plan</p>
                                    <h2 className="text-2xl font-bold">{currentTier}</h2>
                                    {status?.status === 'active' && status?.currentPeriodEnd && (
                                        <p className="text-white/70 text-sm">
                                            Renews on {new Date(status.currentPeriodEnd).toLocaleDateString('en-IN', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                            })}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="text-right">
                                <p className="text-white/70 text-sm">Employees</p>
                                <p className="text-2xl font-bold">
                                    {status?.employeeCount || 0} / {status?.employeeLimit === -1 ? '∞' : status?.employeeLimit}
                                </p>
                                <div className="w-48 h-2 bg-white/20 rounded-full mt-2 overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all ${
                                            (status?.usagePercentage || 0) >= 90 ? 'bg-red-400' :
                                            (status?.usagePercentage || 0) >= 70 ? 'bg-amber-400' : 'bg-green-400'
                                        }`}
                                        style={{ width: `${Math.min(status?.usagePercentage || 0, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Usage Analytics */}
                    {status?.analytics && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                                    <Users className="w-4 h-4" />
                                    Employees
                                </div>
                                <p className="text-2xl font-bold">{status.analytics.employees.current}</p>
                                <p className="text-slate-500 text-sm">of {status.analytics.employees.limit}</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                                    <Activity className="w-4 h-4" />
                                    API Calls
                                </div>
                                <p className="text-2xl font-bold">{status.analytics.apiCalls.current}</p>
                                <p className="text-slate-500 text-sm">of {status.analytics.apiCalls.limit}/month</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                                    <TrendingUp className="w-4 h-4" />
                                    Reports
                                </div>
                                <p className="text-2xl font-bold">{status.analytics.reports}</p>
                                <p className="text-slate-500 text-sm">this month</p>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                                    <Smartphone className="w-4 h-4" />
                                    Logins
                                </div>
                                <p className="text-2xl font-bold">{status.analytics.logins}</p>
                                <p className="text-slate-500 text-sm">this month</p>
                            </div>
                        </div>
                    )}

                    {/* Billing Cycle Toggle */}
                    <div className="flex justify-center mb-8">
                        <div className="bg-white/5 border border-white/10 rounded-full p-1 flex items-center gap-1">
                            <button
                                onClick={() => setBillingCycle('monthly')}
                                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all ${
                                    billingCycle === 'monthly'
                                        ? 'bg-purple-500 text-white'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Monthly
                            </button>
                            <button
                                onClick={() => setBillingCycle('yearly')}
                                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                                    billingCycle === 'yearly'
                                        ? 'bg-purple-500 text-white'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Yearly
                                <span className="bg-green-500/20 text-green-400 text-xs px-2 py-0.5 rounded-full">
                                    Save {yearlySavings} months
                                </span>
                            </button>
                        </div>
                    </div>

                {/* Warning Banner */}
                {status?.isOverLimit && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-8 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                        <p className="text-red-300">
                            You've exceeded your plan limit. Upgrade now to continue adding employees.
                        </p>
                    </div>
                )}

                {/* Pricing Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                        {Object.entries(tiers).map(([key, tier]) => {
                            const isCurrentTier = key === currentTier;
                            const tierIndex = ['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE'].indexOf(key);
                            const currentIndex = ['FREE', 'STARTER', 'GROWTH', 'ENTERPRISE'].indexOf(currentTier);
                            const isUpgrade = tierIndex > currentIndex;
                            const isDowngrade = tierIndex < currentIndex;
                            const price = billingCycle === 'yearly' && tier.yearlyPrice ? tier.yearlyPrice : tier.price;
                            const monthlyEquivalent = billingCycle === 'yearly' && tier.yearlyPrice
                                ? Math.round(tier.yearlyPrice / 12) 
                                : tier.price;

                            return (
                                <div 
                                    key={key}
                                    className={`relative bg-white/5 border rounded-2xl p-6 transition-all hover:bg-white/10 ${
                                        isCurrentTier ? 'border-purple-500 ring-2 ring-purple-500/30' : 
                                        tier.popular ? 'border-purple-500/50' : 'border-white/10'
                                    }`}
                                >
                                    {tier.popular && !isCurrentTier && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full">
                                            MOST POPULAR
                                        </div>
                                    )}
                                    {isCurrentTier && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-purple-500 text-white text-xs font-bold rounded-full">
                                            CURRENT
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3 mb-4">
                                        <div className={`p-2 rounded-lg bg-gradient-to-br ${TIER_COLORS[key]}`}>
                                            {TIER_ICONS[key]}
                                        </div>
                                        <h3 className="text-xl font-bold">{tier.name}</h3>
                                    </div>

                                    <div className="mb-6">
                                        {tier.price === 0 ? (
                                            <div className="text-3xl font-bold">Free</div>
                                        ) : (
                                            <div>
                                                <span className="text-3xl font-bold">₹{monthlyEquivalent.toLocaleString('en-IN')}</span>
                                                <span className="text-slate-400">/month</span>
                                                {billingCycle === 'yearly' && tier.yearlyPrice && (
                                                    <p className="text-sm text-slate-500">
                                                        Billed ₹{price.toLocaleString('en-IN')}/year
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <ul className="space-y-3 mb-6">
                                        {tier.features.map((feature, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                                                <Check className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>

                                <button
                                        onClick={() => {
                                            if (isUpgrade) handleUpgrade(key);
                                            else if (key === 'ENTERPRISE') window.open('mailto:sales@continuum.hr', '_blank');
                                        }}
                                        disabled={isCurrentTier || checkoutLoading === key || isDowngrade}
                                        className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                                            isCurrentTier 
                                                ? 'bg-white/10 text-white/50 cursor-not-allowed'
                                                : isDowngrade
                                                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                                                : key === 'ENTERPRISE'
                                                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:shadow-lg hover:shadow-amber-500/20'
                                                : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white hover:shadow-lg hover:shadow-purple-500/20'
                                        }`}
                                    >
                                        {checkoutLoading === key ? (
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : isCurrentTier ? (
                                            'Current Plan'
                                        ) : isDowngrade ? (
                                            'Contact Support'
                                        ) : key === 'ENTERPRISE' ? (
                                            'Contact Sales'
                                        ) : (
                                            <>Upgrade Now <Zap className="w-4 h-4" /></>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Payment Methods Info */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <CreditCard className="w-5 h-5" />
                            Accepted Payment Methods
                        </h3>
                        <div className="flex flex-wrap gap-4">
                            {['UPI', 'Credit/Debit Cards', 'Netbanking', 'Wallets', 'EMI'].map((method) => (
                                <div key={method} className="px-4 py-2 bg-white/5 rounded-lg text-sm text-slate-300">
                                    {method}
                                </div>
                            ))}
                        </div>
                        <p className="text-slate-500 text-sm mt-4">
                            Secure payments powered by Razorpay. All transactions are encrypted and PCI-DSS compliant.
                        </p>
                    </div>

                    {/* Invoice History */}
                    {status?.invoices && status.invoices.length > 0 && (
                        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden mb-8">
                            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                                <h3 className="font-semibold flex items-center gap-2">
                                    <Receipt className="w-5 h-5" />
                                    Invoice History
                                </h3>
                            </div>
                            <div className="divide-y divide-white/10">
                                {status.invoices.map((invoice) => (
                                    <div key={invoice.id} className="px-6 py-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <Calendar className="w-5 h-5 text-slate-500" />
                                            <div>
                                                <p className="font-medium">
                                                    {new Date(invoice.date).toLocaleDateString('en-IN', {
                                                        day: 'numeric',
                                                        month: 'long',
                                                        year: 'numeric',
                                                    })}
                                                </p>
                                                <p className="text-slate-500 text-sm capitalize">{invoice.method}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="font-bold">₹{invoice.amount.toLocaleString('en-IN')}</span>
                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                                invoice.status === 'captured' 
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-amber-500/20 text-amber-400'
                                            }`}>
                                                {invoice.status === 'captured' ? 'Paid' : invoice.status}
                                            </span>
                                            <button className="text-slate-400 hover:text-white transition-colors">
                                                <Download className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                {/* FAQ */}
                    <div className="mt-12">
                        <h3 className="text-2xl font-bold mb-6">Frequently Asked Questions</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                {
                                    q: "Can I cancel anytime?",
                                    a: "Yes! Cancel anytime from this page. Your access continues until the end of the billing period."
                                },
                                {
                                    q: "What happens if I exceed my limit?",
                                    a: "You won't lose any data, but you'll need to upgrade to add new employees."
                                },
                                {
                                    q: "What payment methods are accepted?",
                                    a: "UPI (GPay, PhonePe, Paytm), Credit/Debit Cards, Netbanking, Wallets, and EMI on select cards."
                                },
                                {
                                    q: "Is my payment data secure?",
                                    a: "Absolutely. All payments are processed by Razorpay, which is PCI-DSS Level 1 compliant."
                                },
                                {
                                    q: "Can I get a GST invoice?",
                                    a: "Yes! All invoices include GST details. Add your GSTIN in organization settings."
                                },
                                {
                                    q: "Do you offer refunds?",
                                    a: "We offer a 7-day money-back guarantee for annual plans. Monthly plans are non-refundable."
                                },
                            ].map((faq, i) => (
                                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <h4 className="font-semibold mb-2">{faq.q}</h4>
                                    <p className="text-slate-400 text-sm">{faq.a}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Support */}
                    <div className="mt-8 text-center text-slate-500 text-sm">
                        <p>
                            Need help? Email us at{' '}
                            <a href="mailto:support@continuum.hr" className="text-purple-400 hover:underline">
                                support@continuum.hr
                            </a>
                            {' '}or call{' '}
                            <a href="tel:+919876543210" className="text-purple-400 hover:underline">
                                +91 98765 43210
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
