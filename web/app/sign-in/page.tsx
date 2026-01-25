"use client";

import Link from "next/link";
import { Building2, Users, ArrowRight } from "lucide-react";

export default function SignInPage() {
    return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-[#0a0a0f] to-black z-0" />
            <div className="absolute w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] -top-20 -left-20 animate-pulse" />
            <div className="absolute w-[500px] h-[500px] bg-[#00f2ff]/10 rounded-full blur-[100px] bottom-0 right-0 animate-pulse" />

            <div className="relative z-10 w-full max-w-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
                        Welcome to <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-[#00f2ff]">Continuum</span>
                    </h1>
                    <p className="text-slate-400">Choose how you'd like to sign in</p>
                </div>

                {/* Role Selection Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* HR / Admin Card */}
                    <Link
                        href="/hr/sign-in"
                        className="group relative bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 hover:border-purple-500/50 rounded-2xl p-8 transition-all duration-300 overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-32 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/10 transition-all" />
                        <div className="relative z-10">
                            <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center mb-6">
                                <Building2 className="w-7 h-7 text-purple-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">HR Manager / Admin</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                Manage your company, employees, leave policies, and more.
                            </p>
                            <div className="flex items-center text-purple-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                                Sign in as HR <ArrowRight className="w-4 h-4 ml-2" />
                            </div>
                        </div>
                    </Link>

                    {/* Employee Card */}
                    <Link
                        href="/employee/sign-in"
                        className="group relative bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 hover:border-[#00f2ff]/50 rounded-2xl p-8 transition-all duration-300 overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-32 bg-[#00f2ff]/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-[#00f2ff]/10 transition-all" />
                        <div className="relative z-10">
                            <div className="w-14 h-14 bg-[#00f2ff]/20 rounded-xl flex items-center justify-center mb-6">
                                <Users className="w-7 h-7 text-[#00f2ff]" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Employee</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                View your dashboard, apply for leave, track attendance.
                            </p>
                            <div className="flex items-center text-[#00f2ff] text-sm font-medium group-hover:translate-x-1 transition-transform">
                                Sign in as Employee <ArrowRight className="w-4 h-4 ml-2" />
                            </div>
                        </div>
                    </Link>
                </div>

                {/* Footer */}
                <div className="text-center mt-8">
                    <p className="text-slate-500 text-sm">
                        Don't have an account?{" "}
                        <Link href="/sign-up" className="text-purple-400 hover:text-purple-300 font-medium">
                            Sign up here
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
