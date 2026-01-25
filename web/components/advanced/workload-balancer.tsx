"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { analyzeWorkloadBalance, type WorkloadBalance } from "@/app/actions/advanced-ai-features";
import { AlertTriangle, Activity, Calendar, RefreshCw, Users, TrendingUp, AlertCircle } from "lucide-react";

export function WorkloadBalancerDashboard() {
    const [departments, setDepartments] = useState<WorkloadBalance[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDept, setSelectedDept] = useState<string | null>(null);

    useEffect(() => {
        loadWorkload();
    }, []);

    async function loadWorkload() {
        setLoading(true);
        const result = await analyzeWorkloadBalance();
        if (result.success && result.departments) {
            setDepartments(result.departments);
        }
        setLoading(false);
    }

    const getLoadColor = (load: number, optimal: number) => {
        const diff = load - optimal;
        if (diff > 20) return 'bg-red-500';
        if (diff > 10) return 'bg-orange-500';
        if (diff > 0) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getLoadLabel = (load: number) => {
        if (load > 80) return { text: 'Critical', color: 'bg-red-100 text-red-700' };
        if (load > 70) return { text: 'High', color: 'bg-orange-100 text-orange-700' };
        if (load > 50) return { text: 'Normal', color: 'bg-green-100 text-green-700' };
        return { text: 'Low', color: 'bg-blue-100 text-blue-700' };
    };

    if (loading) {
        return (
            <Card className="animate-pulse">
                <CardHeader>
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-40 bg-gray-100 rounded"></div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Activity className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Workload Balancer</CardTitle>
                            <CardDescription className="text-white/80">
                                Department workload analysis & optimization
                            </CardDescription>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={loadWorkload} className="text-white hover:bg-white/20">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {departments.map((dept) => {
                        const loadInfo = getLoadLabel(dept.currentLoad);
                        const isSelected = selectedDept === dept.department;

                        return (
                            <div 
                                key={dept.department}
                                className={`border rounded-xl transition-all duration-300 overflow-hidden ${
                                    isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div 
                                    className="p-4 cursor-pointer"
                                    onClick={() => setSelectedDept(isSelected ? null : dept.department)}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <Users className="w-5 h-5 text-gray-500" />
                                            <h4 className="font-semibold text-gray-900">{dept.department}</h4>
                                        </div>
                                        <Badge className={loadInfo.color}>{loadInfo.text}</Badge>
                                    </div>

                                    <div className="mb-3">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-500">Current Workload</span>
                                            <span className="font-medium">{dept.currentLoad}%</span>
                                        </div>
                                        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full transition-all duration-500 ${getLoadColor(dept.currentLoad, dept.optimalLoad)}`}
                                                style={{ width: `${dept.currentLoad}%` }}
                                            ></div>
                                        </div>
                                        <div className="flex justify-between text-xs mt-1">
                                            <span className="text-gray-400">Optimal: {dept.optimalLoad}%</span>
                                            {dept.currentLoad > dept.optimalLoad && (
                                                <span className="text-orange-500 font-medium">
                                                    +{dept.currentLoad - dept.optimalLoad}% above optimal
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {dept.overloadedEmployees.length > 0 && (
                                        <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg">
                                            <AlertTriangle className="w-4 h-4 text-red-500" />
                                            <span className="text-sm text-red-700">
                                                {dept.overloadedEmployees.length} employee{dept.overloadedEmployees.length > 1 ? 's' : ''} overloaded
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {isSelected && (
                                    <div className="border-t bg-gray-50 p-4 animate-in slide-in-from-top duration-300">
                                        {dept.overloadedEmployees.length > 0 && (
                                            <div className="mb-4">
                                                <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                                    Overloaded Employees
                                                </h5>
                                                <div className="space-y-2">
                                                    {dept.overloadedEmployees.map((emp, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                                                            <div>
                                                                <span className="font-medium text-gray-900">{emp.name}</span>
                                                                <p className="text-xs text-gray-500">{emp.suggestion}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <Progress value={emp.workload} className="w-16 h-2" />
                                                                <span className="text-sm font-bold text-red-600">{emp.workload}%</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {dept.suggestedLeaveWindows.length > 0 && (
                                            <div>
                                                <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-green-500" />
                                                    Suggested Leave Windows
                                                </h5>
                                                <div className="space-y-2">
                                                    {dept.suggestedLeaveWindows.map((window, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                                                            <div>
                                                                <span className="font-medium text-gray-900">
                                                                    {new Date(window.start).toLocaleDateString('en-US', { 
                                                                        month: 'short', 
                                                                        day: 'numeric' 
                                                                    })} - {new Date(window.end).toLocaleDateString('en-US', { 
                                                                        month: 'short', 
                                                                        day: 'numeric' 
                                                                    })}
                                                                </span>
                                                                <p className="text-xs text-gray-500">{window.reason}</p>
                                                            </div>
                                                            <Button size="sm" variant="outline" className="text-green-600 border-green-300">
                                                                View Details
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {departments.length === 0 && (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <TrendingUp className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">No Data Available</h3>
                        <p className="text-gray-500 mt-1">Workload data will appear once attendance records are available</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
