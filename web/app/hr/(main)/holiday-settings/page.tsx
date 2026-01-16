"use client";

import { useState, useEffect } from "react";
import { Calendar, ToggleLeft, ToggleRight, Loader2, Globe, CalendarCheck, AlertTriangle, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface Holiday {
    id: string;
    date: string;
    name: string;
    localName?: string;
    isGlobal?: boolean;
}

interface CompanySettings {
    id: string;
    holiday_mode: "auto" | "manual";
    country_code: string;
    custom_holidays?: any;
    blocked_dates?: any;
}

export default function HolidaySettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [settings, setSettings] = useState<CompanySettings | null>(null);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [upcomingHolidays, setUpcomingHolidays] = useState<Holiday[]>([]);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // Fetch settings and holidays on mount
    useEffect(() => {
        fetchData();
    }, [selectedYear]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch company settings
            const settingsRes = await fetch('/api/company/settings');
            const settingsData = await settingsRes.json();
            if (settingsData.success) {
                setSettings(settingsData.settings);
            }

            // Fetch holidays for the selected year
            const holidaysRes = await fetch(`/api/holidays?year=${selectedYear}&country=IN`);
            const holidaysData = await holidaysRes.json();
            if (holidaysData.success) {
                setHolidays(holidaysData.holidays);
            }

            // Fetch upcoming holidays
            const upcomingRes = await fetch('/api/holidays?upcoming=true&country=IN');
            const upcomingData = await upcomingRes.json();
            if (upcomingData.success) {
                setUpcomingHolidays(upcomingData.holidays?.slice(0, 5) || []);
            }
        } catch (error) {
            console.error("Failed to fetch data:", error);
            toast.error("Failed to load holiday settings");
        } finally {
            setLoading(false);
        }
    };

    const toggleHolidayMode = async () => {
        if (!settings) return;
        
        setSaving(true);
        const newMode = settings.holiday_mode === "auto" ? "manual" : "auto";
        
        try {
            const res = await fetch('/api/company/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ holiday_mode: newMode })
            });
            
            const data = await res.json();
            if (data.success) {
                setSettings(data.settings);
                toast.success(`Holiday mode switched to ${newMode.toUpperCase()}`, {
                    description: newMode === "auto" 
                        ? "Employees cannot request leave on public holidays" 
                        : "Employees can choose to work or take leave on holidays"
                });
            } else {
                toast.error(data.error || "Failed to update settings");
            }
        } catch (error) {
            toast.error("Failed to update holiday mode");
        } finally {
            setSaving(false);
        }
    };

    const refreshHolidays = async () => {
        setRefreshing(true);
        try {
            // Force refresh from Nager.Date API by deleting cache and re-fetching
            const res = await fetch(`/api/holidays?year=${selectedYear}&country=IN&refresh=true`);
            const data = await res.json();
            if (data.success) {
                setHolidays(data.holidays);
                toast.success("Holidays refreshed from Nager.Date API");
            }
        } catch (error) {
            toast.error("Failed to refresh holidays");
        } finally {
            setRefreshing(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { 
            weekday: 'short',
            day: 'numeric', 
            month: 'short',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <header className="mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                            <Calendar className="w-8 h-8 text-cyan-400" />
                            Holiday Calendar Settings
                        </h1>
                        <p className="text-slate-400">
                            Manage public holidays and configure how employees can request leave on holidays
                        </p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <Globe className="w-4 h-4 text-green-400" />
                        <span className="text-sm text-green-400 font-mono">Nager.Date API Connected</span>
                    </div>
                </div>
            </header>

            {/* Holiday Mode Toggle Card */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-8 mb-8 border-2 border-white/5"
            >
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <h2 className="text-xl font-bold text-white mb-2">Holiday Mode</h2>
                        <p className="text-slate-400 mb-4">
                            Control how employees can interact with public holidays
                        </p>
                        
                        <div className="grid md:grid-cols-2 gap-6 mt-6">
                            {/* Auto Mode */}
                            <div className={`p-6 rounded-xl border-2 transition-all ${
                                settings?.holiday_mode === 'auto' 
                                    ? 'bg-cyan-500/10 border-cyan-500/50' 
                                    : 'bg-slate-800/30 border-white/5 opacity-60'
                            }`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`p-2 rounded-lg ${
                                        settings?.holiday_mode === 'auto' ? 'bg-cyan-500/20' : 'bg-slate-700'
                                    }`}>
                                        <CalendarCheck className={`w-5 h-5 ${
                                            settings?.holiday_mode === 'auto' ? 'text-cyan-400' : 'text-slate-400'
                                        }`} />
                                    </div>
                                    <h3 className="font-bold text-white">AUTO Mode</h3>
                                    {settings?.holiday_mode === 'auto' && (
                                        <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">ACTIVE</span>
                                    )}
                                </div>
                                <ul className="space-y-2 text-sm text-slate-300">
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                                        Employees <strong>cannot</strong> request leave on public holidays
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                                        Holidays are automatically applied as off days
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                                        Leave balance is not affected by holidays
                                    </li>
                                </ul>
                            </div>

                            {/* Manual Mode */}
                            <div className={`p-6 rounded-xl border-2 transition-all ${
                                settings?.holiday_mode === 'manual' 
                                    ? 'bg-orange-500/10 border-orange-500/50' 
                                    : 'bg-slate-800/30 border-white/5 opacity-60'
                            }`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className={`p-2 rounded-lg ${
                                        settings?.holiday_mode === 'manual' ? 'bg-orange-500/20' : 'bg-slate-700'
                                    }`}>
                                        <AlertTriangle className={`w-5 h-5 ${
                                            settings?.holiday_mode === 'manual' ? 'text-orange-400' : 'text-slate-400'
                                        }`} />
                                    </div>
                                    <h3 className="font-bold text-white">MANUAL Mode</h3>
                                    {settings?.holiday_mode === 'manual' && (
                                        <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full">ACTIVE</span>
                                    )}
                                </div>
                                <ul className="space-y-2 text-sm text-slate-300">
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-orange-400" />
                                        Employees can choose to <strong>work</strong> on holidays
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-orange-400" />
                                        Leave requests on holidays require approval
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-orange-400" />
                                        Flexible for industries requiring holiday work
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Toggle Button */}
                    <div className="ml-8">
                        <button
                            onClick={toggleHolidayMode}
                            disabled={saving}
                            className="group relative"
                        >
                            {settings?.holiday_mode === 'auto' ? (
                                <ToggleRight className={`w-16 h-16 text-cyan-400 transition-all ${saving ? 'opacity-50' : 'hover:scale-110'}`} />
                            ) : (
                                <ToggleLeft className={`w-16 h-16 text-orange-400 transition-all ${saving ? 'opacity-50' : 'hover:scale-110'}`} />
                            )}
                            {saving && (
                                <Loader2 className="absolute inset-0 m-auto w-8 h-8 animate-spin text-white" />
                            )}
                        </button>
                        <p className="text-center text-xs text-slate-500 mt-2">Click to toggle</p>
                    </div>
                </div>
            </motion.div>

            {/* Holiday Calendar Section */}
            <div className="grid lg:grid-cols-3 gap-8">
                {/* Upcoming Holidays */}
                <div className="lg:col-span-1">
                    <div className="glass-panel p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-pink-400" />
                            Upcoming Holidays
                        </h3>
                        <div className="space-y-3">
                            {upcomingHolidays.length > 0 ? (
                                upcomingHolidays.map((holiday, idx) => (
                                    <div key={idx} className="p-3 rounded-lg bg-slate-800/50 border border-white/5">
                                        <div className="font-semibold text-white">{holiday.name || holiday.localName}</div>
                                        <div className="text-sm text-slate-400">{formatDate(holiday.date)}</div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 text-sm italic">No upcoming holidays</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Full Year Calendar */}
                <div className="lg:col-span-2">
                    <div className="glass-panel p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Globe className="w-5 h-5 text-cyan-400" />
                                Public Holidays - India ({selectedYear})
                            </h3>
                            <div className="flex items-center gap-4">
                                <select 
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                    className="px-3 py-1 rounded bg-slate-800 border border-white/10 text-white text-sm"
                                >
                                    {[2024, 2025, 2026, 2027].map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={refreshHolidays}
                                    disabled={refreshing}
                                    className="p-2 rounded-lg bg-slate-800 border border-white/10 hover:bg-slate-700 transition-colors"
                                >
                                    <RefreshCw className={`w-4 h-4 text-slate-400 ${refreshing ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
                            {holidays.map((holiday, idx) => (
                                <motion.div 
                                    key={holiday.id || idx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className="p-4 rounded-lg bg-slate-800/30 border border-white/5 hover:border-cyan-500/30 transition-colors"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="font-semibold text-white">{holiday.name}</div>
                                            {holiday.localName && holiday.localName !== holiday.name && (
                                                <div className="text-xs text-slate-500">{holiday.localName}</div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm text-cyan-400 font-mono">
                                                {new Date(holiday.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {new Date(holiday.date).toLocaleDateString('en-IN', { weekday: 'short' })}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-sm">
                            <span className="text-slate-500">
                                Total: {holidays.length} public holidays
                            </span>
                            <span className="text-slate-500 flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                Data from Nager.Date API
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
