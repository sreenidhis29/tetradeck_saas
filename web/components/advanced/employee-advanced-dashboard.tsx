"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
    HolidayOptimizerWidget,
    LeaveImpactSimulator,
    CompensationCalculator,
    YearEndOptimizerWidget,
    SmartNotificationCenter
} from "@/components/advanced";
import { Sparkles, Calculator, CalendarDays, Gift, Bell } from "lucide-react";

export function EmployeeAdvancedDashboard() {
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-orange-500 to-pink-600 rounded-xl text-white">
                            <Sparkles className="w-8 h-8" />
                        </div>
                        Smart Leave Assistant
                    </h1>
                    <p className="text-gray-500 mt-1">AI-powered tools to maximize your time off</p>
                </div>
            </div>

            {/* Smart Notifications - Always Visible */}
            <SmartNotificationCenter />

            {/* Tabbed Dashboard */}
            <Tabs defaultValue="holidays" className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-14">
                    <TabsTrigger value="holidays" className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Holiday Optimizer
                    </TabsTrigger>
                    <TabsTrigger value="impact" className="flex items-center gap-2">
                        <Calculator className="w-4 h-4" />
                        Impact Simulator
                    </TabsTrigger>
                    <TabsTrigger value="compensation" className="flex items-center gap-2">
                        <Gift className="w-4 h-4" />
                        Comp-Off Tracker
                    </TabsTrigger>
                    <TabsTrigger value="yearend" className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4" />
                        Year-End Planner
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="holidays" className="mt-6">
                    <HolidayOptimizerWidget />
                </TabsContent>

                <TabsContent value="impact" className="mt-6">
                    <LeaveImpactSimulator />
                </TabsContent>

                <TabsContent value="compensation" className="mt-6">
                    <CompensationCalculator />
                </TabsContent>

                <TabsContent value="yearend" className="mt-6">
                    <YearEndOptimizerWidget />
                </TabsContent>
            </Tabs>
        </div>
    );
}
