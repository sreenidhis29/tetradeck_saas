"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, AlertTriangle, Clock, ShieldX, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { checkFeatureAccess } from "@/app/actions/onboarding";

interface FeatureGuardProps {
    children: React.ReactNode;
    feature: "ai" | "leave" | "attendance" | "documents" | "all";
}

const featureLabels = {
    ai: "AI Leave Assistant",
    leave: "Leave Management",
    attendance: "Attendance & Check-in",
    documents: "Document Management",
    all: "This Feature"
};

export function FeatureGuard({ children, feature }: FeatureGuardProps) {
    const [hasAccess, setHasAccess] = useState<boolean | null>(null);
    const [reason, setReason] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAccess = async () => {
            const result = await checkFeatureAccess();
            setHasAccess(result.hasAccess);
            setReason(result.reason || null);
            setLoading(false);
        };
        checkAccess();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <motion.div
                    className="w-8 h-8 border-2 border-[#00f2ff] border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
            </div>
        );
    }

    if (!hasAccess) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="min-h-[400px] flex items-center justify-center p-8"
            >
                <div className="max-w-md w-full bg-white/5 border border-red-500/20 rounded-2xl p-8 text-center backdrop-blur-sm">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.1 }}
                        className="w-20 h-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-6"
                    >
                        {reason === "pending_approval" ? (
                            <Clock className="w-10 h-10 text-amber-400" />
                        ) : (
                            <Lock className="w-10 h-10 text-red-400" />
                        )}
                    </motion.div>

                    <h2 className="text-2xl font-bold text-white mb-2">
                        {reason === "pending_approval" 
                            ? "Awaiting Approval" 
                            : "Access Restricted"
                        }
                    </h2>

                    <p className="text-slate-400 mb-6">
                        {reason === "pending_approval" 
                            ? `You cannot access ${featureLabels[feature]} until your HR manager approves your registration.`
                            : `You don't have permission to access ${featureLabels[feature]}.`
                        }
                    </p>

                    {reason === "pending_approval" && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-6">
                            <div className="flex items-start gap-3 text-left">
                                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-amber-300 font-medium text-sm">Pending HR Review</p>
                                    <p className="text-slate-400 text-sm mt-1">
                                        Your registration is being reviewed. You'll receive an email once approved.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <Link
                        href="/employee/dashboard"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </Link>
                </div>
            </motion.div>
        );
    }

    return <>{children}</>;
}

// Hook version for programmatic use
export function useFeatureAccess() {
    const [access, setAccess] = useState<{
        hasAccess: boolean;
        reason: string | null;
        loading: boolean;
        role: string | null;
        showWelcome: boolean;
        showTutorial: boolean;
    }>({
        hasAccess: false,
        reason: null,
        loading: true,
        role: null,
        showWelcome: false,
        showTutorial: false,
    });

    useEffect(() => {
        const check = async () => {
            const result = await checkFeatureAccess();
            setAccess({
                hasAccess: result.hasAccess,
                reason: result.reason || null,
                loading: false,
                role: (result as any).role || null,
                showWelcome: (result as any).showWelcome || false,
                showTutorial: (result as any).showTutorial || false,
            });
        };
        check();
    }, []);

    return access;
}

// Inline alert component for partial restrictions
export function FeatureBlockedAlert({ feature }: { feature: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl"
        >
            <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                    <ShieldX className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1">
                    <p className="text-amber-200 font-medium text-sm">Feature Locked</p>
                    <p className="text-slate-400 text-sm">
                        {feature} is not available until your account is approved by HR.
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
