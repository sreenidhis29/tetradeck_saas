import Link from 'next/link';
import { User, Briefcase } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full text-center">
        <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
          Company.AI HR System
        </h1>
        <p className="text-xl text-slate-400 mb-12">
          Select your portal to continue. Powered by Next.js 14 and AI Agents.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          <Link href="/employee/leave" className="group">
            <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-2xl hover:bg-slate-800 hover:border-purple-500 transition-all duration-300 transform hover:-translate-y-1">
              <div className="w-16 h-16 mx-auto bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <User size={32} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Employee Portal</h2>
              <p className="text-slate-400">Apply for leaves, check status, and view your schedule.</p>
            </div>
          </Link>

          <Link href="/hr/dashboard" className="group">
            <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-2xl hover:bg-slate-800 hover:border-blue-500 transition-all duration-300 transform hover:-translate-y-1">
              <div className="w-16 h-16 mx-auto bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Briefcase size={32} />
              </div>
              <h2 className="text-2xl font-bold mb-2">HR Portal</h2>
              <p className="text-slate-400">Manage approvals, view reports, and oversee operations.</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
