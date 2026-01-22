"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, CheckCircle, AlertCircle, RefreshCw, Mail, Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { checkFeatureAccess } from "@/app/actions/onboarding";

interface PendingApprovalProps {
    employeeName: string;
    companyName?: string;
}

export function PendingApprovalStatus({ employeeName, companyName }: PendingApprovalProps) {
    const [checking, setChecking] = useState(false);
    const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
    const router = useRouter();

    const checkStatus = async () => {
        setChecking(true);
        const result = await checkFeatureAccess();
        
        if (result.hasAccess) {
            setStatus("approved");
            // Redirect to dashboard after approval
            setTimeout(() => {
                router.push("/employee/dashboard");
            }, 2000);
        } else if (result.reason === "pending_approval") {
            if ((result as any).status === "rejected") {
                setStatus("rejected");
            } else {
                setStatus("pending");
            }
        }
        setChecking(false);
    };

    // Auto-check every 30 seconds
    useEffect(() => {
        const interval = setInterval(checkStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0f] text-white p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1a0b2e] via-[#0a0a0f] to-black z-0" />
            <div className="absolute w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[150px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />

            {/* Floating Dots */}
            {Array.from({ length: 20 }).map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute w-1 h-1 rounded-full bg-amber-400/30"
                    style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                    }}
                    animate={{
                        y: [0, -20, 0],
                        opacity: [0.2, 0.6, 0.2],
                    }}
                    transition={{
                        duration: 3 + Math.random() * 2,
                        repeat: Infinity,
                        delay: Math.random() * 2,
                    }}
                />
            ))}

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-lg"
            >
                {status === "pending" && (
                    <div className="bg-white/5 backdrop-blur-xl border border-amber-500/20 rounded-3xl p-8 text-center">
                        {/* Status Icon */}
                        <div className="relative inline-block mb-6">
                            <motion.div
                                className="w-24 h-24 rounded-full bg-amber-500/10 flex items-center justify-center"
                                animate={{
                                    boxShadow: [
                                        "0 0 0 0 rgba(245, 158, 11, 0.3)",
                                        "0 0 0 20px rgba(245, 158, 11, 0)",
                                    ],
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <Clock className="w-12 h-12 text-amber-400" />
                            </motion.div>
                            
                            {/* Rotating Ring */}
                            <motion.div
                                className="absolute inset-0 rounded-full border-2 border-amber-500/30 border-t-amber-500"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            />
                        </div>

                        <h1 className="text-2xl font-bold text-white mb-2">
                            Awaiting HR Approval
                        </h1>

                        <p className="text-slate-400 mb-6">
                            Hello <span className="text-amber-400 font-medium">{employeeName}</span>! Your registration request has been submitted.
                        </p>

                        {companyName && (
                            <div className="flex items-center justify-center gap-2 p-4 bg-white/5 rounded-xl border border-white/10 mb-6">
                                <Building2 className="w-5 h-5 text-slate-400" />
                                <span className="text-slate-300">Joining:</span>
                                <span className="text-white font-semibold">{companyName}</span>
                            </div>
                        )}

                        <div className="space-y-4 mb-8">
                            <div className="flex items-center gap-4 p-4 bg-black/30 rounded-xl text-left">
                                <div className="p-2 bg-emerald-500/20 rounded-lg">
                                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-white">Profile Created</p>
                                    <p className="text-xs text-slate-500">Your information has been saved</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 p-4 bg-black/30 rounded-xl text-left">
                                <div className="p-2 bg-amber-500/20 rounded-lg">
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    >
                                        <RefreshCw className="w-5 h-5 text-amber-400" />
                                    </motion.div>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-white">Pending HR Review</p>
                                    <p className="text-xs text-slate-500">Your manager will approve your request soon</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 p-4 bg-black/30 rounded-xl text-left opacity-40">
                                <div className="p-2 bg-white/10 rounded-lg">
                                    <Mail className="w-5 h-5 text-slate-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-white">Email Notification</p>
                                    <p className="text-xs text-slate-500">You'll be notified when approved</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={checkStatus}
                            disabled={checking}
                            className="w-full py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium hover:bg-amber-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            {checking ? (
                                <>
                                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                                        <RefreshCw className="w-4 h-4" />
                                    </motion.div>
                                    Checking...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4" />
                                    Check Status
                                </>
                            )}
                        </button>

                        <p className="text-xs text-slate-600 mt-4">
                            Auto-checking every 30 seconds
                        </p>
                    </div>
                )}

                {status === "approved" && (
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white/5 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-8 text-center"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", delay: 0.2 }}
                            className="w-24 h-24 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center mb-6"
                        >
                            <CheckCircle className="w-12 h-12 text-emerald-400" />
                        </motion.div>

                        <h1 className="text-2xl font-bold text-white mb-2">
                            You're Approved! 🎉
                        </h1>

                        <p className="text-slate-400 mb-6">
                            Welcome to the team! Redirecting you to your dashboard...
                        </p>

                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-emerald-500 to-[#00f2ff]"
                                initial={{ width: 0 }}
                                animate={{ width: "100%" }}
                                transition={{ duration: 2 }}
                            />
                        </div>
                    </motion.div>
                )}

                {status === "rejected" && (
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white/5 backdrop-blur-xl border border-red-500/30 rounded-3xl p-8 text-center"
                    >
                        <div className="w-24 h-24 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-6">
                            <AlertCircle className="w-12 h-12 text-red-400" />
                        </div>

                        <h1 className="text-2xl font-bold text-white mb-2">
                            Request Not Approved
                        </h1>

                        <p className="text-slate-400 mb-6">
                            Unfortunately, your registration was not approved. Please contact your HR department for more information.
                        </p>

                        <button
                            onClick={() => router.push("/employee/auth")}
                            className="w-full py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-all"
                        >
                            Back to Home
                        </button>
                    </motion.div>
                )}
            </motion.div>
        </div>
    );
}
