"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { processAutoEscalations, type EscalationStatus } from "@/app/actions/advanced-ai-features";
import { Bell, Clock, ArrowUpCircle, RefreshCw, AlertTriangle, Timer, Send, CheckCircle } from "lucide-react";

export function AutoEscalationCenter() {
    const [escalations, setEscalations] = useState<EscalationStatus[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadEscalations();
    }, []);

    async function loadEscalations() {
        setLoading(true);
        const result = await processAutoEscalations();
        if (result.success && result.escalated) {
            setEscalations(result.escalated);
        }
        setLoading(false);
    }

    const getLevelColor = (level: number) => {
        switch (level) {
            case 1: return 'bg-blue-100 text-blue-700 border-blue-200';
            case 2: return 'bg-orange-100 text-orange-700 border-orange-200';
            case 3: return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getLevelIcon = (level: number) => {
        const className = "w-5 h-5";
        switch (level) {
            case 1: return <Clock className={`${className} text-blue-500`} />;
            case 2: return <AlertTriangle className={`${className} text-orange-500`} />;
            case 3: return <Bell className={`${className} text-red-500`} />;
            default: return <Clock className={`${className} text-gray-500`} />;
        }
    };

    const formatTimeRemaining = (date: Date | null) => {
        if (!date) return 'Max level';
        const now = new Date();
        const diff = new Date(date).getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
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
            <CardHeader className="bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <ArrowUpCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Auto-Escalation Center</CardTitle>
                            <CardDescription className="text-white/80">
                                Automated escalation tracking and management
                            </CardDescription>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={loadEscalations} className="text-white hover:bg-white/20">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                {escalations.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">No Pending Escalations</h3>
                        <p className="text-gray-500 mt-1">All requests are being processed on time</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-center">
                                <div className="text-2xl font-bold text-blue-600">
                                    {escalations.filter(e => e.currentLevel === 1).length}
                                </div>
                                <div className="text-xs text-gray-500">Level 1 - Manager</div>
                            </div>
                            <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 text-center">
                                <div className="text-2xl font-bold text-orange-600">
                                    {escalations.filter(e => e.currentLevel === 2).length}
                                </div>
                                <div className="text-xs text-gray-500">Level 2 - HR</div>
                            </div>
                            <div className="p-4 bg-red-50 rounded-lg border border-red-100 text-center">
                                <div className="text-2xl font-bold text-red-600">
                                    {escalations.filter(e => e.currentLevel === 3).length}
                                </div>
                                <div className="text-xs text-gray-500">Level 3 - Director</div>
                            </div>
                        </div>

                        {escalations.map((esc) => (
                            <div 
                                key={esc.requestId}
                                className="border rounded-xl p-4 hover:border-gray-300 transition-colors"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getLevelColor(esc.currentLevel)}`}>
                                            {getLevelIcon(esc.currentLevel)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge className={getLevelColor(esc.currentLevel)}>
                                                    Level {esc.currentLevel} of {esc.maxLevel}
                                                </Badge>
                                                <span className="text-sm text-gray-500">
                                                    Assigned to: <strong>{esc.escalatedTo}</strong>
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-700">{esc.reason}</p>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                <span className="flex items-center gap-1">
                                                    <Timer className="w-3 h-3" />
                                                    Leave starts: {new Date(esc.deadline).toLocaleDateString()}
                                                </span>
                                                {esc.autoEscalateAt && (
                                                    <span className="flex items-center gap-1 text-orange-600">
                                                        <ArrowUpCircle className="w-3 h-3" />
                                                        Auto-escalates in: {formatTimeRemaining(esc.autoEscalateAt)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline">
                                            View Request
                                        </Button>
                                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                                            <Send className="w-4 h-4 mr-1" />
                                            Remind
                                        </Button>
                                    </div>
                                </div>

                                {/* Escalation Timeline */}
                                <div className="mt-4 pt-4 border-t">
                                    <div className="flex items-center gap-2">
                                        {[1, 2, 3].map((level) => (
                                            <div key={level} className="flex items-center">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                    level < esc.currentLevel 
                                                        ? 'bg-green-500 text-white' 
                                                        : level === esc.currentLevel
                                                        ? getLevelColor(level)
                                                        : 'bg-gray-100 text-gray-400'
                                                }`}>
                                                    {level < esc.currentLevel ? (
                                                        <CheckCircle className="w-4 h-4" />
                                                    ) : (
                                                        <span className="text-sm font-bold">{level}</span>
                                                    )}
                                                </div>
                                                {level < 3 && (
                                                    <div className={`w-8 h-1 ${
                                                        level < esc.currentLevel 
                                                            ? 'bg-green-500' 
                                                            : 'bg-gray-200'
                                                    }`}></div>
                                                )}
                                            </div>
                                        ))}
                                        <div className="ml-3 text-xs text-gray-500">
                                            Manager → HR Manager → HR Director
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
