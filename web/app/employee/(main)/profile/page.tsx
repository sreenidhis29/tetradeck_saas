'use client';

import { useState, useEffect } from 'react';
import { getEmployeeProfile } from "@/app/actions/employee";
import { User, Mail, Briefcase, Building2, Calendar, BadgeCheck, Hash } from 'lucide-react';

export default function ProfilePage() {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const res = await getEmployeeProfile();
            if (res.success && res.profile) {
                setProfile(res.profile);
            }
            setLoading(false);
        }
        load();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[50vh]">
                <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!profile) {
        return <div className="text-center text-red-500 mt-10">Failed to load profile.</div>;
    }

    return (
        <div className="max-w-4xl mx-auto">
            <header className="mb-8 relative">
                {/* Header Gradient */}
                <div className="absolute top-0 left-0 w-[300px] h-[300px] bg-cyan-500/10 rounded-full blur-[80px] -z-10"></div>

                <h1 className="text-3xl font-bold text-white mb-2">My Profile</h1>
                <p className="text-slate-400">Manage your personal and employment information.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* ID Card / Main Info */}
                <div className="md:col-span-1">
                    <div className="glass-panel p-6 text-center h-full relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                        <div className="w-32 h-32 bg-slate-800 rounded-full mx-auto mb-4 border-4 border-slate-700/50 flex items-center justify-center relative shadow-xl shadow-cyan-500/10">
                            <span className="text-5xl">👨‍💻</span>
                            <div className="absolute bottom-1 right-1 w-6 h-6 bg-green-500 border-4 border-slate-800 rounded-full"></div>
                        </div>

                        <h2 className="text-xl font-bold text-white mb-1">{profile.name}</h2>
                        <p className="text-cyan-400 font-medium mb-4">{profile.position}</p>

                        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
                            <Hash className="w-3 h-3" />
                            ID: <span className="font-mono text-white">{profile.emp_id}</span>
                        </div>
                    </div>
                </div>

                {/* Details Grid */}
                <div className="md:col-span-2">
                    <div className="glass-panel p-8">
                        <h3 className="text-lg font-semibold text-white mb-6 border-b border-white/5 pb-4">Employment Details</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                            <DetailItem icon={Mail} label="Email Address" value={profile.email} />
                            <DetailItem icon={Building2} label="Company" value={profile.company} />
                            <DetailItem icon={Briefcase} label="Department" value={profile.department} />
                            <DetailItem icon={Calendar} label="Date Joined" value={new Date(profile.join_date).toLocaleDateString()} />
                            <DetailItem icon={User} label="Reporting Manager" value={profile.manager} />
                            <DetailItem icon={BadgeCheck} label="Status" value={profile.status} color="text-emerald-400" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DetailItem({ icon: Icon, label, value, color = "text-white" }: any) {
    return (
        <div className="flex items-start gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors">
            <div className="p-2.5 rounded-lg bg-slate-800/80 text-slate-400 ring-1 ring-white/5">
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-xs font-semibold uppercase text-slate-500 mb-1 tracking-wider">{label}</p>
                <p className={`font-medium ${color}`}>{value}</p>
            </div>
        </div>
    );
}
