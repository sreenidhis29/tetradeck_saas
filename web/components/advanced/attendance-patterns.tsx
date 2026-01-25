"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { analyzeAttendancePatterns, type AttendancePattern } from "@/app/actions/advanced-ai-features";
import { Eye, RefreshCw, AlertTriangle, CheckCircle, Clock, TrendingDown, TrendingUp, Award } from "lucide-react";

export function AttendancePatternsAnalyzer() {
    const [patterns, setPatterns] = useState<AttendancePattern[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'issues' | 'excellent'>('all');

    useEffect(() => {
        loadPatterns();
    }, []);

    async function loadPatterns() {
        setLoading(true);
        const result = await analyzeAttendancePatterns();
        if (result.success && result.patterns) {
            setPatterns(result.patterns);
        }
        setLoading(false);
    }

    const getPatternIcon = (type: string) => {
        switch (type) {
            case 'late_day': return <Clock className="w-4 h-4 text-orange-500" />;
            case 'overtime': return <TrendingUp className="w-4 h-4 text-red-500" />;
            case 'early_leave': return <TrendingDown className="w-4 h-4 text-yellow-500" />;
            case 'consistent': return <Award className="w-4 h-4 text-green-500" />;
            default: return <Eye className="w-4 h-4 text-gray-500" />;
        }
    };

    const getPatternBadge = (type: string) => {
        switch (type) {
            case 'late_day': return <Badge className="bg-orange-100 text-orange-700">Late Pattern</Badge>;
            case 'overtime': return <Badge className="bg-red-100 text-red-700">Overtime</Badge>;
            case 'early_leave': return <Badge className="bg-yellow-100 text-yellow-700">Early Leave</Badge>;
            case 'consistent': return <Badge className="bg-green-100 text-green-700">Excellent</Badge>;
            default: return <Badge className="bg-gray-100 text-gray-700">Pattern</Badge>;
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-green-600';
        if (score >= 70) return 'text-blue-600';
        if (score >= 50) return 'text-yellow-600';
        return 'text-red-600';
    };

    const filteredPatterns = patterns.filter(p => {
        if (filter === 'issues') return p.overallScore < 80;
        if (filter === 'excellent') return p.overallScore >= 90;
        return true;
    });

    if (loading) {
        return (
            <Card className="animate-pulse">
                <CardHeader>
                    <div className="h-6 bg-gray-200 rounded w-1/3"></div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-32 bg-gray-100 rounded"></div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Eye className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Attendance Pattern Analyzer</CardTitle>
                            <CardDescription className="text-white/80">
                                AI-detected behavioral patterns in attendance
                            </CardDescription>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={loadPatterns} className="text-white hover:bg-white/20">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                {/* Filter Tabs */}
                <div className="flex gap-2 mb-6">
                    <Button 
                        size="sm" 
                        variant={filter === 'all' ? 'default' : 'outline'}
                        onClick={() => setFilter('all')}
                    >
                        All ({patterns.length})
                    </Button>
                    <Button 
                        size="sm" 
                        variant={filter === 'issues' ? 'default' : 'outline'}
                        onClick={() => setFilter('issues')}
                        className={filter === 'issues' ? 'bg-orange-500' : ''}
                    >
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        Needs Attention ({patterns.filter(p => p.overallScore < 80).length})
                    </Button>
                    <Button 
                        size="sm" 
                        variant={filter === 'excellent' ? 'default' : 'outline'}
                        onClick={() => setFilter('excellent')}
                        className={filter === 'excellent' ? 'bg-green-500' : ''}
                    >
                        <Award className="w-4 h-4 mr-1" />
                        Excellent ({patterns.filter(p => p.overallScore >= 90).length})
                    </Button>
                </div>

                {filteredPatterns.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">No Patterns Found</h3>
                        <p className="text-gray-500 mt-1">
                            {filter === 'issues' 
                                ? 'No attendance issues detected' 
                                : filter === 'excellent'
                                ? 'No excellent attendance records yet'
                                : 'Attendance patterns will appear as data is collected'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredPatterns.map((emp) => (
                            <div key={emp.employeeId} className="border rounded-xl p-4 hover:border-gray-300 transition-colors">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                            emp.overallScore >= 90 ? 'bg-green-100' : 
                                            emp.overallScore >= 70 ? 'bg-blue-100' : 'bg-orange-100'
                                        }`}>
                                            <span className={`text-lg font-bold ${getScoreColor(emp.overallScore)}`}>
                                                {emp.overallScore}
                                            </span>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-gray-900">{emp.employeeName}</h4>
                                            <p className="text-sm text-gray-500">
                                                {emp.patterns.length} pattern{emp.patterns.length > 1 ? 's' : ''} detected
                                            </p>
                                        </div>
                                    </div>
                                    <div className="w-32">
                                        <div className="text-xs text-gray-500 text-right mb-1">Attendance Score</div>
                                        <Progress value={emp.overallScore} className="h-2" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {emp.patterns.map((pattern, idx) => (
                                        <div 
                                            key={idx} 
                                            className={`p-3 rounded-lg border ${
                                                pattern.type === 'consistent' 
                                                    ? 'bg-green-50 border-green-200' 
                                                    : 'bg-gray-50 border-gray-200'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-0.5">{getPatternIcon(pattern.type)}</div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {getPatternBadge(pattern.type)}
                                                            <span className="text-xs text-gray-500">{pattern.frequency}</span>
                                                        </div>
                                                        <p className="text-sm text-gray-700">{pattern.description}</p>
                                                        {pattern.days.length > 0 && (
                                                            <div className="flex gap-1 mt-2">
                                                                {pattern.days.map((day, i) => (
                                                                    <span key={i} className="px-2 py-0.5 bg-white rounded text-xs font-medium border">
                                                                        {day}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-2 pt-2 border-t border-gray-200">
                                                <p className="text-xs text-gray-600">
                                                    <span className="font-medium">Recommendation:</span> {pattern.recommendation}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
