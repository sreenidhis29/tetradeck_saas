"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetRejectedEmployeeState } from "@/app/actions/onboarding";
import { XCircle, RefreshCw, ArrowRight, Loader2 } from "lucide-react";

interface RejectedPageClientProps {
    rejectionReason?: string;
    employeeName: string;
}

export function RejectedPageClient({ rejectionReason, employeeName }: RejectedPageClientProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTryAgain = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const result = await resetRejectedEmployeeState();
            
            if (result.success) {
                // Redirect to onboarding with employee intent
                router.push("/onboarding?intent=employee");
            } else {
                setError(result.error || "Failed to reset. Please try again.");
            }
        } catch (err) {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-4">
            <div className="max-w-md w-full bg-white/5 border border-red-500/20 rounded-2xl p-8 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
                    <XCircle className="w-10 h-10 text-red-400" />
                </div>
                
                <h1 className="text-2xl font-bold text-white mb-2">Registration Declined</h1>
                
                <p className="text-slate-400 mb-4">
                    Sorry {employeeName}, your registration request was not approved by the HR team.
                </p>
                
                {rejectionReason && (
                    <div className="p-4 bg-red-500/10 rounded-xl text-left mb-6">
                        <p className="text-sm text-slate-400 mb-1">Reason provided:</p>
                        <p className="text-red-300">{rejectionReason}</p>
                    </div>
                )}
                
                <p className="text-sm text-slate-500 mb-6">
                    You can try joining a different company, or contact the HR team if you believe this was a mistake.
                </p>
                
                {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}
                
                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleTryAgain}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Resetting...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4" />
                                Try Again with Different Company
                            </>
                        )}
                    </button>
                    
                    <a
                        href="mailto:support@continuum.hr"
                        className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        Contact Support
                        <ArrowRight className="w-4 h-4" />
                    </a>
                </div>
            </div>
        </div>
    );
}
