"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    RefreshCw, AlertTriangle, Settings, Edit2, X, Save, Plus, Trash2,
    ToggleLeft, ToggleRight, Shield, Clock, Users, Calendar, FileText,
    Calculator, Gauge, Binary, AlertCircle, ChevronDown, ChevronRight,
    RotateCcw, Check, Info, Search, Filter, Zap
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";
import {
    getCompanyConstraintRules,
    initializeCompanyRules,
    toggleRuleStatus,
    updateRuleConfig,
    createCustomRule,
    deleteRule,
    resetToDefaultRules,
    bulkUpdateRuleStatus,
    RULE_CATEGORIES,
    DEFAULT_CONSTRAINT_RULES,
    type ConstraintRule
} from "@/app/actions/constraint-rules";

// Category icons mapping
const categoryIcons: Record<string, any> = {
    limits: Gauge,
    balance: Calculator,
    coverage: Users,
    blackout: Calendar,
    notice: Clock,
    calculation: Binary,
    eligibility: Shield,
    documentation: FileText,
    escalation: AlertTriangle
};

// Category colors
const categoryColors: Record<string, string> = {
    limits: "blue",
    balance: "green", 
    coverage: "purple",
    blackout: "red",
    notice: "yellow",
    calculation: "cyan",
    eligibility: "orange",
    documentation: "pink",
    escalation: "amber"
};

