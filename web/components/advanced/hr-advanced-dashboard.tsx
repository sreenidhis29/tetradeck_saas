"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    ConflictResolutionCenter,
    WorkloadBalancerDashboard,
    AttendancePatternsAnalyzer,
    AutoEscalationCenter,
    TeamSynergyDashboard,
    SmartNotificationCenter
} from "@/components/advanced";
import { Zap, Users, Activity, ArrowUpCircle, Heart, Bell } from "lucide-react";

export function HRAdvancedDashboard() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl text-white">
                            <Zap className="w-8 h-8" />
                        </div>
                        Advanced HR Command Center
                    </h1>
                    <p className="text-gray-500 mt-1">AI-powered tools for proactive workforce management</p>
                </div>
            </div>

            {/* Smart Notifications - Always Visible */}
            <SmartNotificationCenter />

            {/* Tabbed Dashboard */}
            <Tabs defaultValue="conflicts" className="w-full">
                <TabsList className="grid w-full grid-cols-5 h-14">
                    <TabsTrigger value="conflicts" className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Conflict Resolution
                    </TabsTrigger>
                    <TabsTrigger value="workload" className="flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Workload
                    </TabsTrigger>
                    <TabsTrigger value="patterns" className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Attendance Patterns
                    </TabsTrigger>
                    <TabsTrigger value="escalations" className="flex items-center gap-2">
                        <ArrowUpCircle className="w-4 h-4" />
                        Escalations
                    </TabsTrigger>
                    <TabsTrigger value="synergy" className="flex items-center gap-2">
                        <Heart className="w-4 h-4" />
                        Team Synergy
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="conflicts" className="mt-6">
                    <ConflictResolutionCenter />
                </TabsContent>

                <TabsContent value="workload" className="mt-6">
                    <WorkloadBalancerDashboard />
                </TabsContent>

                <TabsContent value="patterns" className="mt-6">
                    <AttendancePatternsAnalyzer />
                </TabsContent>

                <TabsContent value="escalations" className="mt-6">
                    <AutoEscalationCenter />
                </TabsContent>

                <TabsContent value="synergy" className="mt-6">
                    <TeamSynergyDashboard />
                </TabsContent>
            </Tabs>
        </div>
    );
}
