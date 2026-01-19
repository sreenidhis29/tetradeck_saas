import Link from 'next/link';
import { User, Briefcase, ArrowRight } from 'lucide-react';
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { syncUser } from '@/app/actions/onboarding';

export default async function Home() {
  const { userId } = await auth();

  // Automatic redirection removed to allow access to Landing Page
  // if (userId) { ... }

  // Helper for Public Landing
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-4 overflow-hidden relative">

      {/* Background FX - Purplish Cyber Theme */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a0b2e] via-[#0a0a0f] to-black z-0" />
      <div className="absolute w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[120px] top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />

      <div className="max-w-5xl w-full text-center z-10">
        <div className="mb-8 flex justify-center">
          <div className="px-4 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-mono tracking-widest uppercase animate-fade-in">
            Enterprise System v2.0
          </div>
        </div>

        <h1 className="text-7xl font-bold mb-6 bg-gradient-to-br from-white via-purple-200 to-purple-400 bg-clip-text text-transparent tracking-tighter drop-shadow-2xl">
          TetraDeck
        </h1>
        <p className="text-xl text-slate-400 mb-16 max-w-2xl mx-auto leading-relaxed">
          The next-generation workforce management engine. <br />
          <span className="text-purple-400">Secure. Intelligent. Real-time.</span>
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* HR Portal Entry */}
          <Link href="/hr/auth" className="group">
            <div className="relative bg-white/5 border border-white/10 hover:border-purple-500 rounded-3xl p-8 transition-all duration-300 overflow-hidden hover:shadow-[0_0_40px_rgba(168,85,247,0.2)]">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Briefcase className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">HR Portal</h2>
                <p className="text-slate-400 text-sm mb-6">Create Organization & Manage Teams</p>
                <span className="text-purple-400 font-bold flex items-center gap-2 text-sm group-hover:translate-x-1 transition-transform">
                  Access Dashboard <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </Link>

          {/* Employee Portal Entry */}
          <Link href="/employee/auth" className="group">
            <div className="relative bg-white/5 border border-white/10 hover:border-[#00f2ff] rounded-3xl p-8 transition-all duration-300 overflow-hidden hover:shadow-[0_0_40px_rgba(0,242,255,0.2)]">
              <div className="absolute inset-0 bg-gradient-to-br from-[#00f2ff]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-[#00f2ff]/20 text-[#00f2ff] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <User className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Employee Portal</h2>
                <p className="text-slate-400 text-sm mb-6">Join Team & View Schedule</p>
                <span className="text-[#00f2ff] font-bold flex items-center gap-2 text-sm group-hover:translate-x-1 transition-transform">
                  Enter Workspace <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </Link>
        </div>

      </div>
    </div>
  );
}
