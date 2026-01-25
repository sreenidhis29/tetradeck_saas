"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Clock,
    Calendar,
    Settings2,
    Plus,
    Trash2,
    Edit2,
    Check,
    X,
    AlertCircle,
    Info,
    ChevronDown,
    ChevronUp,
    Building,
    FileText,
    Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// =========================================================================
// TYPE DEFINITIONS
// =========================================================================

interface WorkSchedule {
    work_start_time: string;
    work_end_time: string;
    grace_period_mins: number;
    half_day_hours: number;
    full_day_hours: number;
    work_days: number[];
    timezone: string;
}

interface LeaveSettings {
    leave_year_start: string;
    carry_forward_max: number;
    probation_leave: boolean;
    negative_balance: boolean;
}

interface LeaveType {
    id?: string;
    code: string;
    name: string;
    description?: string;
    color: string;
    annual_quota: number;
    max_consecutive: number;
    min_notice_days: number;
    requires_document: boolean;
    requires_approval: boolean;
    half_day_allowed: boolean;
    gender_specific?: 'M' | 'F' | 'O' | null;
    carry_forward: boolean;
    max_carry_forward: number;
    is_paid: boolean;
}

interface LeaveRule {
    id?: string;
    name: string;
    description?: string;
    rule_type: string;
    config: Record<string, any>;
    is_blocking: boolean;
    priority: number;
    applies_to_all: boolean;
}

// Auto-approval and escalation settings
interface ApprovalSettings {
    auto_approve_max_days: number;       // Auto-approve requests up to X days
    auto_approve_min_notice: number;     // Require X days notice for auto-approve
    auto_approve_leave_types: string[];  // Which leave types can be auto-approved
    escalate_above_days: number;         // Always escalate requests > X days
    escalate_consecutive_leaves: boolean; // Escalate if taking leave multiple times in a row
    escalate_low_balance: boolean;       // Escalate if remaining balance is low
    max_concurrent_leaves: number;       // Max employees on leave at same time
    min_team_coverage: number;           // Minimum team members must be present
    blackout_dates: string[];            // Dates when no leave is allowed
    blackout_days_of_week: number[];     // Days of week blocked (1=Mon, 7=Sun)
    require_document_above_days: number; // Require document for leaves > X days
}

interface CompanySettingsProps {
    companyId: string;
    initialWorkSchedule?: WorkSchedule;
    initialLeaveSettings?: LeaveSettings;
    initialLeaveTypes?: LeaveType[];
    initialLeaveRules?: LeaveRule[];
    initialApprovalSettings?: ApprovalSettings;
    onComplete: () => void;
    onBack?: () => void;
}

// =========================================================================
// DEFAULT VALUES
// =========================================================================

const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
    work_start_time: "09:00",
    work_end_time: "18:00",
    grace_period_mins: 15,
    half_day_hours: 4,
    full_day_hours: 8,
    work_days: [1, 2, 3, 4, 5],
    timezone: "Asia/Kolkata",
};

const DEFAULT_LEAVE_SETTINGS: LeaveSettings = {
    leave_year_start: "01-01",
    carry_forward_max: 5,
    probation_leave: false,
    negative_balance: false,
};

const DEFAULT_APPROVAL_SETTINGS: ApprovalSettings = {
    auto_approve_max_days: 3,
    auto_approve_min_notice: 1,
    auto_approve_leave_types: ["CL", "SL"],
    escalate_above_days: 5,
    escalate_consecutive_leaves: true,
    escalate_low_balance: true,
    max_concurrent_leaves: 3,
    min_team_coverage: 2,
    blackout_dates: [],
    blackout_days_of_week: [],
    require_document_above_days: 3,
};

const DEFAULT_LEAVE_TYPES: LeaveType[] = [
    {
        code: "CL",
        name: "Casual Leave",
        description: "For personal matters and emergencies",
        color: "#6366f1",
        annual_quota: 12,
        max_consecutive: 3,
        min_notice_days: 1,
        requires_document: false,
        requires_approval: true,
        half_day_allowed: true,
        carry_forward: false,
        max_carry_forward: 0,
        is_paid: true,
    },
    {
        code: "SL",
        name: "Sick Leave",
        description: "For health-related absences",
        color: "#ef4444",
        annual_quota: 12,
        max_consecutive: 7,
        min_notice_days: 0,
        requires_document: true,
        requires_approval: true,
        half_day_allowed: true,
        carry_forward: false,
        max_carry_forward: 0,
        is_paid: true,
    },
    {
        code: "PL",
        name: "Privilege Leave",
        description: "Earned leave for vacations",
        color: "#10b981",
        annual_quota: 15,
        max_consecutive: 15,
        min_notice_days: 7,
        requires_document: false,
        requires_approval: true,
        half_day_allowed: false,
        carry_forward: true,
        max_carry_forward: 30,
        is_paid: true,
    },
    {
        code: "ML",
        name: "Maternity Leave",
        description: "For expecting mothers",
        color: "#f472b6",
        annual_quota: 182,
        max_consecutive: 182,
        min_notice_days: 30,
        requires_document: true,
        requires_approval: true,
        half_day_allowed: false,
        gender_specific: 'F',
        carry_forward: false,
        max_carry_forward: 0,
        is_paid: true,
    },
    {
        code: "PTL",
        name: "Paternity Leave",
        description: "For new fathers",
        color: "#3b82f6",
        annual_quota: 15,
        max_consecutive: 15,
        min_notice_days: 7,
        requires_document: true,
        requires_approval: true,
        half_day_allowed: false,
        gender_specific: 'M',
        carry_forward: false,
        max_carry_forward: 0,
        is_paid: true,
    },
    {
        code: "LWP",
        name: "Leave Without Pay",
        description: "Unpaid leave when quota exhausted",
        color: "#6b7280",
        annual_quota: 0,
        max_consecutive: 30,
        min_notice_days: 7,
        requires_document: false,
        requires_approval: true,
        half_day_allowed: true,
        carry_forward: false,
        max_carry_forward: 0,
        is_paid: false,
    },
];

