import Link from 'next/link';
import { ShieldCheck, UserCheck, UserPlus, ArrowRight } from 'lucide-react';

export default function EmployeeAuthPage() {
    return (
        <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-4 overflow-hidden relative">

            {/* Background FX */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a0b2e] via-[#0a0a0f] to-black z-0" />
            <div className="absolute w-[800px] h-[800px] bg-[#00f2ff]/10 rounded-full blur-[120px] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

            <div className="max-w-4xl w-full text-center z-10">

                <div className="mb-8 flex flex-col items-center justify-center animate-fade-in-up">
                    <div className="p-4 bg-[#00f2ff]/10 rounded-2xl mb-4 border border-[#00f2ff]/30">
                        <ShieldCheck className="w-12 h-12 text-[#00f2ff]" />
                    </div>
                    <h1 className="text-5xl font-bold bg-gradient-to-br from-white via-cyan-200 to-[#00f2ff] bg-clip-text text-transparent mb-2">
                        Employee Portal
                    </h1>
                    <p className="text-slate-400 max-w-lg mx-auto">
                        Access your dashboard, submit leave requests, and view your records securely.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto mt-12">

                    {/* Login Option */}
                    <Link href="/employee/sign-in" className="group">
                        <div className="h-full relative bg-white/5 border border-white/10 hover:border-[#00f2ff] rounded-3xl p-8 transition-all duration-300 overflow-hidden hover:shadow-[0_0_40px_rgba(0,242,255,0.2)] flex flex-col items-center justify-between">
                            <div className="absolute inset-0 bg-gradient-to-br from-[#00f2ff]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="relative z-10 flex flex-col items-center">
                                <div className="w-16 h-16 rounded-2xl bg-cyan-900/40 text-cyan-300 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <UserCheck className="w-8 h-8" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">Existing Employee</h2>
                                <p className="text-slate-400 text-sm mb-6">Log in to view your dashboard and notifications.</p>
                            </div>

                            <span className="relative z-10 w-full py-3 rounded-xl bg-white/10 border border-white/10 group-hover:bg-[#00f2ff] group-hover:border-[#00f2ff] group-hover:text-black text-white font-semibold transition-all flex items-center justify-center gap-2">
                                Secure Login <ArrowRight className="w-4 h-4" />
                            </span>
                        </div>
                    </Link>

                    {/* Register Option */}
                    <Link href="/employee/sign-up" className="group">
                        <div className="h-full relative bg-white/5 border border-white/10 hover:border-pink-500 rounded-3xl p-8 transition-all duration-300 overflow-hidden hover:shadow-[0_0_40px_rgba(236,72,153,0.2)] flex flex-col items-center justify-between">
                            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="relative z-10 flex flex-col items-center">
                                <div className="w-16 h-16 rounded-2xl bg-pink-500/10 text-pink-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <UserPlus className="w-8 h-8" />
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2">New Employee</h2>
                                <p className="text-slate-400 text-sm mb-6">Create an account to join your organization's workspace.</p>
                            </div>

                            <span className="relative z-10 w-full py-3 rounded-xl bg-white/10 border border-white/10 group-hover:bg-pink-500 group-hover:border-pink-500 text-white font-semibold transition-all flex items-center justify-center gap-2">
                                Register Account <ArrowRight className="w-4 h-4" />
                            </span>
                        </div>
                    </Link>

                </div>

                <div className="mt-12">
                    <Link href="/" className="text-slate-500 hover:text-white transition-colors text-sm">
                        ← Back to Home
                    </Link>
                </div>

            </div>
        </div>
    );
}
