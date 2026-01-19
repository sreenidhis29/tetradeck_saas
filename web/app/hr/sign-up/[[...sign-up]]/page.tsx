import { SignUp } from "@clerk/nextjs";
import { Zap, Shield, Users, Activity } from "lucide-react";

export default function HRSignUpPage() {
    return (
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 overflow-hidden bg-[#0a0a0f]">
            {/* Left Side: Platform Powers */}
            <div className="relative hidden lg:flex flex-col items-center justify-center p-16 bg-[#0E0E14] overflow-hidden">
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-[#0a0a0f] to-black z-0" />

                <div className="relative z-10 w-full max-w-lg h-[600px]">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-20">
                        <h2 className="text-4xl font-bold text-white mb-2 tracking-tighter">TetraDeck</h2>
                        <p className="text-purple-400 font-mono text-sm tracking-widest uppercase">Start Organization</p>
                    </div>
                    {/* Reuse identical floating animations for consistency, maybe vary icons/colors slightly if desired */}
                    <div className="absolute top-20 left-10 p-6 bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl animate-float-slow shadow-[0_0_30px_rgba(168,85,247,0.15)]">
                        <div className="flex items-center gap-3 text-purple-300">
                            <div className="p-2 bg-purple-500/20 rounded-lg"><Zap className="w-5 h-5" /></div>
                            <span className="font-semibold text-white">Setup Fast</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side: Auth Form */}
            <div className="flex items-center justify-center p-8 bg-[#0a0a0f] relative">
                <div className="w-full max-w-md relative z-10">
                    <div className="mb-8 lg:hidden text-center">
                        <h1 className="text-3xl font-bold text-white tracking-tighter">New Organization</h1>
                    </div>

                    <SignUp
                        path="/hr/sign-up"
                        forceRedirectUrl="/onboarding?intent=hr"
                        appearance={{
                            elements: {
                                rootBox: "w-full",
                                card: "bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl rounded-2xl w-full p-8",
                                headerTitle: "text-2xl font-bold text-white",
                                headerSubtitle: "text-slate-400",
                                socialButtonsBlockButton: "bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all",
                                formFieldInput: "bg-black/50 border border-white/10 text-white focus:border-purple-500 focus:ring-purple-500 transition-all rounded-lg",
                                formButtonPrimary: "bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-purple-500/20",
                                footerActionLink: "text-purple-400 hover:text-purple-300 font-medium",
                                formFieldLabel: "text-slate-300 font-medium",
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
