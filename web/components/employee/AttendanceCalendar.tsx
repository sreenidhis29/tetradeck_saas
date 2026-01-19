'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock, Calendar, Coffee, AlertTriangle } from 'lucide-react';

interface AttendanceRecord {
    date: string;
    check_in: string | null;
    check_out: string | null;
    status: string;
    total_hours: number | null;
}

interface LeaveRecord {
    start_date: string;
    end_date: string;
    leave_type: string;
    status: string;
    is_half_day?: boolean;
}

interface Holiday {
    date: string;
    name: string;
    local_name?: string;
}

interface CalendarProps {
    attendanceRecords: AttendanceRecord[];
    leaveRecords: LeaveRecord[];
    holidays: Holiday[];
    onCheckIn?: () => void;
    onCheckOut?: () => void;
    todayStatus?: {
        checked_in: boolean;
        checked_out: boolean;
        check_in_time?: string;
        check_out_time?: string;
    };
}

type DayStatus = 'worked' | 'leave' | 'upcoming-leave' | 'holiday' | 'weekend' | 'absent' | 'today' | 'future' | 'no-record' | 'half-day-leave';

export default function AttendanceCalendar({
    attendanceRecords,
    leaveRecords,
    holidays,
    onCheckIn,
    onCheckOut,
    todayStatus
}: CalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    
    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    // Build a map of dates to their statuses
    const dateStatusMap = useMemo(() => {
        const map = new Map<string, { status: DayStatus; details: any }>();
        
        // Add holidays
        holidays.forEach(h => {
            const dateKey = h.date.split('T')[0];
            map.set(dateKey, { status: 'holiday', details: h });
        });
        
        // Add leave records - ONLY show APPROVED leaves on calendar
        // Pending/Escalated leaves are NOT confirmed - don't show them as taken
        leaveRecords.forEach(leave => {
            const start = new Date(leave.start_date);
            const end = new Date(leave.end_date);
            const isApproved = leave.status.toLowerCase() === 'approved';
            const isHalfDay = leave.is_half_day || leave.leave_type?.toLowerCase().includes('half');
            
            // ONLY process APPROVED leaves - pending/escalated should NOT appear on calendar
            if (!isApproved) return;
            
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const dateKey = d.toISOString().split('T')[0];
                const dateObj = new Date(d);
                dateObj.setHours(0, 0, 0, 0);
                
                if (isHalfDay) {
                    map.set(dateKey, { status: 'half-day-leave', details: leave });
                } else if (dateObj > today) {
                    map.set(dateKey, { status: 'upcoming-leave', details: leave });
                } else {
                    map.set(dateKey, { status: 'leave', details: leave });
                }
            }
        });
        
        // Add attendance records (these override as they're actual data)
        attendanceRecords.forEach(att => {
            const dateKey = att.date.split('T')[0];
            if (att.status === 'PRESENT' || att.status === 'LATE' || att.status === 'HALF_DAY') {
                map.set(dateKey, { status: 'worked', details: att });
            } else if (att.status === 'ABSENT') {
                map.set(dateKey, { status: 'absent', details: att });
            }
        });
        
        return map;
    }, [attendanceRecords, leaveRecords, holidays, today]);

    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year: number, month: number) => {
        return new Date(year, month, 1).getDay();
    };

    const getDayStatus = (date: Date): DayStatus => {
        const dateKey = date.toISOString().split('T')[0];
        const dateOnly = new Date(date);
        dateOnly.setHours(0, 0, 0, 0);
        
        // Check if today
        if (dateOnly.getTime() === today.getTime()) {
            return 'today';
        }
        
        // Check if weekend
        if (date.getDay() === 0 || date.getDay() === 6) {
            return 'weekend';
        }
        
        // Check map
        const mapped = dateStatusMap.get(dateKey);
        if (mapped) {
            return mapped.status;
        }
        
        // Future date
        if (dateOnly > today) {
            return 'future';
        }
        
        // Past date with no record - show as no-record (NOT fake 'worked')
        return 'no-record';
    };

    const getStatusColor = (status: DayStatus): string => {
        switch (status) {
            case 'worked': return 'bg-emerald-500/30 text-emerald-400 border-emerald-500/40';
            case 'leave': return 'bg-rose-500/30 text-rose-400 border-rose-500/40';
            case 'upcoming-leave': return 'bg-amber-500/30 text-amber-400 border-amber-500/40';
            case 'holiday': return 'bg-slate-500/30 text-slate-400 border-slate-500/40';
            case 'weekend': return 'bg-slate-700/30 text-slate-500 border-slate-700/40';
            case 'absent': return 'bg-red-600/30 text-red-400 border-red-600/40';
            case 'today': return 'bg-cyan-500/30 text-cyan-400 border-cyan-500/50 ring-2 ring-cyan-500';
            case 'future': return 'bg-slate-800/20 text-slate-500';
            case 'no-record': return 'bg-slate-800/10 text-slate-600 border-slate-800/20 border-dashed';
            case 'half-day-leave': return 'half-day-gradient text-white border-emerald-500/40';
            default: return 'bg-slate-800/20 text-slate-500';
        }
    };

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const daysInMonth = getDaysInMonth(year, month);
        const firstDay = getFirstDayOfMonth(year, month);
        const days = [];

        // Empty cells for days before the first day
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-12"></div>);
        }

        // Days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const status = getDayStatus(date);
            const dateKey = date.toISOString().split('T')[0];
            const details = dateStatusMap.get(dateKey);
            const isHalfDay = status === 'half-day-leave';

            days.push(
                <div
                    key={day}
                    onClick={() => setSelectedDate(date)}
                    className={`h-12 flex items-center justify-center rounded-lg cursor-pointer transition-all hover:scale-105 border ${
                        isHalfDay ? 'border-emerald-500/40' : ''
                    } ${isHalfDay ? '' : getStatusColor(status)} ${
                        selectedDate?.toISOString().split('T')[0] === dateKey ? 'ring-2 ring-white' : ''
                    }`}
                    style={isHalfDay ? {background: 'linear-gradient(135deg, #10b981 50%, #6b7280 50%)'} : undefined}
                    title={details?.details?.name || status}
                >
                    <span className="font-medium">{day}</span>
                </div>
            );
        }

        return days;
    };

    const navigateMonth = (direction: number) => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
    };

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Get details for selected date
    const selectedDateDetails = useMemo(() => {
        if (!selectedDate) return null;
        const dateKey = selectedDate.toISOString().split('T')[0];
        return dateStatusMap.get(dateKey);
    }, [selectedDate, dateStatusMap]);

    return (
        <div className="space-y-6">
            {/* Check-in/Check-out Section */}
            <div className="glass-panel p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-cyan-400" />
                    Today's Attendance
                </h3>
                
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <p className="text-slate-400 text-sm">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                        
                        {todayStatus?.checked_in && (
                            <div className="flex items-center gap-2 text-emerald-400">
                                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                                <span className="text-sm">Checked in at {todayStatus.check_in_time}</span>
                            </div>
                        )}
                        
                        {todayStatus?.checked_out && (
                            <div className="flex items-center gap-2 text-slate-400">
                                <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                                <span className="text-sm">Checked out at {todayStatus.check_out_time}</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex gap-3">
                        {!todayStatus?.checked_in ? (
                            <button
                                onClick={onCheckIn}
                                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 rounded-lg font-bold text-white hover:scale-105 transition-transform flex items-center gap-2"
                            >
                                <Clock className="w-5 h-5" />
                                Check In
                            </button>
                        ) : !todayStatus?.checked_out ? (
                            <button
                                onClick={onCheckOut}
                                className="px-6 py-3 bg-gradient-to-r from-rose-500 to-red-600 rounded-lg font-bold text-white hover:scale-105 transition-transform flex items-center gap-2"
                            >
                                <Coffee className="w-5 h-5" />
                                Check Out
                            </button>
                        ) : (
                            <div className="px-6 py-3 bg-slate-700/50 rounded-lg text-slate-400 flex items-center gap-2">
                                ✅ Day Complete
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Calendar Section */}
            <div className="glass-panel p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-cyan-400" />
                        Attendance Calendar
                    </h3>
                    
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigateMonth(-1)}
                            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5 text-slate-400" />
                        </button>
                        
                        <span className="text-white font-medium min-w-[140px] text-center">
                            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </span>
                        
                        <button
                            onClick={() => navigateMonth(1)}
                            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mb-6 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-emerald-500/30 border border-emerald-500/40"></div>
                        <span className="text-slate-400">Worked</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-rose-500/30 border border-rose-500/40"></div>
                        <span className="text-slate-400">On Leave</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{background: 'linear-gradient(135deg, #10b981 50%, #6b7280 50%)'}}></div>
                        <span className="text-slate-400">Half-day Leave</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-amber-500/30 border border-amber-500/40"></div>
                        <span className="text-slate-400">Upcoming Leave</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-slate-500/30 border border-slate-500/40"></div>
                        <span className="text-slate-400">Holiday</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-slate-700/30 border border-slate-700/40"></div>
                        <span className="text-slate-400">Weekend</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-cyan-500/30 border border-cyan-500/50 ring-2 ring-cyan-500"></div>
                        <span className="text-slate-400">Today</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-slate-800/10 border border-slate-800/20 border-dashed"></div>
                        <span className="text-slate-400">No Record</span>
                    </div>
                </div>

                {/* Day names header */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                    {dayNames.map(day => (
                        <div key={day} className="text-center text-slate-500 text-sm font-medium">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-2">
                    {renderCalendar()}
                </div>

                {/* Selected date details */}
                {selectedDate && (
                    <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                        <h4 className="text-white font-medium mb-2">
                            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </h4>
                        
                        {selectedDateDetails ? (
                            <div className="text-sm text-slate-400">
                                {selectedDateDetails.status === 'holiday' && (
                                    <p>🎉 Holiday: {selectedDateDetails.details.name}</p>
                                )}
                                {selectedDateDetails.status === 'leave' && (
                                    <p>🏖️ {selectedDateDetails.details.leave_type} ({selectedDateDetails.details.status})</p>
                                )}
                                {selectedDateDetails.status === 'upcoming-leave' && (
                                    <p>📅 Upcoming: {selectedDateDetails.details.leave_type} (Approved)</p>
                                )}
                                {selectedDateDetails.status === 'worked' && (
                                    <div>
                                        <p>✅ Worked</p>
                                        {selectedDateDetails.details.check_in && (
                                            <p>Check-in: {new Date(selectedDateDetails.details.check_in).toLocaleTimeString()}</p>
                                        )}
                                        {selectedDateDetails.details.check_out && (
                                            <p>Check-out: {new Date(selectedDateDetails.details.check_out).toLocaleTimeString()}</p>
                                        )}
                                        {selectedDateDetails.details.total_hours && (
                                            <p>Total: {selectedDateDetails.details.total_hours} hours</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500">
                                {getDayStatus(selectedDate) === 'weekend' ? '🛋️ Weekend' : 
                                 getDayStatus(selectedDate) === 'future' ? '📆 Future date' :
                                 '📝 No records'}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
