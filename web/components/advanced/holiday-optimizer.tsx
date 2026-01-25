"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { optimizeHolidays, type HolidayOptimization } from "@/app/actions/advanced-ai-features";
import { Sparkles, Calendar, ArrowRight, RefreshCw, Gift, TrendingUp, Zap } from "lucide-react";

export function HolidayOptimizerWidget() {
    const [optimizations, setOptimizations] = useState<HolidayOptimization[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

    useEffect(() => {
        loadOptimizations();
    }, []);

    async function loadOptimizations() {
        setLoading(true);
        const result = await optimizeHolidays();
        if (result.success && result.optimizations) {
            setOptimizations(result.optimizations);
        }
        setLoading(false);
    }

    const getEfficiencyBadge = (efficiency: number) => {
        if (efficiency >= 4) return <Badge className="bg-purple-500">Excellent</Badge>;
        if (efficiency >= 3) return <Badge className="bg-green-500">Great</Badge>;
        if (efficiency >= 2) return <Badge className="bg-blue-500">Good</Badge>;
        return <Badge className="bg-gray-500">Normal</Badge>;
    };

    const getDateTypeColor = (type: string) => {
        switch (type) {
            case 'holiday': return 'bg-red-100 text-red-700 border-red-200';
            case 'leave': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'weekend': return 'bg-gray-100 text-gray-700 border-gray-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    if (loading) {
        return (
            <Card className="animate-pulse">
                <CardHeader>
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-28 bg-gray-100 rounded"></div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-pink-600 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Holiday Optimizer</CardTitle>
                            <CardDescription className="text-white/80">
                                Maximize days off with smart leave placement
                            </CardDescription>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={loadOptimizations} className="text-white hover:bg-white/20">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                {optimizations.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Gift className="w-8 h-8 text-orange-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">No Upcoming Holidays</h3>
                        <p className="text-gray-500 mt-1">Long weekend opportunities will appear here</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-pink-50 rounded-xl border border-orange-100">
                                <Zap className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-orange-600">
                                    {optimizations.length}
                                </div>
                                <div className="text-xs text-gray-500">Opportunities</div>
                            </div>
                            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                                <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-green-600">
                                    {Math.max(...optimizations.map(o => o.efficiency)).toFixed(1)}x
                                </div>
                                <div className="text-xs text-gray-500">Best Efficiency</div>
                            </div>
                            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                                <Calendar className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-blue-600">
                                    {optimizations.reduce((sum, o) => sum + o.savingsDays, 0)}
                                </div>
                                <div className="text-xs text-gray-500">Extra Days</div>
                            </div>
                        </div>

                        {/* Optimization Cards */}
                        {optimizations.map((opt, idx) => {
                            const isExpanded = expandedIdx === idx;

                            return (
                                <div 
                                    key={idx}
                                    className={`border rounded-xl transition-all duration-300 overflow-hidden ${
                                        isExpanded ? 'border-orange-400 shadow-lg' : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    <div 
                                        className="p-4 cursor-pointer"
                                        onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-gray-900 mb-1">{opt.suggestion}</h4>
                                                <div className="flex items-center gap-4 text-sm text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                                        {opt.leaveDaysNeeded} leave day{opt.leaveDaysNeeded > 1 ? 's' : ''}
                                                    </span>
                                                    <ArrowRight className="w-4 h-4" />
                                                    <span className="flex items-center gap-1">
                                                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                        {opt.totalDaysOff} days off
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                {getEfficiencyBadge(opt.efficiency)}
                                                <span className="text-2xl font-bold text-orange-500">{opt.efficiency}x</span>
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="border-t bg-gray-50 p-4 animate-in slide-in-from-top duration-300">
                                            <h5 className="text-sm font-semibold text-gray-700 mb-3">Date Breakdown</h5>
                                            <div className="flex flex-wrap gap-2 mb-4">
                                                {opt.dates.map((d, i) => (
                                                    <div 
                                                        key={i}
                                                        className={`px-3 py-2 rounded-lg border text-sm font-medium ${getDateTypeColor(d.type)}`}
                                                    >
                                                        <div>{new Date(d.date).toLocaleDateString('en-US', { 
                                                            weekday: 'short', 
                                                            month: 'short', 
                                                            day: 'numeric' 
                                                        })}</div>
                                                        <div className="text-xs opacity-75 capitalize">{d.type}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                                                <div className="text-sm">
                                                    <span className="text-gray-600">You save </span>
                                                    <span className="font-bold text-green-700">{opt.savingsDays} day{opt.savingsDays > 1 ? 's' : ''}</span>
                                                    <span className="text-gray-600"> of leave balance</span>
                                                </div>
                                                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                                    Apply Leave
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
