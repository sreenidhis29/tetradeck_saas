"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { optimizeYearEndLeave, type YearEndOptimization } from "@/app/actions/advanced-ai-features";
import { CalendarDays, AlertTriangle, CheckCircle, TrendingUp, RefreshCw, Zap, Calendar, ArrowRight } from "lucide-react";

export function YearEndOptimizerWidget() {
    const [optimization, setOptimization] = useState<YearEndOptimization | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadOptimization();
    }, []);

    async function loadOptimization() {
        setLoading(true);
        const result = await optimizeYearEndLeave();
        if (result.success && result.optimization) {
            setOptimization(result.optimization);
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
                    <div className="space-y-4">
                        <div className="h-24 bg-gray-100 rounded"></div>
                        <div className="h-32 bg-gray-100 rounded"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!optimization) {
        return (
            <Card>
                <CardContent className="text-center py-12">
                    <p className="text-gray-500">Unable to load optimization data</p>
                </CardContent>
            </Card>
        );
    }

    const urgencyLevel = optimization.expiringDays > 5 ? 'critical' : 
                         optimization.expiringDays > 0 ? 'warning' : 'good';

    return (
        <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-amber-500 to-yellow-600 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <CalendarDays className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Year-End Leave Optimizer</CardTitle>
                            <CardDescription className="text-white/80">
                                Maximize your leave balance utilization
                            </CardDescription>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={loadOptimization} className="text-white hover:bg-white/20">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                {/* Balance Overview */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 text-center">
                        <Calendar className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-blue-600">{optimization.remainingBalance}</div>
                        <div className="text-xs text-gray-500">Remaining Days</div>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100 text-center">
                        <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
                        <div className="text-2xl font-bold text-green-600">{optimization.carryForwardMax}</div>
                        <div className="text-xs text-gray-500">Max Carry Forward</div>
                    </div>
                    <div className={`p-4 rounded-xl border text-center ${
                        urgencyLevel === 'critical' ? 'bg-gradient-to-br from-red-50 to-pink-50 border-red-100' :
                        urgencyLevel === 'warning' ? 'bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-100' :
                        'bg-gradient-to-br from-green-50 to-teal-50 border-green-100'
                    }`}>
                        {urgencyLevel === 'critical' ? (
                            <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
                        ) : urgencyLevel === 'warning' ? (
                            <AlertTriangle className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
                        ) : (
                            <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
                        )}
                        <div className={`text-2xl font-bold ${
                            urgencyLevel === 'critical' ? 'text-red-600' :
                            urgencyLevel === 'warning' ? 'text-yellow-600' : 'text-green-600'
                        }`}>
                            {optimization.expiringDays}
                        </div>
                        <div className="text-xs text-gray-500">Expiring Days</div>
                    </div>
                </div>

                {/* Urgency Banner */}
                {optimization.potentialLoss > 0 ? (
                    <div className={`p-4 rounded-xl mb-6 border-2 ${
                        urgencyLevel === 'critical' 
                            ? 'bg-red-50 border-red-300' 
                            : 'bg-yellow-50 border-yellow-300'
                    }`}>
                        <div className="flex items-start gap-3">
                            <AlertTriangle className={`w-6 h-6 ${
                                urgencyLevel === 'critical' ? 'text-red-500' : 'text-yellow-500'
                            }`} />
                            <div>
                                <h5 className={`font-semibold ${
                                    urgencyLevel === 'critical' ? 'text-red-700' : 'text-yellow-700'
                                }`}>
                                    {urgencyLevel === 'critical' ? 'Urgent Action Required!' : 'Action Needed'}
                                </h5>
                                <p className={`text-sm mt-1 ${
                                    urgencyLevel === 'critical' ? 'text-red-600' : 'text-yellow-600'
                                }`}>
                                    {optimization.recommendation}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 rounded-xl mb-6 bg-green-50 border-2 border-green-300">
                        <div className="flex items-center gap-3">
                            <CheckCircle className="w-6 h-6 text-green-500" />
                            <div>
                                <h5 className="font-semibold text-green-700">All Good!</h5>
                                <p className="text-sm text-green-600">{optimization.recommendation}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Optimal Usage Suggestions */}
                {optimization.optimalUsage.length > 0 && (
                    <div className="mb-6">
                        <h5 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-amber-500" />
                            Recommended Leave Dates
                        </h5>
                        <div className="space-y-2">
                            {optimization.optimalUsage.map((usage, idx) => (
                                <div 
                                    key={idx}
                                    className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-amber-300 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                                            <span className="text-lg font-bold text-amber-600">{usage.days}</span>
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900">
                                                {new Date(usage.date).toLocaleDateString('en-US', {
                                                    month: 'long',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                            <p className="text-xs text-gray-500">{usage.reason}</p>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="outline" className="text-amber-600 border-amber-300">
                                        <ArrowRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Balance Progress */}
                <div className="p-4 bg-gray-50 rounded-xl border">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Leave Balance Utilization</span>
                        <span className="text-sm font-medium">
                            {Math.round(((optimization.remainingBalance - optimization.expiringDays) / optimization.remainingBalance) * 100 || 0)}% optimal
                        </span>
                    </div>
                    <div className="h-4 bg-gray-200 rounded-full overflow-hidden flex">
                        <div 
                            className="bg-green-500 transition-all duration-500"
                            style={{ width: `${Math.min(100, (optimization.carryForwardMax / optimization.remainingBalance) * 100)}%` }}
                        ></div>
                        <div 
                            className="bg-red-400 transition-all duration-500"
                            style={{ width: `${(optimization.expiringDays / optimization.remainingBalance) * 100}%` }}
                        ></div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-green-500"></span>
                            Will carry forward
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded bg-red-400"></span>
                            Will expire
                        </span>
                    </div>
                </div>

                {/* Action Button */}
                {optimization.expiringDays > 0 && (
                    <Button className="w-full mt-6 bg-amber-600 hover:bg-amber-700">
                        Plan Leave for Expiring Days
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
