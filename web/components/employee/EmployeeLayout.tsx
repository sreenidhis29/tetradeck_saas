import React from 'react';
import {
    Home,
    Calendar,
    Clock,
    FileText,
    User
} from 'lucide-react';
import Link from 'next/link';

interface EmployeeLayoutProps {
    children: React.ReactNode;
}

export default function EmployeeLayout({ children }: EmployeeLayoutProps) {
    return (
        <div className="min-h-screen bg-slate-900 text-slate-50 font-sans selection:bg-purple-500/30">
            {/* Background Gradient Mesh */}
            <div className="fixed inset-0 z-0 opacity-20 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 grid grid-cols-[280px_1fr] min-h-screen">
                {/* Sidebar */}
                <aside className="sticky top-0 h-screen border-r border-white/10 bg-slate-900/80 backdrop-blur-xl p-6 flex flex-col gap-6">
                    <div className="mb-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center font-bold text-white">
                            E
                        </div>
                        <h1 className="text-xl font-bold text-white">
                            Employee Hub
                        </h1>
                    </div>

                    <nav className="flex flex-col gap-2">
                        <NavItem href="/employee/dashboard" icon={<Home />} label="Home" />
                        <NavItem href="/employee/leave" icon={<Calendar />} label="Leave Requests" active />
                        <NavItem href="/employee/attendance" icon={<Clock />} label="Attendance" />
                        <NavItem href="/employee/documents" icon={<FileText />} label="Documents" />
                        <NavItem href="/employee/profile" icon={<User />} label="Profile" />
                    </nav>

                    <div className="mt-auto pt-6 border-t border-white/10">
                        {/* User Profile Summary */}
                    </div>
                </aside>

                {/* Main Content */}
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
                    ? 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }
      `}
        >
            <span className={`${active ? 'text-purple-500' : 'text-slate-500 group-hover:text-purple-400'}`}>
                {icon}
            </span>
            <span className="font-medium">{label}</span>
        </Link>
    );
}