const DAYS_OF_WEEK = [
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
    { value: 7, label: "Sun" },
];

const TIMEZONES = [
    { value: "Asia/Kolkata", label: "India (IST)" },
    { value: "America/New_York", label: "US Eastern" },
    { value: "America/Los_Angeles", label: "US Pacific" },
    { value: "Europe/London", label: "UK (GMT)" },
    { value: "Asia/Singapore", label: "Singapore" },
    { value: "Asia/Dubai", label: "Dubai (GST)" },
    { value: "Australia/Sydney", label: "Australia Eastern" },
];

const LEAVE_COLORS = [
    "#6366f1", // indigo
    "#ef4444", // red
    "#10b981", // emerald
    "#f59e0b", // amber
    "#3b82f6", // blue
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#14b8a6", // teal
    "#f97316", // orange
    "#6b7280", // gray
];

// =========================================================================
// MAIN COMPONENT
// =========================================================================

export function CompanySettings({
    companyId,
    initialWorkSchedule,
    initialLeaveSettings,
    initialLeaveTypes,
    initialLeaveRules,
    initialApprovalSettings,
    onComplete,
    onBack,
}: CompanySettingsProps) {
    const [activeTab, setActiveTab] = useState("schedule");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Work Schedule State
    const [workSchedule, setWorkSchedule] = useState<WorkSchedule>(
        initialWorkSchedule || DEFAULT_WORK_SCHEDULE
    );

    // Leave Settings State
    const [leaveSettings, setLeaveSettings] = useState<LeaveSettings>(
        initialLeaveSettings || DEFAULT_LEAVE_SETTINGS
    );

    // Approval Settings State (for auto-approve/escalate rules)
    const [approvalSettings, setApprovalSettings] = useState<ApprovalSettings>(
        initialApprovalSettings || DEFAULT_APPROVAL_SETTINGS
    );

    // Leave Types State
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>(
        initialLeaveTypes || DEFAULT_LEAVE_TYPES
    );
    const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
    const [showAddLeaveType, setShowAddLeaveType] = useState(false);

    // Leave Rules State
    const [leaveRules, setLeaveRules] = useState<LeaveRule[]>(initialLeaveRules || []);

    // =====================================================================
    // HANDLERS
    // =====================================================================

    const toggleWorkDay = (day: number) => {
        setWorkSchedule((prev) => ({
            ...prev,
            work_days: prev.work_days.includes(day)
                ? prev.work_days.filter((d) => d !== day)
                : [...prev.work_days, day].sort(),
        }));
    };

    const handleAddLeaveType = (newType: LeaveType) => {
        // Check for duplicate code
        if (leaveTypes.some((lt) => lt.code.toUpperCase() === newType.code.toUpperCase())) {
            setError(`Leave type code '${newType.code}' already exists`);
            return;
        }
        setLeaveTypes((prev) => [...prev, { ...newType, code: newType.code.toUpperCase() }]);
        setShowAddLeaveType(false);
        setError(null);
    };

    const handleUpdateLeaveType = (updatedType: LeaveType) => {
        setLeaveTypes((prev) =>
            prev.map((lt) => (lt.code === updatedType.code ? updatedType : lt))
        );
        setEditingLeaveType(null);
    };

    const handleDeleteLeaveType = (code: string) => {
        setLeaveTypes((prev) => prev.filter((lt) => lt.code !== code));
    };

    // Core save function - used by both Complete and Skip
    const saveAllSettings = async (useDefaults: boolean = false) => {
        const { saveWorkSchedule, saveLeaveSettings, saveApprovalSettings, createLeaveType, completeCompanySetup } =
            await import("@/app/actions/company-settings");

        // Use current state or defaults based on flag
        const scheduleToSave = useDefaults ? DEFAULT_WORK_SCHEDULE : workSchedule;
        const settingsToSave = useDefaults ? DEFAULT_LEAVE_SETTINGS : leaveSettings;
        const approvalToSave = useDefaults ? DEFAULT_APPROVAL_SETTINGS : approvalSettings;
        const typesToSave = useDefaults ? DEFAULT_LEAVE_TYPES : leaveTypes;

        // Save work schedule
        const scheduleResult = await saveWorkSchedule(companyId, scheduleToSave);
        if (!scheduleResult.success) {
            throw new Error(scheduleResult.error || "Failed to save work schedule");
        }

        // Save leave settings
        const settingsResult = await saveLeaveSettings(companyId, settingsToSave);
        if (!settingsResult.success) {
            throw new Error(settingsResult.error || "Failed to save leave settings");
        }

        // Save approval settings (auto-approve/escalate rules)
        const approvalResult = await saveApprovalSettings(companyId, approvalToSave);
        if (!approvalResult.success) {
            throw new Error(approvalResult.error || "Failed to save approval settings");
        }

        // Create leave types
        for (const lt of typesToSave) {
            if (!lt.id) {
                // Only create new ones - ignore "already exists" errors
                const result = await createLeaveType(companyId, lt);
                if (!result.success && !result.error?.includes("already exists")) {
                    console.warn(`Leave type ${lt.code} creation failed:`, result.error);
                    // Don't throw - continue with other types
                }
            }
        }

        // Complete setup - marks onboarding as complete
        const completeResult = await completeCompanySetup(companyId);
        if (!completeResult.success) {
            throw new Error(completeResult.error || "Failed to complete setup");
        }
    };

    const handleComplete = async () => {
        setIsLoading(true);
        setError(null);

        try {
            await saveAllSettings(false); // Use user's configured settings
            onComplete();
        } catch (err: any) {
            console.error("Setup error:", err);
            setError(err.message || "Failed to save settings");
        } finally {
            setIsLoading(false);
        }
    };

    // Handle Skip for Now - saves DEFAULT settings (not empty!)
    const handleSkipForNow = async () => {
        setIsLoading(true);
        setError(null);

        try {
            await saveAllSettings(true); // Use default settings
            onComplete();
        } catch (err: any) {
            console.error("Skip setup error:", err);
            setError(err.message || "Failed to save default settings");
        } finally {
            setIsLoading(false);
        }
    };

    // =====================================================================
    // RENDER
    // =====================================================================

    return (
        <div className="w-full max-w-4xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
            >
                {/* Header */}
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-bold">Configure Your Company</h2>
                    <p className="text-muted-foreground">
                        Set up work schedules, leave policies, and rules for your organization
                    </p>
                </div>

                {/* Error Display */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3"
                        >
                            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                            <p className="text-sm text-destructive">{error}</p>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setError(null)}
                                className="ml-auto"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="schedule" className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span className="hidden sm:inline">Work Schedule</span>
                            <span className="sm:hidden">Schedule</span>
                        </TabsTrigger>
                        <TabsTrigger value="leaves" className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span className="hidden sm:inline">Leave Types</span>
                            <span className="sm:hidden">Leaves</span>
                        </TabsTrigger>
                        <TabsTrigger value="policies" className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            <span className="hidden sm:inline">Policies</span>
                            <span className="sm:hidden">Rules</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Work Schedule Tab */}
                    <TabsContent value="schedule" className="space-y-6 mt-6">
                        <WorkScheduleSection
                            schedule={workSchedule}
                            onChange={setWorkSchedule}
                        />
                    </TabsContent>

                    {/* Leave Types Tab */}
                    <TabsContent value="leaves" className="space-y-6 mt-6">
                        <LeaveTypesSection
                            leaveTypes={leaveTypes}
                            editingType={editingLeaveType}
                            showAdd={showAddLeaveType}
                            onAdd={handleAddLeaveType}
                            onEdit={setEditingLeaveType}
                            onUpdate={handleUpdateLeaveType}
                            onDelete={handleDeleteLeaveType}
                            onShowAdd={setShowAddLeaveType}
                        />
                    </TabsContent>

                    {/* Policies Tab */}
                    <TabsContent value="policies" className="space-y-6 mt-6">
                        <LeavePoliciesSection
                            settings={leaveSettings}
                            approvalSettings={approvalSettings}
                            leaveTypes={leaveTypes}
                            onChange={setLeaveSettings}
                            onApprovalChange={setApprovalSettings}
                        />
                    </TabsContent>
                </Tabs>

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-6 border-t">
                    {onBack && (
                        <Button variant="outline" onClick={onBack}>
                            Back
                        </Button>
                    )}
                    <div className="flex gap-3 ml-auto">
                        <Button
                            variant="outline"
                            onClick={handleSkipForNow}
                            disabled={isLoading}
                        >
                            {isLoading ? "Saving..." : "Skip for Now"}
                        </Button>
                        <Button onClick={handleComplete} disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Check className="h-4 w-4 mr-2" />
                                    Complete Setup
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

// =========================================================================
// WORK SCHEDULE SECTION
// =========================================================================

function WorkScheduleSection({
    schedule,
    onChange,
}: {
    schedule: WorkSchedule;
    onChange: (s: WorkSchedule) => void;
}) {
    return (
        <div className="space-y-6">
            {/* Working Hours */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Working Hours
                    </CardTitle>
                    <CardDescription>
                        Define your company's standard working hours
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Start Time</Label>
                            <Input
                                type="time"
                                value={schedule.work_start_time}
                                onChange={(e) =>
                                    onChange({ ...schedule, work_start_time: e.target.value })
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>End Time</Label>
                            <Input
                                type="time"
                                value={schedule.work_end_time}
                                onChange={(e) =>
                                    onChange({ ...schedule, work_end_time: e.target.value })
                                }
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Grace Period (mins)</Label>
                            <Input
                                type="number"
                                min={0}
                                max={60}
                                value={schedule.grace_period_mins}
                                onChange={(e) =>
                                    onChange({ ...schedule, grace_period_mins: parseInt(e.target.value) || 0 })
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Time after start for check-in
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Half Day Hours</Label>
                            <Input
                                type="number"
                                min={1}
                                max={12}
                                step={0.5}
                                value={schedule.half_day_hours}
                                onChange={(e) =>
                                    onChange({ ...schedule, half_day_hours: parseFloat(e.target.value) || 4 })
                                }
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Full Day Hours</Label>
                            <Input
                                type="number"
                                min={1}
                                max={24}
                                step={0.5}
                                value={schedule.full_day_hours}
                                onChange={(e) =>
                                    onChange({ ...schedule, full_day_hours: parseFloat(e.target.value) || 8 })
                                }
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Working Days */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Working Days
                    </CardTitle>
                    <CardDescription>
                        Select which days are working days
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {DAYS_OF_WEEK.map((day) => (
                            <Button
                                key={day.value}
                                variant={schedule.work_days.includes(day.value) ? "default" : "outline"}
                                size="sm"
                                onClick={() =>
                                    onChange({
                                        ...schedule,
                                        work_days: schedule.work_days.includes(day.value)
                                            ? schedule.work_days.filter((d) => d !== day.value)
                                            : [...schedule.work_days, day.value].sort(),
                                    })
                                }
                                className="w-16"
                            >
                                {day.label}
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Timezone */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        Timezone
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Select
                        value={schedule.timezone}
                        onValueChange={(v) => onChange({ ...schedule, timezone: v })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TIMEZONES.map((tz) => (
                                <SelectItem key={tz.value} value={tz.value}>
                                    {tz.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>
        </div>
    );
}

// =========================================================================
// LEAVE TYPES SECTION
// =========================================================================

function LeaveTypesSection({
    leaveTypes,
    editingType,
    showAdd,
    onAdd,
    onEdit,
    onUpdate,
    onDelete,
    onShowAdd,
}: {
    leaveTypes: LeaveType[];
    editingType: LeaveType | null;
    showAdd: boolean;
    onAdd: (lt: LeaveType) => void;
    onEdit: (lt: LeaveType | null) => void;
    onUpdate: (lt: LeaveType) => void;
    onDelete: (code: string) => void;
    onShowAdd: (show: boolean) => void;
}) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Leave Types</h3>
                    <p className="text-sm text-muted-foreground">
                        Configure the types of leaves available to employees
                    </p>
                </div>
                <Button onClick={() => onShowAdd(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Leave Type
                </Button>
            </div>

            {/* Add New Leave Type Form */}
            <AnimatePresence>
                {showAdd && (
                    <LeaveTypeForm
                        onSave={onAdd}
                        onCancel={() => onShowAdd(false)}
                    />
                )}
            </AnimatePresence>

            {/* Leave Types List */}
            <div className="space-y-3">
                {leaveTypes.map((lt) => (
                    <motion.div
                        key={lt.code}
                        layout
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {editingType?.code === lt.code ? (
                            <LeaveTypeForm
                                initialData={lt}
                                onSave={onUpdate}
                                onCancel={() => onEdit(null)}
                                isEditing
                            />
                        ) : (
                            <LeaveTypeCard
                                leaveType={lt}
                                onEdit={() => onEdit(lt)}
                                onDelete={() => onDelete(lt.code)}
                            />
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

function LeaveTypeCard({
    leaveType,
    onEdit,
    onDelete,
}: {
    leaveType: LeaveType;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: leaveType.color }}
                        />
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-medium">{leaveType.name}</span>
                                <Badge variant="secondary" className="text-xs">
                                    {leaveType.code}
                                </Badge>
                                {!leaveType.is_paid && (
                                    <Badge variant="outline" className="text-xs">
                                        Unpaid
                                    </Badge>
                                )}
                                {leaveType.gender_specific && (
                                    <Badge variant="outline" className="text-xs">
                                        {leaveType.gender_specific === 'F' ? 'Female' : 'Male'} Only
                                    </Badge>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {leaveType.annual_quota} days/year
                                {leaveType.carry_forward && ` • Carry forward up to ${leaveType.max_carry_forward}`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
                            {expanded ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onEdit}>
                            <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <AnimatePresence>
                    {expanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="pt-4 mt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground">Max Consecutive</span>
                                    <p className="font-medium">{leaveType.max_consecutive} days</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Min Notice</span>
                                    <p className="font-medium">{leaveType.min_notice_days} days</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Half Day</span>
                                    <p className="font-medium">{leaveType.half_day_allowed ? "Allowed" : "Not Allowed"}</p>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Document Required</span>
                                    <p className="font-medium">{leaveType.requires_document ? "Yes" : "No"}</p>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}

function LeaveTypeForm({
    initialData,
    onSave,
    onCancel,
    isEditing = false,
}: {
    initialData?: LeaveType;
    onSave: (lt: LeaveType) => void;
    onCancel: () => void;
    isEditing?: boolean;
}) {
    const [formData, setFormData] = useState<LeaveType>(
        initialData || {
            code: "",
            name: "",
            description: "",
            color: LEAVE_COLORS[0],
            annual_quota: 12,
            max_consecutive: 5,
            min_notice_days: 1,
            requires_document: false,
            requires_approval: true,
            half_day_allowed: true,
            gender_specific: null,
            carry_forward: false,
            max_carry_forward: 0,
            is_paid: true,
        }
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.code || !formData.name) return;
        onSave(formData);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
        >
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">
                        {isEditing ? "Edit Leave Type" : "Add Leave Type"}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Basic Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label>Code *</Label>
                                <Input
                                    value={formData.code}
                                    onChange={(e) =>
                                        setFormData({ ...formData, code: e.target.value.toUpperCase() })
                                    }
                                    placeholder="CL"
                                    maxLength={5}
                                    disabled={isEditing}
                                />
                            </div>
                            <div className="space-y-2 col-span-2">
                                <Label>Name *</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Casual Leave"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Color</Label>
                                <div className="flex flex-wrap gap-1">
                                    {LEAVE_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            className={cn(
                                                "w-6 h-6 rounded-full transition-transform",
                                                formData.color === color && "ring-2 ring-offset-2 ring-primary scale-110"
                                            )}
                                            style={{ backgroundColor: color }}
                                            onClick={() => setFormData({ ...formData, color })}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                                value={formData.description || ""}
                                onChange={(e) =>
                                    setFormData({ ...formData, description: e.target.value })
                                }
                                placeholder="For personal matters and emergencies"
                            />
                        </div>

                        {/* Quota Settings */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label>Annual Quota</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={formData.annual_quota}
                                    onChange={(e) =>
                                        setFormData({ ...formData, annual_quota: parseInt(e.target.value) || 0 })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Max Consecutive</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={formData.max_consecutive}
                                    onChange={(e) =>
                                        setFormData({ ...formData, max_consecutive: parseInt(e.target.value) || 1 })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Min Notice (days)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={formData.min_notice_days}
                                    onChange={(e) =>
                                        setFormData({ ...formData, min_notice_days: parseInt(e.target.value) || 0 })
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Gender</Label>
                                <Select
                                    value={formData.gender_specific || "all"}
                                    onValueChange={(v) =>
                                        setFormData({
                                            ...formData,
                                            gender_specific: v === "all" ? null : (v as 'M' | 'F'),
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="M">Male Only</SelectItem>
                                        <SelectItem value="F">Female Only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Toggle Options */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="flex items-center justify-between p-3 rounded-lg border">
                                <Label>Paid Leave</Label>
                                <Switch
                                    checked={formData.is_paid}
                                    onCheckedChange={(v) => setFormData({ ...formData, is_paid: v })}
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg border">
                                <Label>Half Day Allowed</Label>
                                <Switch
                                    checked={formData.half_day_allowed}
                                    onCheckedChange={(v) => setFormData({ ...formData, half_day_allowed: v })}
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg border">
                                <Label>Document Required</Label>
                                <Switch
                                    checked={formData.requires_document}
                                    onCheckedChange={(v) => setFormData({ ...formData, requires_document: v })}
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg border">
                                <Label>Carry Forward</Label>
                                <Switch
                                    checked={formData.carry_forward}
                                    onCheckedChange={(v) => setFormData({ ...formData, carry_forward: v })}
                                />
                            </div>
                            {formData.carry_forward && (
                                <div className="space-y-2 col-span-2">
                                    <Label>Max Carry Forward</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={formData.max_carry_forward}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                max_carry_forward: parseInt(e.target.value) || 0,
                                            })
                                        }
                                    />
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={onCancel}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!formData.code || !formData.name}>
                                {isEditing ? "Update" : "Add"} Leave Type
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </motion.div>
    );
}

// =========================================================================
// LEAVE POLICIES SECTION (with Auto-Approve/Escalate Rules)
// =========================================================================

function LeavePoliciesSection({
    settings,
    approvalSettings,
    leaveTypes,
    onChange,
    onApprovalChange,
}: {
    settings: LeaveSettings;
    approvalSettings: ApprovalSettings;
    leaveTypes: LeaveType[];
    onChange: (s: LeaveSettings) => void;
    onApprovalChange: (s: ApprovalSettings) => void;
}) {
    const [newBlackoutDate, setNewBlackoutDate] = useState("");

    const addBlackoutDate = () => {
        if (newBlackoutDate && !approvalSettings.blackout_dates.includes(newBlackoutDate)) {
            onApprovalChange({
                ...approvalSettings,
                blackout_dates: [...approvalSettings.blackout_dates, newBlackoutDate].sort()
            });
            setNewBlackoutDate("");
        }
    };

    const removeBlackoutDate = (date: string) => {
        onApprovalChange({
            ...approvalSettings,
            blackout_dates: approvalSettings.blackout_dates.filter(d => d !== date)
        });
    };

    const toggleBlackoutDay = (day: number) => {
        const newDays = approvalSettings.blackout_days_of_week.includes(day)
            ? approvalSettings.blackout_days_of_week.filter(d => d !== day)
            : [...approvalSettings.blackout_days_of_week, day].sort();
        onApprovalChange({ ...approvalSettings, blackout_days_of_week: newDays });
    };

    const toggleAutoApproveType = (code: string) => {
        const newTypes = approvalSettings.auto_approve_leave_types.includes(code)
            ? approvalSettings.auto_approve_leave_types.filter(c => c !== code)
            : [...approvalSettings.auto_approve_leave_types, code];
        onApprovalChange({ ...approvalSettings, auto_approve_leave_types: newTypes });
    };

    return (
        <div className="space-y-6">
            {/* Leave Year Settings - Moved to top for basic config */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Leave Year Settings
                    </CardTitle>
                    <CardDescription>
                        Configure when your leave year starts and carry forward policies
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Leave Year Start</Label>
                            <Select
                                value={settings.leave_year_start}
                                onValueChange={(v) =>
                                    onChange({ ...settings, leave_year_start: v })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="01-01">January 1st (Calendar Year)</SelectItem>
                                    <SelectItem value="04-01">April 1st (Indian Fiscal)</SelectItem>
                                    <SelectItem value="07-01">July 1st</SelectItem>
                                    <SelectItem value="10-01">October 1st</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Leave balances reset on this date
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Max Carry Forward (days)</Label>
                            <Input
                                type="number"
                                min={0}
                                value={settings.carry_forward_max}
                                onChange={(e) =>
                                    onChange({
                                        ...settings,
                                        carry_forward_max: parseInt(e.target.value) || 0,
                                    })
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Maximum days that can be carried forward to next year
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* General Leave Policies */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Shield className="h-5 w-5" />
                        Leave Policies
                    </CardTitle>
                    <CardDescription>
                        Additional leave policy configurations
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-lg border">
                            <div>
                                <Label className="text-base">Allow Leave During Probation</Label>
                                <p className="text-sm text-muted-foreground">
                                    Allow employees to take leave during their probation period
                                </p>
                            </div>
                            <Switch
                                checked={settings.probation_leave}
                                onCheckedChange={(v) =>
                                    onChange({ ...settings, probation_leave: v })
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-lg border">
                            <div>
                                <Label className="text-base">Allow Negative Balance</Label>
                                <p className="text-sm text-muted-foreground">
                                    Allow employees to take leave even if balance is zero (adjusted from next allocation)
                                </p>
                            </div>
                            <Switch
                                checked={settings.negative_balance}
                                onCheckedChange={(v) =>
                                    onChange({ ...settings, negative_balance: v })
                                }
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Section Header for Approval Rules */}
            <div className="pt-4 border-t">
                <h3 className="text-lg font-semibold mb-1">AI Approval & Escalation Rules</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Configure how the AI constraint engine automatically approves or escalates leave requests
                </p>
            </div>

            {/* Auto-Approve Rules */}
            <Card className="border-green-500/30 bg-green-500/5">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                        <Check className="h-5 w-5" />
                        Auto-Approve Rules
                    </CardTitle>
                    <CardDescription>
                        Configure when leave requests should be automatically approved without HR intervention
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Auto-approve leaves up to (days)</Label>
                            <Input
                                type="number"
                                min={1}
                                max={30}
                                value={approvalSettings.auto_approve_max_days}
                                onChange={(e) =>
                                    onApprovalChange({
                                        ...approvalSettings,
                                        auto_approve_max_days: parseInt(e.target.value) || 1,
                                    })
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Leaves ≤ {approvalSettings.auto_approve_max_days} days will be auto-approved
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Minimum notice required (days)</Label>
                            <Input
                                type="number"
                                min={0}
                                max={30}
                                value={approvalSettings.auto_approve_min_notice}
                                onChange={(e) =>
                                    onApprovalChange({
                                        ...approvalSettings,
                                        auto_approve_min_notice: parseInt(e.target.value) || 0,
                                    })
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Request must be made {approvalSettings.auto_approve_min_notice} days in advance
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Auto-approve these leave types</Label>
                        <div className="flex flex-wrap gap-2">
                            {leaveTypes.map((lt) => (
                                <Button
                                    key={lt.code}
                                    type="button"
                                    variant={approvalSettings.auto_approve_leave_types.includes(lt.code) ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => toggleAutoApproveType(lt.code)}
                                    className={cn(
                                        "gap-2",
                                        approvalSettings.auto_approve_leave_types.includes(lt.code) && "bg-green-600 hover:bg-green-700"
                                    )}
                                >
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: lt.color }} />
                                    {lt.code}
                                </Button>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Only selected leave types can be auto-approved
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Escalation Rules */}
            <Card className="border-amber-500/30 bg-amber-500/5">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-amber-600">
                        <AlertCircle className="h-5 w-5" />
                        Escalation Rules
                    </CardTitle>
                    <CardDescription>
                        Configure when leave requests should always be sent to HR for review
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Escalate leaves above (days)</Label>
                            <Input
                                type="number"
                                min={1}
                                max={90}
                                value={approvalSettings.escalate_above_days}
                                onChange={(e) =>
                                    onApprovalChange({
                                        ...approvalSettings,
                                        escalate_above_days: parseInt(e.target.value) || 5,
                                    })
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Leaves &gt; {approvalSettings.escalate_above_days} days require HR approval
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Require document above (days)</Label>
                            <Input
                                type="number"
                                min={1}
                                max={30}
                                value={approvalSettings.require_document_above_days}
                                onChange={(e) =>
                                    onApprovalChange({
                                        ...approvalSettings,
                                        require_document_above_days: parseInt(e.target.value) || 3,
                                    })
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Medical/supporting document required for leaves &gt; {approvalSettings.require_document_above_days} days
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-lg border bg-background">
                            <div>
                                <Label className="text-base">Escalate consecutive leave requests</Label>
                                <p className="text-sm text-muted-foreground">
                                    Escalate if employee takes leave multiple times in a short period
                                </p>
                            </div>
                            <Switch
                                checked={approvalSettings.escalate_consecutive_leaves}
                                onCheckedChange={(v) =>
                                    onApprovalChange({ ...approvalSettings, escalate_consecutive_leaves: v })
                                }
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-lg border bg-background">
                            <div>
                                <Label className="text-base">Escalate when balance is low</Label>
                                <p className="text-sm text-muted-foreground">
                                    Escalate if remaining leave balance after approval would be &lt; 2 days
                                </p>
                            </div>
                            <Switch
                                checked={approvalSettings.escalate_low_balance}
                                onCheckedChange={(v) =>
                                    onApprovalChange({ ...approvalSettings, escalate_low_balance: v })
                                }
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Team Coverage Rules */}
            <Card className="border-blue-500/30 bg-blue-500/5">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-blue-600">
                        <Building className="h-5 w-5" />
                        Team Coverage Rules
                    </CardTitle>
                    <CardDescription>
                        Ensure minimum team presence and limit concurrent leaves
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Maximum concurrent leaves</Label>
                            <Input
                                type="number"
                                min={1}
                                max={20}
                                value={approvalSettings.max_concurrent_leaves}
                                onChange={(e) =>
                                    onApprovalChange({
                                        ...approvalSettings,
                                        max_concurrent_leaves: parseInt(e.target.value) || 3,
                                    })
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                Max {approvalSettings.max_concurrent_leaves} employees can be on leave at the same time
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Minimum team coverage</Label>
                            <Input
                                type="number"
                                min={1}
                                max={20}
                                value={approvalSettings.min_team_coverage}
                                onChange={(e) =>
                                    onApprovalChange({
                                        ...approvalSettings,
                                        min_team_coverage: parseInt(e.target.value) || 2,
                                    })
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                At least {approvalSettings.min_team_coverage} team members must be present
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Blackout Dates */}
            <Card className="border-red-500/30 bg-red-500/5">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-red-600">
                        <X className="h-5 w-5" />
                        Blackout Periods
                    </CardTitle>
                    <CardDescription>
                        Dates and days when leave requests will not be auto-approved
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Blackout Days of Week */}
                    <div className="space-y-2">
                        <Label>Block leave on specific days</Label>
                        <div className="flex flex-wrap gap-2">
                            {DAYS_OF_WEEK.map((day) => (
                                <Button
                                    key={day.value}
                                    type="button"
                                    variant={approvalSettings.blackout_days_of_week.includes(day.value) ? "destructive" : "outline"}
                                    size="sm"
                                    onClick={() => toggleBlackoutDay(day.value)}
                                    className="w-16"
                                >
                                    {day.label}
                                </Button>
                            ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Leave requests on these days will require HR approval
                        </p>
                    </div>

                    {/* Blackout Dates */}
                    <div className="space-y-3">
                        <Label>Blackout dates</Label>
                        <div className="flex gap-2">
                            <Input
                                type="date"
                                value={newBlackoutDate}
                                onChange={(e) => setNewBlackoutDate(e.target.value)}
                                className="flex-1"
                            />
                            <Button type="button" onClick={addBlackoutDate} variant="outline" size="icon">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        {approvalSettings.blackout_dates.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {approvalSettings.blackout_dates.map((date) => (
                                    <Badge
                                        key={date}
                                        variant="destructive"
                                        className="px-3 py-1 flex items-center gap-2"
                                    >
                                        {new Date(date).toLocaleDateString('en-US', { 
                                            month: 'short', 
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                        <button
                                            type="button"
                                            onClick={() => removeBlackoutDate(date)}
                                            className="hover:bg-red-700 rounded-full p-0.5"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            No leave will be auto-approved on these specific dates (e.g., audit days, peak business periods)
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Constraint Rules Preview */}
            <Card className="border-purple-500/30 bg-purple-500/5">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-purple-600">
                        <Settings2 className="h-5 w-5" />
                        Constraint Rules Preview
                    </CardTitle>
                    <CardDescription>
                        These 14 AI constraint rules will be created based on your settings above. You can fine-tune them later in HR → Constraint Rules.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {/* Rule 1 - Max Duration */}
                        <div className="flex items-center gap-2 p-2 rounded border bg-background">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-sm flex-1">Maximum Leave Duration</span>
                            <Badge variant="secondary" className="text-xs">
                                {approvalSettings.escalate_above_days}+ days → escalate
                            </Badge>
                        </div>
                        
                        {/* Rule 2 - Balance Check */}
                        <div className="flex items-center gap-2 p-2 rounded border bg-background">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-sm flex-1">Leave Balance Check</span>
                            <Badge variant="secondary" className="text-xs">
                                {approvalSettings.escalate_low_balance ? "Strict" : "Flexible"}
                            </Badge>
                        </div>
                        
                        {/* Rule 3 - Team Coverage */}
                        <div className="flex items-center gap-2 p-2 rounded border bg-background">
                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                            <span className="text-sm flex-1">Minimum Team Coverage</span>
                            <Badge variant="secondary" className="text-xs">
                                Min {approvalSettings.min_team_coverage} present
                            </Badge>
                        </div>
                        
                        {/* Rule 4 - Concurrent Leaves */}
                        <div className="flex items-center gap-2 p-2 rounded border bg-background">
                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                            <span className="text-sm flex-1">Max Concurrent Leaves</span>
                            <Badge variant="secondary" className="text-xs">
                                Max {approvalSettings.max_concurrent_leaves}
                            </Badge>
                        </div>
                        
                        {/* Rule 5 - Blackout Periods */}
                        <div className="flex items-center gap-2 p-2 rounded border bg-background">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-sm flex-1">Blackout Period Check</span>
                            <Badge variant={approvalSettings.blackout_dates.length > 0 || approvalSettings.blackout_days_of_week.length > 0 ? "default" : "outline"} className="text-xs">
                                {approvalSettings.blackout_dates.length + approvalSettings.blackout_days_of_week.length > 0 ? "Active" : "No blackouts"}
                            </Badge>
                        </div>
                        
                        {/* Rule 6 - Notice Period */}
                        <div className="flex items-center gap-2 p-2 rounded border bg-background">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            <span className="text-sm flex-1">Advance Notice Required</span>
                            <Badge variant="secondary" className="text-xs">
                                {approvalSettings.auto_approve_min_notice} days
                            </Badge>
                        </div>
                        
                        {/* Rule 7 - Consecutive Leaves */}
                        <div className="flex items-center gap-2 p-2 rounded border bg-background">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-sm flex-1">Consecutive Leave Limit</span>
                            <Badge variant={approvalSettings.escalate_consecutive_leaves ? "default" : "outline"} className="text-xs">
                                {approvalSettings.escalate_consecutive_leaves ? "Enabled" : "Disabled"}
                            </Badge>
                        </div>
                        
                        {/* Rule 8 - Sandwich Rule */}
                        <div className="flex items-center gap-2 p-2 rounded border bg-background">
                            <div className="w-2 h-2 rounded-full bg-cyan-500" />
                            <span className="text-sm flex-1">Weekend Sandwich Rule</span>
                            <Badge variant="secondary" className="text-xs">Active</Badge>
                        </div>
                        
                        {/* Rule 9 - Gap Between Leaves */}
                        <div className="flex items-center gap-2 p-2 rounded border bg-background">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-sm flex-1">Minimum Gap Between Leaves</span>
                            <Badge variant={approvalSettings.escalate_consecutive_leaves ? "default" : "outline"} className="text-xs">
                                {approvalSettings.escalate_consecutive_leaves ? "7 days" : "Disabled"}
                            </Badge>
                        </div>
                        
                        {/* Rule 10 - Probation */}
                        <div className="flex items-center gap-2 p-2 rounded border bg-background">
                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                            <span className="text-sm flex-1">Probation Restriction</span>
                            <Badge variant="secondary" className="text-xs">
                                {settings.probation_leave ? "Allow all" : "Limited"}
                            </Badge>
                        </div>
                        
                        {/* Rule 11 - Project Freeze */}
                        <div className="flex items-center gap-2 p-2 rounded border bg-background opacity-60">
                            <div className="w-2 h-2 rounded-full bg-gray-400" />
                            <span className="text-sm flex-1">Critical Project Freeze</span>
                            <Badge variant="outline" className="text-xs">Disabled</Badge>
                        </div>
                        
                        {/* Rule 12 - Document Required */}
                        <div className="flex items-center gap-2 p-2 rounded border bg-background">
                            <div className="w-2 h-2 rounded-full bg-pink-500" />
                            <span className="text-sm flex-1">Document Requirement</span>
                            <Badge variant="secondary" className="text-xs">
                                {approvalSettings.require_document_above_days}+ days
                            </Badge>
                        </div>
                        
                        {/* Rule 13 - Monthly Quota */}
                        <div className="flex items-center gap-2 p-2 rounded border bg-background">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-sm flex-1">Monthly Leave Quota</span>
                            <Badge variant="secondary" className="text-xs">Max 5/month</Badge>
                        </div>
                        
                        {/* Rule 14 - Half-Day Escalation */}
                        <div className="flex items-center gap-2 p-2 rounded border bg-background">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-sm flex-1">Half-Day Escalation</span>
                            <Badge variant="secondary" className="text-xs">Always review</Badge>
                        </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mt-4 text-center">
                        💡 After setup, go to <strong>HR → Constraint Rules</strong> to enable/disable individual rules and customize their settings
                    </p>
                </CardContent>
            </Card>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3">
                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium">How the AI Constraint Engine works</p>
                    <p className="mt-1">
                        When an employee submits a leave request, the system automatically evaluates it against your configured rules. 
                        Requests meeting auto-approve criteria are approved instantly. Others are escalated to HR for manual review.
                    </p>
                </div>
            </div>
        </div>
    );
}

export default CompanySettings;
