"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveLeaveConflicts, type ConflictResolution } from "@/app/actions/advanced-ai-features";
import { AlertTriangle, CheckCircle, Calendar, ArrowRight, Users, Zap, RefreshCw } from "lucide-react";

export function ConflictResolutionCenter() {
    const [conflicts, setConflicts] = useState<ConflictResolution[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedConflict, setSelectedConflict] = useState<string | null>(null);

    useEffect(() => {
        loadConflicts();
    }, []);

    async function loadConflicts() {
        setLoading(true);
        const result = await resolveLeaveConflicts();
        if (result.success && result.conflicts) {
            setConflicts(result.conflicts);
        }
        setLoading(false);
    }

    const getRecommendationBadge = (rec: ConflictResolution['recommendation']) => {
        switch (rec) {
            case 'approve':
                return <Badge className="bg-green-500">Approve</Badge>;
            case 'suggest_alternative':
                return <Badge className="bg-yellow-500">Suggest Alternative</Badge>;
            case 'escalate':
                return <Badge className="bg-red-500">Escalate</Badge>;
        }
    };

    const getPriorityColor = (score: number) => {
        if (score >= 70) return 'text-green-600 bg-green-100';
        if (score >= 50) return 'text-yellow-600 bg-yellow-100';
        return 'text-red-600 bg-red-100';
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
                            <div key={i} className="h-24 bg-gray-100 rounded"></div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Zap className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Smart Conflict Resolution</CardTitle>
                            <CardDescription className="text-white/80">
                                AI-powered conflict detection and resolution
                            </CardDescription>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={loadConflicts} className="text-white hover:bg-white/20">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                {conflicts.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">No Conflicts Detected</h3>
                        <p className="text-gray-500 mt-1">All pending requests are conflict-free</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                            <span className="text-sm font-medium text-orange-800">
                                {conflicts.length} conflict{conflicts.length > 1 ? 's' : ''} detected requiring attention
                            </span>
                        </div>

                        {conflicts.map((conflict) => (
                            <div 
                                key={conflict.requestId}
                                className={`border rounded-lg transition-all duration-300 ${
                                    selectedConflict === conflict.requestId 
                                        ? 'border-indigo-500 shadow-lg' 
                                        : 'border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div 
                                    className="p-4 cursor-pointer"
                                    onClick={() => setSelectedConflict(
                                        selectedConflict === conflict.requestId ? null : conflict.requestId
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getPriorityColor(conflict.priorityScore)}`}>
                                                <span className="text-lg font-bold">{conflict.priorityScore}</span>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-gray-900">{conflict.employeeName}</h4>
                                                <p className="text-sm text-gray-500 flex items-center gap-1">
                                                    <Users className="w-4 h-4" />
                                                    Conflicts with: {conflict.conflictsWith.join(', ')}
                                                </p>
                                            </div>
                                        </div>
                                        {getRecommendationBadge(conflict.recommendation)}
                                    </div>
                                </div>

                                {selectedConflict === conflict.requestId && (
                                    <div className="px-4 pb-4 border-t border-gray-100 pt-4 bg-gray-50 rounded-b-lg animate-in slide-in-from-top duration-300">
                                        <p className="text-sm text-gray-700 mb-4 p-3 bg-white rounded border">
                                            <strong>AI Analysis:</strong> {conflict.reasoning}
                                        </p>

                                        {conflict.alternativeDates.length > 0 && (
                                            <div className="mb-4">
                                                <h5 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                                    <Calendar className="w-4 h-4" />
                                                    Suggested Alternative Dates
                                                </h5>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {conflict.alternativeDates.slice(0, 4).map((alt, idx) => (
                                                        <div 
                                                            key={idx} 
                                                            className="flex items-center justify-between p-3 bg-white rounded-lg border hover:border-indigo-300 cursor-pointer transition-colors"
                                                        >
                                                            <div>
                                                                <span className="font-medium text-gray-900">
                                                                    {new Date(alt.date).toLocaleDateString('en-US', { 
                                                                        weekday: 'short', 
                                                                        month: 'short', 
                                                                        day: 'numeric' 
                                                                    })}
                                                                </span>
                                                                <p className="text-xs text-gray-500">{alt.reason}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                                                                    <span className="text-xs font-bold text-green-700">{alt.score}%</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex gap-2">
                                            <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                                Approve Request
                                            </Button>
                                            <Button size="sm" variant="outline">
                                                Suggest Alternative
                                            </Button>
                                            <Button size="sm" variant="outline" className="text-orange-600 border-orange-300">
                                                Escalate to HR
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
