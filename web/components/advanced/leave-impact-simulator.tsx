"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { simulateLeaveImpact, type LeaveImpact } from "@/app/actions/advanced-ai-features";
import { Calculator, AlertTriangle, CheckCircle, Users, Calendar, Lightbulb, Activity } from "lucide-react";

export function LeaveImpactSimulator() {
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [impact, setImpact] = useState<LeaveImpact | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSimulate() {
        if (!startDate || !endDate) {
            setError("Please select both dates");
            return;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (start > end) {
            setError("End date must be after start date");
            return;
        }

        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        setLoading(true);
        setError(null);
        
        const result = await simulateLeaveImpact(startDate, endDate, days);
        
        if (result.success && result.impact) {
            setImpact(result.impact);
        } else {
            setError(result.error || "Failed to simulate");
        }
        
        setLoading(false);
    }

    const getRiskColor = (risk: string) => {
        switch (risk) {
            case 'high': return 'bg-red-100 text-red-700 border-red-200';
            case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'low': return 'bg-green-100 text-green-700 border-green-200';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getCoverageColor = (coverage: number) => {
        if (coverage >= 80) return 'text-green-600';
        if (coverage >= 60) return 'text-yellow-600';
        return 'text-red-600';
    };

    return (
        <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-t-lg">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-lg">
                        <Calculator className="w-6 h-6" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">Leave Impact Simulator</CardTitle>
                        <CardDescription className="text-white/80">
                            Preview the impact before applying for leave
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                {/* Date Selection */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                        <Label htmlFor="start-date" className="text-sm font-medium text-gray-700 mb-2 block">
                            Start Date
                        </Label>
                        <Input
                            id="start-date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full"
                        />
                    </div>
                    <div>
                        <Label htmlFor="end-date" className="text-sm font-medium text-gray-700 mb-2 block">
                            End Date
                        </Label>
                        <Input
                            id="end-date"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full"
                        />
                    </div>
                </div>

                <Button 
                    onClick={handleSimulate} 
                    disabled={loading}
                    className="w-full mb-6 bg-violet-600 hover:bg-violet-700"
                >
                    {loading ? (
                        <>
                            <Activity className="w-4 h-4 mr-2 animate-spin" />
                            Analyzing Impact...
                        </>
                    ) : (
                        <>
                            <Calculator className="w-4 h-4 mr-2" />
                            Simulate Impact
                        </>
                    )}
                </Button>

                {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <span className="text-red-700">{error}</span>
                    </div>
                )}

                {impact && (
                    <div className="space-y-6 animate-in slide-in-from-bottom duration-300">
                        {/* Risk Level Banner */}
                        <div className={`p-4 rounded-lg border-2 ${getRiskColor(impact.riskLevel)}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {impact.riskLevel === 'low' ? (
                                        <CheckCircle className="w-6 h-6" />
                                    ) : (
                                        <AlertTriangle className="w-6 h-6" />
                                    )}
                                    <span className="font-semibold text-lg capitalize">
                                        {impact.riskLevel} Impact Risk
                                    </span>
                                </div>
                                <Badge className={getRiskColor(impact.riskLevel)}>
                                    {impact.riskLevel === 'low' ? 'Safe to apply' : 
                                     impact.riskLevel === 'medium' ? 'Review suggested' : 'Caution advised'}
                                </Badge>
                            </div>
                        </div>

                        {/* Team Coverage */}
                        <div className="p-4 bg-gray-50 rounded-lg border">
                            <div className="flex items-center gap-2 mb-3">
                                <Users className="w-5 h-5 text-gray-500" />
                                <h5 className="font-semibold text-gray-700">Team Coverage During Leave</h5>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full transition-all duration-500 ${
                                            impact.teamCoverage >= 80 ? 'bg-green-500' :
                                            impact.teamCoverage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                        }`}
                                        style={{ width: `${impact.teamCoverage}%` }}
                                    ></div>
                                </div>
                                <span className={`text-2xl font-bold ${getCoverageColor(impact.teamCoverage)}`}>
                                    {impact.teamCoverage}%
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">
                                {impact.teamCoverage >= 80 
                                    ? 'Excellent coverage - team can handle workload'
                                    : impact.teamCoverage >= 60
                                    ? 'Moderate coverage - some strain possible'
                                    : 'Low coverage - consider alternative dates'}
                            </p>
                        </div>

                        {/* Blocked Collaborators */}
                        {impact.blockedCollaborators.length > 0 && (
                            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <Calendar className="w-5 h-5 text-orange-500" />
                                    <h5 className="font-semibold text-orange-700">Others on Leave</h5>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {impact.blockedCollaborators.map((name, idx) => (
                                        <span 
                                            key={idx}
                                            className="px-3 py-1 bg-white rounded-full text-sm font-medium border border-orange-200"
                                        >
                                            {name}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-sm text-orange-600 mt-2">
                                    These team members are also on leave during your selected dates
                                </p>
                            </div>
                        )}

                        {/* AI Suggestions */}
                        {impact.suggestions.length > 0 && (
                            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-center gap-2 mb-3">
                                    <Lightbulb className="w-5 h-5 text-blue-500" />
                                    <h5 className="font-semibold text-blue-700">AI Suggestions</h5>
                                </div>
                                <ul className="space-y-2">
                                    {impact.suggestions.map((suggestion, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm text-blue-800">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0"></span>
                                            {suggestion}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-4 border-t">
                            <Button 
                                className={`flex-1 ${
                                    impact.riskLevel === 'high' 
                                        ? 'bg-orange-500 hover:bg-orange-600' 
                                        : 'bg-green-600 hover:bg-green-700'
                                }`}
                            >
                                {impact.riskLevel === 'high' ? 'Apply Anyway' : 'Proceed to Apply'}
                            </Button>
                            <Button variant="outline" className="flex-1">
                                Find Better Dates
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