export default function ConstraintRulesPage() {
    const [rules, setRules] = useState<ConstraintRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingRule, setEditingRule] = useState<ConstraintRule | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(Object.keys(RULE_CATEGORIES)));
    const [searchQuery, setSearchQuery] = useState("");
    const [filterCategory, setFilterCategory] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
    const { confirmAction } = useConfirm();

    // New rule form state with config builder
    const [newRule, setNewRule] = useState({
        name: "",
        description: "",
        category: "limits",
        is_blocking: true,
        priority: 50,
        config: {} as Record<string, any>
    });

    // Config builder state for user-friendly input
    const [configBuilder, setConfigBuilder] = useState({
        // Limits
        max_days: "",
        min_days: "",
        // Notice
        min_notice_days: "",
        // Coverage
        max_concurrent: "",
        min_team_available: "",
        // Blackout
        blocked_days: [] as string[],
        blocked_dates: [] as string[],
        // Eligibility
        min_tenure_months: "",
        allowed_departments: "",
        blocked_departments: "",
        // Escalation
        escalate_always: false,
        escalate_above_days: "",
        // General
        applies_to_types: "",
        excluded_types: "",
        custom_message: "",
    });

    // Build config object from builder state when category changes
    useEffect(() => {
        const config: Record<string, any> = {};
        
        // Limits
        if (configBuilder.max_days) config.max_days = parseInt(configBuilder.max_days);
        if (configBuilder.min_days) config.min_days = parseInt(configBuilder.min_days);
        
        // Notice
        if (configBuilder.min_notice_days) config.min_notice_days = parseInt(configBuilder.min_notice_days);
        
        // Coverage
        if (configBuilder.max_concurrent) config.max_concurrent = parseInt(configBuilder.max_concurrent);
        if (configBuilder.min_team_available) config.min_team_available = parseInt(configBuilder.min_team_available);
        
        // Blackout
        if (configBuilder.blocked_days.length) config.blocked_days = configBuilder.blocked_days;
        if (configBuilder.blocked_dates.length) config.blocked_dates = configBuilder.blocked_dates;
        
        // Eligibility
        if (configBuilder.min_tenure_months) config.min_tenure_months = parseInt(configBuilder.min_tenure_months);
        if (configBuilder.allowed_departments) config.allowed_departments = configBuilder.allowed_departments.split(",").map(s => s.trim()).filter(Boolean);
        if (configBuilder.blocked_departments) config.blocked_departments = configBuilder.blocked_departments.split(",").map(s => s.trim()).filter(Boolean);
        
        // Escalation
        if (configBuilder.escalate_always) config.escalate_always = true;
        if (configBuilder.escalate_above_days) config.escalate_above_days = parseInt(configBuilder.escalate_above_days);
        
        // General filters
        if (configBuilder.applies_to_types) config.applies_to_types = configBuilder.applies_to_types.split(",").map(s => s.trim()).filter(Boolean);
        if (configBuilder.excluded_types) config.excluded_types = configBuilder.excluded_types.split(",").map(s => s.trim()).filter(Boolean);
        if (configBuilder.custom_message) config.custom_message = configBuilder.custom_message;
        
        setNewRule(prev => ({ ...prev, config }));
    }, [configBuilder]);

    // Edit form state
    const [editForm, setEditForm] = useState<{
        name: string;
        description: string;
        is_blocking: boolean;
        priority: number;
        config: Record<string, any>;
    } | null>(null);

    async function fetchRules() {
        try {
            setLoading(true);
            setError(null);
            
            // First try to initialize if needed
            await initializeCompanyRules();
            
            const result = await getCompanyConstraintRules();
            if (result.success && result.rules) {
                setRules(result.rules);
            } else {
                setError(result.error || "Failed to load rules");
            }
        } catch (err) {
            console.error("Error fetching rules:", err);
            setError("Unable to load constraint rules");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchRules();
    }, []);

    // Filter and group rules
    const filteredRules = useMemo(() => {
        let filtered = rules;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(r => 
                r.name.toLowerCase().includes(query) ||
                r.description.toLowerCase().includes(query) ||
                r.rule_id.toLowerCase().includes(query)
            );
        }

        if (filterCategory) {
            filtered = filtered.filter(r => r.category === filterCategory);
        }

        if (filterStatus !== "all") {
            filtered = filtered.filter(r => 
                filterStatus === "active" ? r.is_active : !r.is_active
            );
        }

        return filtered;
    }, [rules, searchQuery, filterCategory, filterStatus]);

    const groupedRules = useMemo(() => {
        const groups: Record<string, ConstraintRule[]> = {};
        for (const rule of filteredRules) {
            if (!groups[rule.category]) {
                groups[rule.category] = [];
            }
            groups[rule.category].push(rule);
        }
        // Sort by priority within each group
        for (const category of Object.keys(groups)) {
            groups[category].sort((a, b) => b.priority - a.priority);
        }
        return groups;
    }, [filteredRules]);

    // Stats
    const stats = useMemo(() => {
        const activeCount = rules.filter(r => r.is_active).length;
        const blockingCount = rules.filter(r => r.is_active && r.is_blocking).length;
        const customCount = rules.filter(r => r.is_custom).length;
        return { total: rules.length, active: activeCount, blocking: blockingCount, custom: customCount };
    }, [rules]);

    // Toggle rule status
    const handleToggleRule = async (rule: ConstraintRule) => {
        const newStatus = !rule.is_active;
        const action = newStatus ? "enable" : "disable";
        
        try {
            const result = await toggleRuleStatus(rule.rule_id, newStatus);
            if (result.success) {
                setRules(prev => prev.map(r => 
                    r.rule_id === rule.rule_id ? { ...r, is_active: newStatus } : r
                ));
                toast.success(`Rule ${action}d successfully`);
            } else {
                toast.error(result.error || `Failed to ${action} rule`);
            }
        } catch (err) {
            toast.error(`Failed to ${action} rule`);
        }
    };

    // Edit rule
    const handleEditClick = (rule: ConstraintRule) => {
        setEditingRule(rule);
        setEditForm({
            name: rule.name,
            description: rule.description,
            is_blocking: rule.is_blocking,
            priority: rule.priority,
            config: { ...rule.config }
        });
    };

    // Save edited rule
    const handleSaveRule = async () => {
        if (!editingRule || !editForm) return;

        setIsSaving(true);
        try {
            const result = await updateRuleConfig(editingRule.rule_id, editForm);
            if (result.success) {
                await fetchRules();
                setEditingRule(null);
                setEditForm(null);
                toast.success("Rule updated successfully");
            } else {
                toast.error(result.error || "Failed to update rule");
            }
        } catch (err) {
            toast.error("Failed to update rule");
        } finally {
            setIsSaving(false);
        }
    };

    // Create custom rule
    const handleCreateRule = async () => {
        if (!newRule.name || !newRule.description) {
            toast.error("Name and description are required");
            return;
        }

        setIsSaving(true);
        try {
            const result = await createCustomRule(newRule);
            if (result.success) {
                await fetchRules();
                setIsCreating(false);
                setNewRule({
                    name: "",
                    description: "",
                    category: "limits",
                    is_blocking: true,
                    priority: 50,
                    config: {}
                });
                // Reset config builder
                setConfigBuilder({
                    max_days: "",
                    min_days: "",
                    min_notice_days: "",
                    max_concurrent: "",
                    min_team_available: "",
                    blocked_days: [],
                    blocked_dates: [],
                    min_tenure_months: "",
                    allowed_departments: "",
                    blocked_departments: "",
                    escalate_always: false,
                    escalate_above_days: "",
                    applies_to_types: "",
                    excluded_types: "",
                    custom_message: "",
                });
                toast.success(`Custom rule created: ${result.ruleId}`);
            } else {
                toast.error(result.error || "Failed to create rule");
            }
        } catch (err) {
            toast.error("Failed to create rule");
        } finally {
            setIsSaving(false);
        }
    };

    // Delete custom rule
    const handleDeleteRule = async (rule: ConstraintRule) => {
        confirmAction(
            "Delete Custom Rule",
            `Are you sure you want to delete "${rule.name}"? This cannot be undone.`,
            async () => {
                try {
                    const result = await deleteRule(rule.rule_id);
                    if (result.success) {
                        await fetchRules();
                        toast.success("Rule deleted successfully");
                    } else {
                        toast.error(result.error || "Failed to delete rule");
                    }
                } catch (err) {
                    toast.error("Failed to delete rule");
                }
            }
        );
    };

    // Reset to defaults
    const handleResetToDefaults = async () => {
        confirmAction(
            "Reset to Default Rules",
            "This will reset all rules to their default values and remove any custom rules. Are you sure?",
            async () => {
                try {
                    const result = await resetToDefaultRules();
                    if (result.success) {
                        await fetchRules();
                        toast.success("Rules reset to defaults");
                    } else {
                        toast.error(result.error || "Failed to reset rules");
                    }
                } catch (err) {
                    toast.error("Failed to reset rules");
                }
            }
        );
    };

    // Toggle category expansion
    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    // Render config editor for a rule
    const renderConfigEditor = (ruleId: string, config: Record<string, any>) => {
        // Get default rule safely without strict typing
        const defaultRuleConfig = (DEFAULT_CONSTRAINT_RULES as Record<string, any>)[ruleId]?.config || {};
        
        if (ruleId === "RULE001" || ruleId === "RULE006" || ruleId === "RULE007") {
            // Rules with per-leave-type limits
            const configKey = ruleId === "RULE001" ? "limits" : 
                              ruleId === "RULE006" ? "notice_days" : "max_consecutive";
            const limits = config[configKey] || defaultRuleConfig[configKey] || {};
            
            return (
                <div className="space-y-3">
                    <label className="text-sm text-slate-400">
                        {ruleId === "RULE001" ? "Maximum Days per Leave Type" :
                         ruleId === "RULE006" ? "Notice Days Required per Type" :
                         "Max Consecutive Days per Type"}
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                        {Object.entries(limits).map(([type, value]) => (
                            <div key={type} className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 flex-1 truncate">{type}</span>
                                <input
                                    type="number"
                                    value={value as number}
                                    onChange={(e) => {
                                        if (!editForm) return;
                                        const newLimits = { ...limits, [type]: parseInt(e.target.value) || 0 };
                                        setEditForm({
                                            ...editForm,
                                            config: { ...editForm.config, [configKey]: newLimits }
                                        });
                                    }}
                                    className="w-16 bg-slate-800 border border-white/10 rounded px-2 py-1 text-white text-sm"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        if (ruleId === "RULE003") {
            return (
                <div className="space-y-3">
                    <label className="text-sm text-slate-400">Minimum Team Coverage (%)</label>
                    <input
                        type="number"
                        min="0"
                        max="100"
                        value={config.min_coverage_percent || 60}
                        onChange={(e) => {
                            if (!editForm) return;
                            setEditForm({
                                ...editForm,
                                config: { ...editForm.config, min_coverage_percent: parseInt(e.target.value) || 60 }
                            });
                        }}
                        className="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-white"
                    />
                </div>
            );
        }

        if (ruleId === "RULE004") {
            return (
                <div className="space-y-3">
                    <label className="text-sm text-slate-400">Maximum Concurrent Leaves</label>
                    <input
                        type="number"
                        min="1"
                        value={config.max_concurrent || 2}
                        onChange={(e) => {
                            if (!editForm) return;
                            setEditForm({
                                ...editForm,
                                config: { ...editForm.config, max_concurrent: parseInt(e.target.value) || 2 }
                            });
                        }}
                        className="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-white"
                    />
                </div>
            );
        }

        if (ruleId === "RULE013") {
            return (
                <div className="space-y-3">
                    <label className="text-sm text-slate-400">Maximum Leaves per Month</label>
                    <input
                        type="number"
                        min="1"
                        value={config.max_per_month || 5}
                        onChange={(e) => {
                            if (!editForm) return;
                            setEditForm({
                                ...editForm,
                                config: { ...editForm.config, max_per_month: parseInt(e.target.value) || 5 }
                            });
                        }}
                        className="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-white"
                    />
                </div>
            );
        }

        // Generic JSON editor for other rules
        return (
            <div className="space-y-3">
                <label className="text-sm text-slate-400">Configuration (JSON)</label>
                <textarea
                    value={JSON.stringify(config, null, 2)}
                    onChange={(e) => {
                        try {
                            const parsed = JSON.parse(e.target.value);
                            if (editForm) {
                                setEditForm({ ...editForm, config: parsed });
                            }
                        } catch {
                            // Invalid JSON, ignore
                        }
                    }}
                    className="w-full bg-slate-800 border border-white/10 rounded px-3 py-2 text-white font-mono text-xs h-32"
                />
            </div>
        );
    };

    if (loading) {
        return (
            <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[400px]">
                <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
                <p className="text-slate-400">Loading constraint rules...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Constraint Rules</h1>
                    <p className="text-slate-400">Configure leave request validation rules.</p>
                </header>
                <div className="glass-panel p-12 text-center">
                    <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">Error Loading Rules</h2>
                    <p className="text-slate-400 mb-6">{error}</p>
                    <button 
                        onClick={fetchRules}
                        className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <header className="mb-8 flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Constraint Rules</h1>
                    <p className="text-slate-400">Configure and manage leave validation rules for your organization.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleResetToDefaults}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg text-slate-300 flex items-center gap-2 transition-colors"
                    >
                        <RotateCcw size={16} />
                        Reset to Defaults
                    </button>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Plus size={16} />
                        Create Custom Rule
                    </button>
                </div>
            </header>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="glass-panel p-4">
                    <div className="text-2xl font-bold text-white">{stats.total}</div>
                    <div className="text-sm text-slate-400">Total Rules</div>
                </div>
                <div className="glass-panel p-4">
                    <div className="text-2xl font-bold text-green-400">{stats.active}</div>
                    <div className="text-sm text-slate-400">Active Rules</div>
                </div>
                <div className="glass-panel p-4">
                    <div className="text-2xl font-bold text-red-400">{stats.blocking}</div>
                    <div className="text-sm text-slate-400">Blocking Rules</div>
                </div>
                <div className="glass-panel p-4">
                    <div className="text-2xl font-bold text-purple-400">{stats.custom}</div>
                    <div className="text-sm text-slate-400">Custom Rules</div>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search rules..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-pink-500/50"
                    />
                </div>
                <select
                    value={filterCategory || ""}
                    onChange={(e) => setFilterCategory(e.target.value || null)}
                    className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-pink-500/50"
                >
                    <option value="">All Categories</option>
                    {Object.entries(RULE_CATEGORIES).map(([key, cat]) => (
                        <option key={key} value={key}>{cat.name}</option>
                    ))}
                </select>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="px-4 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-pink-500/50"
                >
                    <option value="all">All Status</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                </select>
            </div>

            {/* Rules by Category */}
            <div className="space-y-6">
                {Object.entries(groupedRules).map(([category, categoryRules]) => {
                    const categoryInfo = RULE_CATEGORIES[category as keyof typeof RULE_CATEGORIES];
                    const IconComponent = categoryIcons[category] || Settings;
                    const isExpanded = expandedCategories.has(category);

                    return (
                        <motion.div
                            key={category}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="glass-panel overflow-hidden"
                        >
                            {/* Category Header */}
                            <button
                                onClick={() => toggleCategory(category)}
                                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg bg-${categoryColors[category]}-500/20`}>
                                        <IconComponent className={`w-5 h-5 text-${categoryColors[category]}-400`} />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-lg font-semibold text-white">
                                            {categoryInfo?.name || category}
                                        </h3>
                                        <p className="text-sm text-slate-400">
                                            {categoryRules.filter(r => r.is_active).length} / {categoryRules.length} active
                                        </p>
                                    </div>
                                </div>
                                {isExpanded ? (
                                    <ChevronDown className="w-5 h-5 text-slate-400" />
                                ) : (
                                    <ChevronRight className="w-5 h-5 text-slate-400" />
                                )}
                            </button>

                            {/* Rules List */}
                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="border-t border-white/5"
                                    >
                                        <div className="divide-y divide-white/5">
                                            {categoryRules.map((rule) => (
                                                <div
                                                    key={rule.rule_id}
                                                    className={`p-4 flex items-start gap-4 ${
                                                        !rule.is_active ? "opacity-50" : ""
                                                    }`}
                                                >
                                                    {/* Toggle */}
                                                    <button
                                                        onClick={() => handleToggleRule(rule)}
                                                        className="mt-1 flex-shrink-0"
                                                    >
                                                        {rule.is_active ? (
                                                            <ToggleRight className="w-8 h-8 text-green-400" />
                                                        ) : (
                                                            <ToggleLeft className="w-8 h-8 text-slate-500" />
                                                        )}
                                                    </button>

                                                    {/* Rule Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-mono text-xs text-pink-400">
                                                                {rule.rule_id}
                                                            </span>
                                                            {rule.is_blocking && (
                                                                <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                                                                    Blocking
                                                                </span>
                                                            )}
                                                            {rule.is_custom && (
                                                                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
                                                                    Custom
                                                                </span>
                                                            )}
                                                            <span className="px-2 py-0.5 bg-slate-500/20 text-slate-400 text-xs rounded">
                                                                Priority: {rule.priority}
                                                            </span>
                                                        </div>
                                                        <h4 className="text-white font-medium mb-1">
                                                            {rule.name}
                                                        </h4>
                                                        <p className="text-sm text-slate-400">
                                                            {rule.description}
                                                        </p>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleEditClick(rule)}
                                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                            title="Edit Rule"
                                                        >
                                                            <Edit2 className="w-4 h-4 text-slate-400" />
                                                        </button>
                                                        {rule.is_custom && (
                                                            <button
                                                                onClick={() => handleDeleteRule(rule)}
                                                                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                                                                title="Delete Rule"
                                                            >
                                                                <Trash2 className="w-4 h-4 text-red-400" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    );
                })}
            </div>

            {/* Edit Rule Modal */}
            <AnimatePresence>
                {editingRule && editForm && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                        >
                            <div className="p-6 border-b border-white/10 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
                                <div>
                                    <span className="text-pink-400 font-mono text-sm">{editingRule.rule_id}</span>
                                    <h3 className="text-lg font-bold text-white">Edit Rule</h3>
                                </div>
                                <button 
                                    onClick={() => { setEditingRule(null); setEditForm(null); }} 
                                    className="text-slate-400 hover:text-white"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            
                            <div className="p-6 space-y-6">
                                {/* Name */}
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Rule Name</label>
                                    <input
                                        type="text"
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-pink-500/50"
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Description</label>
                                    <textarea
                                        value={editForm.description}
                                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                        rows={2}
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-pink-500/50"
                                    />
                                </div>

                                {/* Is Blocking & Priority */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-2">Blocking Rule</label>
                                        <button
                                            onClick={() => setEditForm({ ...editForm, is_blocking: !editForm.is_blocking })}
                                            className={`w-full p-3 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                                                editForm.is_blocking 
                                                    ? "bg-red-500/20 border-red-500/50 text-red-400"
                                                    : "bg-slate-800 border-white/10 text-slate-400"
                                            }`}
                                        >
                                            {editForm.is_blocking ? (
                                                <>
                                                    <AlertCircle size={16} />
                                                    Blocking (Rejects Leave)
                                                </>
                                            ) : (
                                                <>
                                                    <Info size={16} />
                                                    Warning Only
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-2">Priority (1-100)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={editForm.priority}
                                            onChange={(e) => setEditForm({ ...editForm, priority: parseInt(e.target.value) || 50 })}
                                            className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-pink-500/50"
                                        />
                                    </div>
                                </div>

                                {/* Config Editor */}
                                <div className="border-t border-white/10 pt-6">
                                    <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                                        <Zap size={16} className="text-yellow-400" />
                                        Rule Configuration
                                    </h4>
                                    {renderConfigEditor(editingRule.rule_id, editForm.config)}
                                </div>
                            </div>

                            <div className="p-6 border-t border-white/10 flex gap-3 sticky bottom-0 bg-slate-900">
                                <button
                                    onClick={() => { setEditingRule(null); setEditForm(null); }}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg text-slate-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveRule}
                                    disabled={isSaving}
                                    className="flex-1 py-3 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    {isSaving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Create Custom Rule Modal */}
            <AnimatePresence>
                {isCreating && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                        >
                            <div className="p-6 border-b border-white/10 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
                                <div>
                                    <span className="text-purple-400 font-mono text-sm">CUSTOM RULE</span>
                                    <h3 className="text-lg font-bold text-white">Create New Rule</h3>
                                </div>
                                <button 
                                    onClick={() => setIsCreating(false)} 
                                    className="text-slate-400 hover:text-white"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            
                            <div className="p-6 space-y-6">
                                {/* Name */}
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Rule Name *</label>
                                    <input
                                        type="text"
                                        value={newRule.name}
                                        onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                                        placeholder="e.g., Weekend Leave Restriction"
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Description *</label>
                                    <textarea
                                        value={newRule.description}
                                        onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                                        placeholder="Describe what this rule does..."
                                        rows={2}
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
                                    />
                                </div>

                                {/* Category */}
                                <div>
                                    <label className="block text-sm text-slate-400 mb-2">Category</label>
                                    <select
                                        value={newRule.category}
                                        onChange={(e) => setNewRule({ ...newRule, category: e.target.value })}
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                    >
                                        {Object.entries(RULE_CATEGORIES).map(([key, cat]) => (
                                            <option key={key} value={key}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Is Blocking & Priority */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-2">Blocking Rule</label>
                                        <button
                                            onClick={() => setNewRule({ ...newRule, is_blocking: !newRule.is_blocking })}
                                            className={`w-full p-3 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                                                newRule.is_blocking 
                                                    ? "bg-red-500/20 border-red-500/50 text-red-400"
                                                    : "bg-slate-800 border-white/10 text-slate-400"
                                            }`}
                                        >
                                            {newRule.is_blocking ? (
                                                <>
                                                    <AlertCircle size={16} />
                                                    Blocking (Rejects Leave)
                                                </>
                                            ) : (
                                                <>
                                                    <Info size={16} />
                                                    Warning Only
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-2">Priority (1-100)</label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={newRule.priority}
                                            onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 50 })}
                                            className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                        />
                                    </div>
                                </div>

                                {/* Dynamic Config Builder based on Category */}
                                <div className="border-t border-white/10 pt-6">
                                    <h4 className="text-white font-medium mb-4 flex items-center gap-2">
                                        <Zap size={16} className="text-yellow-400" />
                                        Rule Configuration
                                    </h4>
                                    
                                    {/* Limits Category */}
                                    {newRule.category === "limits" && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm text-slate-400 mb-2">Maximum Days Allowed</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={configBuilder.max_days}
                                                        onChange={(e) => setConfigBuilder({...configBuilder, max_days: e.target.value})}
                                                        placeholder="e.g., 30"
                                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm text-slate-400 mb-2">Minimum Days Required</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={configBuilder.min_days}
                                                        onChange={(e) => setConfigBuilder({...configBuilder, min_days: e.target.value})}
                                                        placeholder="e.g., 1"
                                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-2">Apply to Leave Types (comma-separated, leave empty for all)</label>
                                                <input
                                                    type="text"
                                                    value={configBuilder.applies_to_types}
                                                    onChange={(e) => setConfigBuilder({...configBuilder, applies_to_types: e.target.value})}
                                                    placeholder="e.g., Annual, Sick, Personal"
                                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Notice Category */}
                                    {newRule.category === "notice" && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-2">Minimum Notice Days Required</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={configBuilder.min_notice_days}
                                                    onChange={(e) => setConfigBuilder({...configBuilder, min_notice_days: e.target.value})}
                                                    placeholder="e.g., 3"
                                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                                />
                                                <p className="text-xs text-slate-500 mt-1">Number of business days required before leave starts</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-2">Apply to Leave Types (comma-separated)</label>
                                                <input
                                                    type="text"
                                                    value={configBuilder.applies_to_types}
                                                    onChange={(e) => setConfigBuilder({...configBuilder, applies_to_types: e.target.value})}
                                                    placeholder="e.g., Annual, Personal"
                                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Coverage Category */}
                                    {newRule.category === "coverage" && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm text-slate-400 mb-2">Max Concurrent Leaves</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={configBuilder.max_concurrent}
                                                        onChange={(e) => setConfigBuilder({...configBuilder, max_concurrent: e.target.value})}
                                                        placeholder="e.g., 2"
                                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm text-slate-400 mb-2">Min Team Available (%)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={configBuilder.min_team_available}
                                                        onChange={(e) => setConfigBuilder({...configBuilder, min_team_available: e.target.value})}
                                                        placeholder="e.g., 60"
                                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Blackout Category */}
                                    {newRule.category === "blackout" && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-2">Blocked Days of Week</label>
                                                <div className="flex flex-wrap gap-2">
                                                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                                                        <button
                                                            key={day}
                                                            type="button"
                                                            onClick={() => {
                                                                const days = configBuilder.blocked_days.includes(day)
                                                                    ? configBuilder.blocked_days.filter(d => d !== day)
                                                                    : [...configBuilder.blocked_days, day];
                                                                setConfigBuilder({...configBuilder, blocked_days: days});
                                                            }}
                                                            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                                                configBuilder.blocked_days.includes(day)
                                                                    ? "bg-red-500/30 border-red-500/50 text-red-400 border"
                                                                    : "bg-slate-800 border-white/10 text-slate-400 border"
                                                            }`}
                                                        >
                                                            {day}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-2">Blocked Dates (comma-separated YYYY-MM-DD)</label>
                                                <input
                                                    type="text"
                                                    value={configBuilder.blocked_dates.join(", ")}
                                                    onChange={(e) => setConfigBuilder({...configBuilder, blocked_dates: e.target.value.split(",").map(s => s.trim()).filter(Boolean)})}
                                                    placeholder="e.g., 2024-12-25, 2024-12-31"
                                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Eligibility Category */}
                                    {newRule.category === "eligibility" && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-2">Minimum Tenure (months)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={configBuilder.min_tenure_months}
                                                    onChange={(e) => setConfigBuilder({...configBuilder, min_tenure_months: e.target.value})}
                                                    placeholder="e.g., 6"
                                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-2">Allowed Departments Only (comma-separated)</label>
                                                <input
                                                    type="text"
                                                    value={configBuilder.allowed_departments}
                                                    onChange={(e) => setConfigBuilder({...configBuilder, allowed_departments: e.target.value})}
                                                    placeholder="e.g., Engineering, Sales"
                                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-2">Blocked Departments (comma-separated)</label>
                                                <input
                                                    type="text"
                                                    value={configBuilder.blocked_departments}
                                                    onChange={(e) => setConfigBuilder({...configBuilder, blocked_departments: e.target.value})}
                                                    placeholder="e.g., Support, Operations"
                                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Escalation Category */}
                                    {newRule.category === "escalation" && (
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setConfigBuilder({...configBuilder, escalate_always: !configBuilder.escalate_always})}
                                                    className={`px-4 py-2 rounded-lg border transition-colors ${
                                                        configBuilder.escalate_always
                                                            ? "bg-amber-500/30 border-amber-500/50 text-amber-400"
                                                            : "bg-slate-800 border-white/10 text-slate-400"
                                                    }`}
                                                >
                                                    {configBuilder.escalate_always ? "✓ Always Escalate" : "Always Escalate"}
                                                </button>
                                            </div>
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-2">Escalate if Leave Duration Above (days)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={configBuilder.escalate_above_days}
                                                    onChange={(e) => setConfigBuilder({...configBuilder, escalate_above_days: e.target.value})}
                                                    placeholder="e.g., 5"
                                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Documentation Category */}
                                    {newRule.category === "documentation" && (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-2">Apply to Leave Types (comma-separated)</label>
                                                <input
                                                    type="text"
                                                    value={configBuilder.applies_to_types}
                                                    onChange={(e) => setConfigBuilder({...configBuilder, applies_to_types: e.target.value})}
                                                    placeholder="e.g., Sick, Medical"
                                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                                />
                                                <p className="text-xs text-slate-500 mt-1">Leave types that require documentation</p>
                                            </div>
                                            <div>
                                                <label className="block text-sm text-slate-400 mb-2">Custom Warning Message</label>
                                                <input
                                                    type="text"
                                                    value={configBuilder.custom_message}
                                                    onChange={(e) => setConfigBuilder({...configBuilder, custom_message: e.target.value})}
                                                    placeholder="e.g., Medical certificate required for sick leave"
                                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500/50"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Show generated config preview */}
                                    <div className="mt-4 p-3 bg-slate-800/50 rounded-lg">
                                        <label className="block text-xs text-slate-500 mb-1">Generated Configuration Preview</label>
                                        <pre className="text-xs text-cyan-400 font-mono overflow-x-auto">
                                            {JSON.stringify(newRule.config, null, 2) || "{}"}
                                        </pre>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-white/10 flex gap-3 sticky bottom-0 bg-slate-900">
                                <button
                                    onClick={() => setIsCreating(false)}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg text-slate-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateRule}
                                    disabled={isSaving || !newRule.name || !newRule.description}
                                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Plus size={16} />
                                    {isSaving ? "Creating..." : "Create Rule"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
