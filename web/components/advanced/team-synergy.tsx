"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { analyzeTeamSynergy, type TeamSynergy } from "@/app/actions/advanced-ai-features";
import { Users, Heart, AlertTriangle, RefreshCw, Lightbulb, TrendingUp, Zap } from "lucide-react";

export function TeamSynergyDashboard() {
    const [synergies, setSynergies] = useState<TeamSynergy[]>([]);
    const [insights, setInsights] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSynergy();
    }, []);

    async function loadSynergy() {
        setLoading(true);
        const result = await analyzeTeamSynergy();
        if (result.success) {
            setSynergies(result.synergies || []);
            setInsights(result.insights || []);
        }
        setLoading(false);
    }

    const getSynergyColor = (score: number) => {
        if (score >= 70) return 'text-green-600';
        if (score >= 40) return 'text-yellow-600';
        return 'text-red-600';
    };

    const getSynergyBadge = (score: number) => {
        if (score >= 70) return <Badge className="bg-green-100 text-green-700">Great Pair</Badge>;
        if (score >= 40) return <Badge className="bg-yellow-100 text-yellow-700">Moderate</Badge>;
        return <Badge className="bg-red-100 text-red-700">Overlapping</Badge>;
    };

    const getProgressColor = (score: number) => {
        if (score >= 70) return 'bg-green-500';
        if (score >= 40) return 'bg-yellow-500';
        return 'bg-red-500';
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
            <CardHeader className="bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Heart className="w-6 h-6" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Team Synergy Analyzer</CardTitle>
                            <CardDescription className="text-white/80">
                                Discover optimal team combinations
                            </CardDescription>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={loadSynergy} className="text-white hover:bg-white/20">
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                {/* Insights Banner */}
                {insights.length > 0 && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl border border-pink-200">
                        <div className="flex items-start gap-3">
                            <Lightbulb className="w-5 h-5 text-pink-500 mt-0.5" />
                            <div>
                                <h5 className="font-semibold text-pink-800 mb-2">AI Insights</h5>
                                <ul className="space-y-1">
                                    {insights.map((insight, idx) => (
                                        <li key={idx} className="text-sm text-pink-700 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-pink-400"></span>
                                            {insight}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {synergies.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Users className="w-8 h-8 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Not Enough Data</h3>
                        <p className="text-gray-500 mt-1">Team synergy patterns will appear as more leave data is collected</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-center">
                                <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-green-600">
                                    {synergies.filter(s => s.synergyScore >= 70).length}
                                </div>
                                <div className="text-xs text-gray-500">Great Pairs</div>
                            </div>
                            <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100 text-center">
                                <Users className="w-6 h-6 text-yellow-500 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-yellow-600">
                                    {synergies.filter(s => s.synergyScore >= 40 && s.synergyScore < 70).length}
                                </div>
                                <div className="text-xs text-gray-500">Moderate</div>
                            </div>
                            <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-center">
                                <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-red-600">
                                    {synergies.filter(s => s.synergyScore < 40).length}
                                </div>
                                <div className="text-xs text-gray-500">Need Attention</div>
                            </div>
                        </div>

                        {/* Synergy Cards */}
                        {synergies.map((synergy, idx) => (
                            <div 
                                key={idx}
                                className="border rounded-xl p-4 hover:border-gray-300 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex -space-x-2">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white font-bold border-2 border-white">
                                                {synergy.combination[0].charAt(0)}
                                            </div>
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold border-2 border-white">
                                                {synergy.combination[1].charAt(0)}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-gray-900">{synergy.combination.join(' & ')}</h4>
                                            <p className="text-xs text-gray-500">
                                                {synergy.collaborationCount} complementary, {synergy.conflictCount} overlapping
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getSynergyBadge(synergy.synergyScore)}
                                        <div className={`text-2xl font-bold ${getSynergyColor(synergy.synergyScore)}`}>
                                            {synergy.synergyScore}%
                                        </div>
                                    </div>
                                </div>

                                {/* Synergy Bar */}
                                <div className="mb-3">
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-500 ${getProgressColor(synergy.synergyScore)}`}
                                            style={{ width: `${synergy.synergyScore}%` }}
                                        ></div>
                                    </div>
                                </div>

                                {/* Recommendation */}
                                <div className="p-3 bg-gray-50 rounded-lg flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-600">{synergy.recommendation}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
