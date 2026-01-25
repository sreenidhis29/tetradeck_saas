'use client';

/**
 * 🚀 UPGRADE PROMPT COMPONENT
 * 
 * Shows when users hit plan limits - the conversion driver.
 * This is what turns free users into paying customers.
 * 
 * Critical Fix #3 - Prices now fetched from database
 */

import { useState, useEffect } from 'react';
import { Zap, X, ArrowRight, Rocket, Building2, Crown, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface UpgradePromptProps {
    feature: string;
    currentTier: string;
    requiredTier: string;
    message?: string;
    onDismiss?: () => void;
    variant?: 'modal' | 'banner' | 'inline';
}

interface PricingPlan {
    code: string;
    name: string;
    priceMonthly: number;
    currency: string;
    features: string[];
}

// Default tier icons and colors
const TIER_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
    STARTER: { 
        icon: <Rocket className="w-5 h-5" />, 
        color: 'from-blue-500 to-blue-600',
    },
    GROWTH: { 
        icon: <Building2 className="w-5 h-5" />, 
        color: 'from-purple-500 to-purple-600',
    },
    ENTERPRISE: { 
        icon: <Crown className="w-5 h-5" />, 
        color: 'from-amber-500 to-amber-600',
    },
};

export function UpgradePrompt({ 
    feature, 
    currentTier, 
    requiredTier, 
    message,
    onDismiss,
    variant = 'modal' 
}: UpgradePromptProps) {
    const [dismissed, setDismissed] = useState(false);
    const [plan, setPlan] = useState<PricingPlan | null>(null);
    const [loading, setLoading] = useState(true);

    // Fetch pricing from database
    useEffect(() => {
        async function fetchPricing() {
            try {
                const res = await fetch('/api/platform/pricing');
                const data = await res.json();
                if (data.success && data.data) {
                    const matchingPlan = data.data.find((p: PricingPlan) => p.code === requiredTier);
                    if (matchingPlan) {
                        setPlan(matchingPlan);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch pricing:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchPricing();
    }, [requiredTier]);

    const tierConfig = TIER_CONFIG[requiredTier] || TIER_CONFIG.STARTER;

    // Format price from database
    const formatPrice = () => {
        if (!plan) return 'Loading...';
        if (plan.priceMonthly === 0 && plan.code !== 'FREE') return 'Custom';
        if (plan.priceMonthly === 0) return 'Free';
        
        if (plan.currency === 'INR') {
            return `₹${plan.priceMonthly}/mo`;
        }
        return `$${plan.priceMonthly}/mo`;
    };

    // Get features description
    const getFeaturesSummary = () => {
        if (!plan || !plan.features || plan.features.length === 0) {
            // Fallback descriptions
            if (requiredTier === 'STARTER') return 'Up to 50 employees, AI-powered features, custom reports';
            if (requiredTier === 'GROWTH') return 'Unlimited employees, API access, priority support';
            if (requiredTier === 'ENTERPRISE') return 'SSO, dedicated support, custom integrations';
            return 'Premium features';
        }
        return plan.features.slice(0, 3).join(', ');
    };

    if (dismissed) return null;

    const handleDismiss = () => {
        setDismissed(true);
        onDismiss?.();
    };

    // Modal variant - full screen overlay
    if (variant === 'modal') {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-[#1a1a24] border border-white/10 rounded-2xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-200">
                    <button 
                        onClick={handleDismiss}
                        className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tierConfig.color} flex items-center justify-center mb-4`}>
                        <Zap className="w-6 h-6 text-white" />
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2">
                        Upgrade to Unlock
                    </h3>

                    <p className="text-slate-400 mb-4">
                        {message || `This feature requires a ${requiredTier} plan or higher.`}
                    </p>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                {tierConfig.icon}
                                <span className="font-semibold">{requiredTier}</span>
                            </div>
                            <span className="text-slate-400">
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    formatPrice()
                                )}
                            </span>
                        </div>
                        <p className="text-sm text-slate-400">
                            {getFeaturesSummary()}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={handleDismiss}
                            className="flex-1 py-3 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-colors"
                        >
                            Maybe Later
                        </button>
                        <Link 
                            href="/hr/settings/billing"
                            className={`flex-1 py-3 rounded-xl bg-gradient-to-r ${tierConfig.color} text-white font-semibold flex items-center justify-center gap-2 hover:shadow-lg transition-all`}
                        >
                            Upgrade <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // Banner variant - top of page
    if (variant === 'banner') {
        return (
            <div className={`bg-gradient-to-r ${tierConfig.color} px-4 py-3 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-white" />
                    <p className="text-white text-sm">
                        {message || `Upgrade to ${requiredTier} to unlock ${feature}`}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Link 
                        href="/hr/settings/billing"
                        className="px-4 py-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-1"
                    >
                        Upgrade <ArrowRight className="w-3 h-3" />
                    </Link>
                    <button onClick={handleDismiss} className="text-white/70 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    // Inline variant - within content
    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${tierConfig.color}`}>
                    <Zap className="w-4 h-4 text-white" />
                </div>
                <div>
                    <p className="font-semibold text-white text-sm">Upgrade Required</p>
                    <p className="text-slate-400 text-xs">
                        {message || `${feature} requires ${requiredTier}`}
                    </p>
                </div>
            </div>
            <Link 
                href="/hr/settings/billing"
                className={`px-4 py-2 rounded-lg bg-gradient-to-r ${tierConfig.color} text-white text-sm font-semibold flex items-center gap-1 hover:shadow-lg transition-all`}
            >
                Upgrade <ArrowRight className="w-3 h-3" />
            </Link>
        </div>
    );
}

/**
 * Usage Banner - Shows usage stats with upgrade prompt at threshold
 */
export function UsageBanner({ 
    current, 
    max, 
    label = 'Employees',
    tier = 'FREE'
}: { 
    current: number; 
    max: number; 
    label?: string;
    tier?: string;
}) {
    const percentage = max === -1 ? 0 : Math.round((current / max) * 100);
    const isNearLimit = percentage >= 80;
    const isOverLimit = percentage >= 100;

    if (!isNearLimit) return null;

    return (
        <div className={`rounded-xl p-4 mb-6 ${
            isOverLimit 
                ? 'bg-red-500/10 border border-red-500/30' 
                : 'bg-amber-500/10 border border-amber-500/30'
        }`}>
            <div className="flex items-center justify-between mb-2">
                <p className={`font-semibold ${isOverLimit ? 'text-red-400' : 'text-amber-400'}`}>
                    {isOverLimit ? '⚠️ Plan Limit Reached' : '📈 Approaching Limit'}
                </p>
                <span className="text-white font-bold">{current}/{max === -1 ? '∞' : max} {label}</span>
            </div>

            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                <div 
                    className={`h-full rounded-full transition-all ${
                        isOverLimit ? 'bg-red-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                />
            </div>

            <p className={`text-sm mb-3 ${isOverLimit ? 'text-red-300' : 'text-amber-300'}`}>
                {isOverLimit 
                    ? "You can't add more employees until you upgrade your plan."
                    : `You're using ${percentage}% of your ${label.toLowerCase()} limit.`
                }
            </p>

            <Link 
                href="/hr/settings/billing"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all"
            >
                <Zap className="w-4 h-4" />
                Upgrade Now
            </Link>
        </div>
    );
}
