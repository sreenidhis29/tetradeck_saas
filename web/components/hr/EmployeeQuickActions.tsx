"use client";

import { useState, useRef } from "react";
import { ArrowRight, X, FileText, Plus, Minus, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ui/confirm-provider";

interface LeaveBalance {
    leave_type: string;
    annual_entitlement: number;
    used_days: number;
    pending_days: number;
}

interface Document {
    id: string;
    name: string;
    type: string;
    date: string;
    size: string;
}

interface EmployeeQuickActionsProps {
    employeeId: string;
    employeeName: string;
    leaveBalances: LeaveBalance[];
}

export function EmployeeQuickActions({ employeeId, employeeName, leaveBalances }: EmployeeQuickActionsProps) {
    const [showBalanceModal, setShowBalanceModal] = useState(false);
    const [showDocumentsModal, setShowDocumentsModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [selectedLeaveType, setSelectedLeaveType] = useState<string>("");
    const [adjustmentType, setAdjustmentType] = useState<"add" | "deduct">("add");
    const [adjustmentAmount, setAdjustmentAmount] = useState(1);
    const [adjustmentReason, setAdjustmentReason] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedDocs, setUploadedDocs] = useState<Document[]>([
        { id: "1", name: "Employment Contract", type: "pdf", date: "2024-01-15", size: "245 KB" },
        { id: "2", name: "ID Verification", type: "pdf", date: "2024-01-15", size: "1.2 MB" },
        { id: "3", name: "Tax Form W-4", type: "pdf", date: "2024-01-20", size: "89 KB" },
    ]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { confirmAction } = useConfirm();

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type and size
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Invalid file type. Please upload PDF, Word, or image files.');
            return;
        }
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            toast.error('File too large. Maximum size is 10MB.');
            return;
        }

        setIsUploading(true);
        try {
            // In production, upload to cloud storage (S3, Cloudinary, etc.)
            // For now, simulate upload and add to local state
            await new Promise(r => setTimeout(r, 1500));
            
            const newDoc: Document = {
                id: Date.now().toString(),
                name: file.name,
                type: file.name.split('.').pop() || 'file',
                date: new Date().toISOString().split('T')[0],
                size: file.size > 1024 * 1024 
                    ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
                    : `${Math.round(file.size / 1024)} KB`,
            };
            
            setUploadedDocs(prev => [newDoc, ...prev]);
            setShowUploadModal(false);
            toast.success(`Document "${file.name}" uploaded successfully`);
        } catch {
            toast.error('Failed to upload document. Please try again.');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleAdjustBalance = async () => {
        if (!selectedLeaveType || !adjustmentReason) return;
        
        const actionText = adjustmentType === "add" ? "add" : "deduct";
        const message = `Are you sure you want to ${actionText} ${adjustmentAmount} day(s) of ${selectedLeaveType} leave for ${employeeName}?\n\nReason: ${adjustmentReason}`;
        
        confirmAction('Confirm Balance Adjustment', message, async () => {
            setIsSaving(true);
            try {
                const response = await fetch("/api/hr/adjust-balance", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        employeeId,
                        leaveType: selectedLeaveType,
                        adjustment: adjustmentType === "add" ? adjustmentAmount : -adjustmentAmount,
                        reason: adjustmentReason
                    })
                });
                
                if (response.ok) {
                    setShowBalanceModal(false);
                    toast.success("Leave balance updated successfully");
                    window.location.reload();
                } else {
                    toast.error("Failed to adjust balance. Please try again.");
                }
            } catch (error) {
                console.error("Error adjusting balance:", error);
                toast.error("An error occurred. Please try again.");
            } finally {
                setIsSaving(false);
            }
        });
    };

    // Use uploadedDocs state instead of hardcoded array
    const documents = uploadedDocs;

    return (
        <>
            {/* Hidden file input */}
            <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                className="hidden"
            />
            
            <div className="space-y-3">
                <button 
                    onClick={() => setShowBalanceModal(true)}
                    className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-slate-300 transition-colors text-left px-4 flex justify-between items-center group"
                >
                    Adjust Balance <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button 
                    onClick={() => setShowDocumentsModal(true)}
                    className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-slate-300 transition-colors text-left px-4 flex justify-between items-center group"
                >
                    View Documents <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
            </div>

            {/* Adjust Balance Modal */}
            {showBalanceModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white">Adjust Leave Balance</h3>
                            <button onClick={() => setShowBalanceModal(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="text-sm text-slate-400">
                                Adjusting balance for <span className="text-white font-medium">{employeeName}</span>
                            </div>

                            {/* Leave Type Selection */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Leave Type</label>
                                <select 
                                    value={selectedLeaveType}
                                    onChange={(e) => setSelectedLeaveType(e.target.value)}
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00f2ff]/50"
                                >
                                    <option value="">Select leave type...</option>
                                    {leaveBalances.length > 0 ? (
                                        leaveBalances.map(b => (
                                            <option key={b.leave_type} value={b.leave_type}>
                                                {b.leave_type} (Current: {b.annual_entitlement - b.used_days} days)
                                            </option>
                                        ))
                                    ) : (
                                        <>
                                            <option value="Annual">Annual Leave</option>
                                            <option value="Sick">Sick Leave</option>
                                            <option value="Personal">Personal Leave</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            {/* Adjustment Type */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Adjustment Type</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setAdjustmentType("add")}
                                        className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 border transition-colors ${
                                            adjustmentType === "add" 
                                                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" 
                                                : "bg-slate-800 border-white/10 text-slate-400 hover:border-white/20"
                                        }`}
                                    >
                                        <Plus size={16} /> Add Days
                                    </button>
                                    <button
                                        onClick={() => setAdjustmentType("deduct")}
                                        className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 border transition-colors ${
                                            adjustmentType === "deduct" 
                                                ? "bg-red-500/20 border-red-500/50 text-red-400" 
                                                : "bg-slate-800 border-white/10 text-slate-400 hover:border-white/20"
                                        }`}
                                    >
                                        <Minus size={16} /> Deduct Days
                                    </button>
                                </div>
                            </div>

                            {/* Amount */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Number of Days</label>
                                <input
                                    type="number"
                                    min="0.5"
                                    step="0.5"
                                    value={adjustmentAmount}
                                    onChange={(e) => setAdjustmentAmount(parseFloat(e.target.value) || 0)}
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00f2ff]/50"
                                />
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Reason for Adjustment</label>
                                <textarea
                                    value={adjustmentReason}
                                    onChange={(e) => setAdjustmentReason(e.target.value)}
                                    placeholder="e.g., Carry-forward from previous year, Correction..."
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#00f2ff]/50 resize-none h-20"
                                />
                            </div>
                        </div>
                        <div className="p-6 border-t border-white/10 flex gap-3">
                            <button
                                onClick={() => setShowBalanceModal(false)}
                                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg text-slate-300"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAdjustBalance}
                                disabled={!selectedLeaveType || !adjustmentReason || isSaving}
                                className="flex-1 py-3 bg-[#00f2ff] hover:bg-[#00d4e0] text-black font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSaving ? "Saving..." : "Apply Adjustment"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Documents Modal */}
            {showDocumentsModal && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-white">Employee Documents</h3>
                            <button onClick={() => setShowDocumentsModal(false)} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="text-sm text-slate-400 mb-4">
                                Documents for <span className="text-white font-medium">{employeeName}</span>
                            </div>

                            {documents.length > 0 ? (
                                <div className="space-y-2">
                                    {documents.map(doc => (
                                        <div 
                                            key={doc.id}
                                            className="flex items-center gap-4 p-4 bg-slate-800/50 border border-white/10 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer group"
                                        >
                                            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                                                <FileText size={20} className="text-red-400" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-white font-medium">{doc.name}</div>
                                                <div className="text-xs text-slate-500">{doc.date} • {doc.size}</div>
                                            </div>
                                            <ArrowRight size={16} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-500">
                                    <FileText size={48} className="mx-auto mb-4 opacity-50" />
                                    <p>No documents uploaded yet</p>
                                </div>
                            )}

                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="w-full mt-4 py-3 border border-dashed border-white/20 rounded-lg text-slate-400 hover:border-[#00f2ff]/50 hover:text-[#00f2ff] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isUploading ? (
                                    <><Loader2 size={16} className="animate-spin" /> Uploading...</>
                                ) : (
                                    <><Upload size={16} /> Upload New Document</>
                                )}
                            </button>
                        </div>
                        <div className="p-6 border-t border-white/10">
                            <button
                                onClick={() => setShowDocumentsModal(false)}
                                className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg text-slate-300"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
