import React from 'react';
import {
    LayoutDashboard,
    Users,
    UserPlus,
    Wallet,
    BarChart3
} from 'lucide-react';
import Link from 'next/link';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-50 font-sans selection:bg-pink-500/30">
            {/* Background Gradient Mesh */}
            <div className="fixed inset-0 z-0 opacity-20 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-pink-600 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-600 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 grid grid-cols-[280px_1fr] min-h-screen">
                {/* Premium Sidebar */}
                <aside className="sticky top-0 h-screen border-r border-white/10 bg-slate-900/80 backdrop-blur-xl p-6 flex flex-col gap-6">
                    <div className="text-center mb-4">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 via-violet-500 to-blue-500 bg-clip-text text-transparent">
                            Company.AI
                        </h1>
                        <span className="inline-block mt-2 px-3 py-1 text-xs font-bold text-pink-500 bg-pink-500/10 border border-pink-500/20 rounded-full">
                            HR Panel
                        </span>
                    </div>

                    <nav className="flex flex-col gap-2">
                        <NavItem href="/hr/dashboard" icon={<LayoutDashboard />} label="Dashboard" />
                        <NavItem href="/hr/employees" icon={<Users />} label="Employees" />
                        <NavItem href="/hr/onboarding" icon={<UserPlus />} label="Onboarding" />
                        <NavItem href="/hr/payroll" icon={<Wallet />} label="Payroll" active />
                        <NavItem href="/hr/reports" icon={<BarChart3 />} label="Reports" />
                    </nav>

                    <div className="mt-auto pt-6 border-t border-white/10">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 flex items-center justify-center font-bold">
                                HR
                            </div>
                            <div>
                                <div className="text-sm font-semibold">HR Manager</div>
                                <div className="text-xs text-slate-400">View Profile</div>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="p-10 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}

function NavItem({ href, icon, label, active = false }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
    return (
        <Link
            href={href}
            className={`
        flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group
        ${active
                    ? 'bg-gradient-to-r from-pink-500/10 to-violet-500/10 border border-pink-500/20 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }
      `}
        >
            <span className={`${active ? 'text-pink-500' : 'text-slate-500 group-hover:text-pink-400'}`}>
                {icon}
            </span>
            <span className="font-medium">{label}</span>
        </Link>
    );
}
