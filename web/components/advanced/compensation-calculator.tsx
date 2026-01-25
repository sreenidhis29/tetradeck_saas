"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { calculateCompensation, type CompensationCalc } from "@/app/actions/advanced-ai-features";
import { Calculator, Clock, Calendar, Gift, RefreshCw, TrendingUp, AlertTriangle } from "lucide-react";

export function CompensationCalculator() {
    const [compensation, setCompensation] = useState<CompensationCalc | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCompensation();
    }, []);

    async function loadCompensation() {
        setLoading(true);
        const result = await calculateCompensation();
        if (result.success && result.compensation) {
            setCompensation(result.compensation);
        }
        setLoading(false);
    }

    if (loading) {
        return (
            <Card className="animate-pulse">
                <CardHeader>
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-24 bg-gray-100 rounded"></div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!compensation) {
        return (
            <Card>
                <CardContent className="text-center py-12">
                    <p className="text-gray-500">Unable to load compensation data</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Calculator className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Compensation Calculator</CardTitle>
                            <CardDescription className="text-white/80">
                                Track overtime, weekend work & comp-off earned
                            </CardDescription>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={loadCompensation} className="text-white hover:bg-white/20">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-5 h-5 text-blue-500" />
                            <span className="text-xs text-gray-500">Overtime Hours</span>
                        </div>
                        <div className="text-3xl font-bold text-blue-600">{compensation.overtimeHours}</div>
                        <div className="text-xs text-gray-400">Last 90 days</div>
                    </div>

                    <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-100">
                        <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-5 h-5 text-orange-500" />
                            <span className="text-xs text-gray-500">Weekend Days</span>
                        </div>
                        <div className="text-3xl font-bold text-orange-600">{compensation.weekendDays}</div>
                        <div className="text-xs text-gray-400">Worked</div>
                    </div>

                    <div className="p-4 bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border border-red-100">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="w-5 h-5 text-red-500" />
                            <span className="text-xs text-gray-500">Holiday Work</span>
                        </div>
                        <div className="text-3xl font-bold text-red-600">{compensation.holidayWork}</div>
                        <div className="text-xs text-gray-400">Days</div>
                    </div>

                    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
                        <div className="flex items-center gap-2 mb-2">
                            <Gift className="w-5 h-5 text-green-500" />
                            <span className="text-xs text-gray-500">Earned Comp-Off</span>
                        </div>
                        <div className="text-3xl font-bold text-green-600">{compensation.earnedCompOff}</div>
                        <div className="text-xs text-gray-400">Days</div>
                    </div>
                </div>

                {/* Calculation Breakdown */}
                <div className="p-4 bg-gray-50 rounded-xl border mb-6">
                    <h5 className="font-semibold text-gray-700 mb-4">How Comp-Off is Calculated</h5>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Overtime (16 hrs = 1 day)</span>
                            <span className="font-medium">{(compensation.overtimeHours / 16).toFixed(1)} days</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Weekend work (1:1)</span>
                            <span className="font-medium">{compensation.weekendDays} days</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Holiday work (1.5x)</span>
                            <span className="font-medium">{(compensation.holidayWork * 1.5).toFixed(1)} days</span>
                        </div>
                        <div className="border-t pt-3 flex items-center justify-between">
                            <span className="font-semibold text-gray-700">Total Earned</span>
                            <span className="text-xl font-bold text-green-600">{compensation.earnedCompOff} days</span>
                        </div>
                    </div>
                </div>

                {/* Expiring Days Warning */}
                {compensation.expiringDays.length > 0 && (
                    <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200 mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-600" />
                            <h5 className="font-semibold text-yellow-700">Expiring Soon</h5>
                        </div>
                        {compensation.expiringDays.map((exp, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                                <div>
                                    <span className="font-bold text-yellow-700">{exp.days} comp-off day{exp.days > 1 ? 's' : ''}</span>
                                    <span className="text-sm text-gray-500 ml-2">expire on {new Date(exp.expiresOn).toLocaleDateString()}</span>
                                </div>
                                <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700">
                                    Use Now
                                </Button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Status */}
                {compensation.pendingApproval > 0 && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <span className="text-blue-700">
                            <strong>{compensation.pendingApproval}</strong> comp-off day{compensation.pendingApproval > 1 ? 's' : ''} pending approval
                        </span>
                        <Badge className="bg-blue-100 text-blue-700">Pending</Badge>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-6 pt-6 border-t">
                    <Button className="flex-1 bg-green-600 hover:bg-green-700">
                        <Gift className="w-4 h-4 mr-2" />
                        Apply Comp-Off
                    </Button>
                    <Button variant="outline" className="flex-1">
                        View History
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
