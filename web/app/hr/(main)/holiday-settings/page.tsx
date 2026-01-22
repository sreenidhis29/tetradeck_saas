"use client";

import { useState, useEffect } from "react";
import { Calendar, ToggleLeft, ToggleRight, Loader2, Globe, CalendarCheck, AlertTriangle, RefreshCw, CheckCircle2, Plus, Trash2, Ban, X } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
    getAllHolidays, 
    getHolidaySettings, 
    updateHolidayMode, 
    addCustomHoliday, 
    deleteCustomHoliday,
    addBlockedDate,
    removeBlockedDate,
    refreshHolidays as refreshHolidaysAction 
} from "@/app/actions/holidays";

interface Holiday {
    id: string;
    date: string;
    name: string;
    local_name?: string;
    is_global?: boolean;
    is_custom: boolean;
    source: string;
}

interface BlockedDate {
    id: string;
    date: string;
    reason: string;
}

interface CompanySettings {
    holiday_mode: "auto" | "manual";
    country_code: string;
}

export default function HolidaySettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [settings, setSettings] = useState<CompanySettings | null>(null);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    
    // Modal states
    const [showAddHoliday, setShowAddHoliday] = useState(false);
    const [showBlockDate, setShowBlockDate] = useState(false);
    const [newHoliday, setNewHoliday] = useState({ date: '', name: '', local_name: '' });
    const [newBlockedDate, setNewBlockedDate] = useState({ date: '', reason: '' });

    // Fetch settings and holidays on mount
    useEffect(() => {
        fetchData();
    }, [selectedYear]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch settings
            const settingsResult = await getHolidaySettings();
            if (settingsResult.success && 'settings' in settingsResult && settingsResult.settings) {
                setSettings({
                    holiday_mode: settingsResult.settings.holiday_mode as "auto" | "manual",
                    country_code: settingsResult.settings.country_code
                });
            }

            // Fetch holidays
            const holidaysResult = await getAllHolidays(selectedYear);
            if (holidaysResult.success && 'holidays' in holidaysResult) {
                setHolidays(holidaysResult.holidays || []);
                setBlockedDates(holidaysResult.blocked_dates || []);
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
            const result = await updateHolidayMode(newMode);
            
            if (result.success && 'message' in result) {
                setSettings({ ...settings, holiday_mode: newMode });
                toast.success(`Holiday mode switched to ${newMode.toUpperCase()}`, {
                    description: newMode === "auto" 
                        ? "Employees cannot request leave on public holidays" 
                        : "Employees can choose to work or take leave on holidays"
                });
            } else if (!result.success && 'error' in result) {
                toast.error(result.error || "Failed to update settings");
            }
        } catch (error) {
            toast.error("Failed to update holiday mode");
        } finally {
            setSaving(false);
        }
    };

    const handleRefreshHolidays = async () => {
        setRefreshing(true);
        try {
            const result = await refreshHolidaysAction(selectedYear, settings?.country_code || 'IN');
            if (result.success && 'message' in result) {
                toast.success(result.message || "Holidays refreshed");
                await fetchData();
            } else if (!result.success && 'error' in result) {
                toast.error(result.error || "Failed to refresh holidays");
            }
        } catch (error) {
            toast.error("Failed to refresh holidays");
        } finally {
            setRefreshing(false);
        }
    };

    const handleAddCustomHoliday = async () => {
        if (!newHoliday.date || !newHoliday.name) {
            toast.error("Please fill in date and name");
            return;
        }
        
        setSaving(true);
        try {
            const result = await addCustomHoliday(newHoliday);
            if (result.success && 'message' in result) {
                toast.success(result.message || "Holiday added");
                setShowAddHoliday(false);
                setNewHoliday({ date: '', name: '', local_name: '' });
                await fetchData();
            } else if (!result.success && 'error' in result) {
                toast.error(result.error || "Failed to add holiday");
            }
        } catch (error) {
            toast.error("Failed to add holiday");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteHoliday = async (holidayId: string) => {
        if (!confirm("Delete this custom holiday?")) return;
        
        try {
            const result = await deleteCustomHoliday(holidayId);
            if (result.success) {
                toast.success("Holiday deleted");
                await fetchData();
            } else if ('error' in result) {
                toast.error(result.error || "Failed to delete holiday");
            }
        } catch (error) {
            toast.error("Failed to delete holiday");
        }
    };

    const handleAddBlockedDate = async () => {
        if (!newBlockedDate.date || !newBlockedDate.reason) {
            toast.error("Please fill in date and reason");
            return;
        }
        
        setSaving(true);
        try {
            const result = await addBlockedDate(newBlockedDate);
            if (result.success && 'message' in result) {
                toast.success(result.message || "Date blocked");
                setShowBlockDate(false);
                setNewBlockedDate({ date: '', reason: '' });
                await fetchData();
            } else if (!result.success && 'error' in result) {
                toast.error(result.error || "Failed to block date");
            }
        } catch (error) {
            toast.error("Failed to block date");
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveBlockedDate = async (blockedId: string) => {
        try {
            const result = await removeBlockedDate(blockedId);
            if (result.success) {
                toast.success("Blocked date removed");
                await fetchData();
            } else if ('error' in result) {
                toast.error(result.error || "Failed to remove blocked date");
            }
        } catch (error) {
            toast.error("Failed to remove blocked date");
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
                {/* Blocked Dates + Custom Holidays Panel */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Blocked Dates */}
                    <div className="glass-panel p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Ban className="w-5 h-5 text-rose-400" />
                                Blocked Dates
                            </h3>
                            <button
                                onClick={() => setShowBlockDate(true)}
                                className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">Dates when leave cannot be requested</p>
                        <div className="space-y-2">
                            {blockedDates.length > 0 ? (
                                blockedDates.map((blocked) => (
                                    <div key={blocked.id} className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
                                        <div>
                                            <div className="font-medium text-white text-sm">{blocked.reason}</div>
                                            <div className="text-xs text-slate-400">{formatDate(blocked.date)}</div>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveBlockedDate(blocked.id)}
                                            className="p-1 hover:bg-rose-500/30 rounded text-rose-400"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 text-sm italic text-center py-4">No blocked dates</p>
                            )}
                        </div>
                    </div>

                    {/* Custom Holidays */}
                    <div className="glass-panel p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-emerald-400" />
                                Custom Holidays
                            </h3>
                            <button
                                onClick={() => setShowAddHoliday(true)}
                                className="p-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">Company-specific holidays</p>
                        <div className="space-y-2">
                            {holidays.filter(h => h.is_custom).length > 0 ? (
                                holidays.filter(h => h.is_custom).map((holiday) => (
                                    <div key={holiday.id} className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                                        <div>
                                            <div className="font-medium text-white text-sm">{holiday.name}</div>
                                            <div className="text-xs text-slate-400">{formatDate(holiday.date)}</div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteHoliday(holiday.id)}
                                            className="p-1 hover:bg-emerald-500/30 rounded text-emerald-400"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-slate-500 text-sm italic text-center py-4">No custom holidays</p>
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
                                All Holidays - {settings?.country_code || 'IN'} ({selectedYear})
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
                                    onClick={handleRefreshHolidays}
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
                                    className={`p-4 rounded-lg border transition-colors ${
                                        holiday.is_custom 
                                            ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50' 
                                            : 'bg-slate-800/30 border-white/5 hover:border-cyan-500/30'
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="font-semibold text-white flex items-center gap-2">
                                                {holiday.name}
                                                {holiday.is_custom && (
                                                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] rounded">CUSTOM</span>
                                                )}
                                            </div>
                                            {holiday.local_name && holiday.local_name !== holiday.name && (
                                                <div className="text-xs text-slate-500">{holiday.local_name}</div>
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
                                Total: {holidays.filter(h => !h.is_custom).length} public + {holidays.filter(h => h.is_custom).length} custom holidays
                            </span>
                            <span className="text-slate-500 flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                Data from Nager.Date API
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Custom Holiday Modal */}
            <AnimatePresence>
                {showAddHoliday && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowAddHoliday(false)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 rounded-2xl border border-white/10 p-6 w-full max-w-md"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-emerald-400" />
                                    Add Custom Holiday
                                </h3>
                                <button onClick={() => setShowAddHoliday(false)} className="text-slate-400 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-slate-400 block mb-2">Date *</label>
                                    <input
                                        type="date"
                                        value={newHoliday.date}
                                        onChange={e => setNewHoliday({ ...newHoliday, date: e.target.value })}
                                        className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-lg text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-slate-400 block mb-2">Holiday Name *</label>
                                    <input
                                        type="text"
                                        value={newHoliday.name}
                                        onChange={e => setNewHoliday({ ...newHoliday, name: e.target.value })}
                                        placeholder="e.g., Company Anniversary"
                                        className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-lg text-white placeholder:text-slate-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-slate-400 block mb-2">Local Name (optional)</label>
                                    <input
                                        type="text"
                                        value={newHoliday.local_name}
                                        onChange={e => setNewHoliday({ ...newHoliday, local_name: e.target.value })}
                                        placeholder="e.g., कंपनी वर्षगांठ"
                                        className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-lg text-white placeholder:text-slate-500"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowAddHoliday(false)}
                                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddCustomHoliday}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    Add Holiday
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Block Date Modal */}
            <AnimatePresence>
                {showBlockDate && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowBlockDate(false)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 rounded-2xl border border-white/10 p-6 w-full max-w-md"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Ban className="w-5 h-5 text-rose-400" />
                                    Block Date
                                </h3>
                                <button onClick={() => setShowBlockDate(false)} className="text-slate-400 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <p className="text-sm text-slate-400 mb-4">
                                Blocked dates prevent employees from requesting leave on these days (e.g., critical project deadlines, audits).
                            </p>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-slate-400 block mb-2">Date *</label>
                                    <input
                                        type="date"
                                        value={newBlockedDate.date}
                                        onChange={e => setNewBlockedDate({ ...newBlockedDate, date: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-lg text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-slate-400 block mb-2">Reason *</label>
                                    <input
                                        type="text"
                                        value={newBlockedDate.reason}
                                        onChange={e => setNewBlockedDate({ ...newBlockedDate, reason: e.target.value })}
                                        placeholder="e.g., Quarterly Audit, Product Launch"
                                        className="w-full px-4 py-2 bg-slate-800 border border-white/10 rounded-lg text-white placeholder:text-slate-500"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex gap-3 mt-6">
                                <button
                                    onClick={() => setShowBlockDate(false)}
                                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddBlockedDate}
                                    disabled={saving}
                                    className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                                    Block Date
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
