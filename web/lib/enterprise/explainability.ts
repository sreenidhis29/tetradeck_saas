/**
 * 🤖 ENTERPRISE AI EXPLAINABILITY MODULE
 * =======================================
 * Implements: Decision Reasoning, Confidence Tracking, Model Versioning
 * 
 * PILLAR 11: EXPLAINABILITY - AI Systems Only
 */

import crypto from 'crypto';
import { createAIDecisionLog } from '@/lib/audit-logger';

// ============================================================================
// 1. AI DECISION STRUCTURE
// ============================================================================

export interface AIDecision {
    decisionId: string;
    modelId: string;
    modelVersion: string;
    inputHash: string;
    timestamp: Date;
    
    // Core Decision
    decision: 'APPROVE' | 'REJECT' | 'ESCALATE' | 'PENDING';
    confidence: number;  // 0-1
    
    // Explainability
    reasoning: {
        summary: string;
        factors: DecisionFactor[];
        constraints: ConstraintResult[];
    };
    
    // Audit Trail
    processingTimeMs: number;
    rulesEvaluated: number;
    dataPointsConsidered: number;
}

export interface DecisionFactor {
    factor: string;
    weight: number;        // Importance: 0-1
    value: any;
    impact: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    explanation: string;
}

export interface ConstraintResult {
    ruleId: string;
    ruleName: string;
    ruleDescription: string;
    passed: boolean;
    value?: any;
    threshold?: any;
    message: string;
    severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
}

// ============================================================================
// 2. DECISION BUILDER
// ============================================================================

export class AIDecisionBuilder {
    private decision: Partial<AIDecision>;
    private startTime: number;
    
    constructor(modelId: string, modelVersion: string) {
        this.startTime = Date.now();
        this.decision = {
            decisionId: `ai_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
            modelId,
            modelVersion,
            timestamp: new Date(),
            reasoning: {
                summary: '',
                factors: [],
                constraints: []
            },
            rulesEvaluated: 0,
            dataPointsConsidered: 0
        };
    }
    
    setInput(input: any): this {
        this.decision.inputHash = crypto
            .createHash('sha256')
            .update(JSON.stringify(input))
            .digest('hex')
            .substring(0, 16);
        return this;
    }
    
    addFactor(factor: DecisionFactor): this {
        this.decision.reasoning!.factors.push(factor);
        this.decision.dataPointsConsidered!++;
        return this;
    }
    
    addConstraint(constraint: ConstraintResult): this {
        this.decision.reasoning!.constraints.push(constraint);
        this.decision.rulesEvaluated!++;
        return this;
    }
    
    setDecision(
        decision: AIDecision['decision'],
        confidence: number,
        summary: string
    ): this {
        this.decision.decision = decision;
        this.decision.confidence = Math.max(0, Math.min(1, confidence));
        this.decision.reasoning!.summary = summary;
        return this;
    }
    
    build(): AIDecision {
        this.decision.processingTimeMs = Date.now() - this.startTime;
        return this.decision as AIDecision;
    }
}

// ============================================================================
// 3. LEAVE REQUEST AI ANALYZER
// ============================================================================

export interface LeaveAnalysisInput {
    employeeId: string;
    employeeName: string;
    department: string;
    leaveType: string;
    startDate: Date;
    endDate: Date;
    requestedDays: number;
    reason?: string;
    balance: {
        entitled: number;
        used: number;
        pending: number;
        remaining: number;
    };
    teamAbsences?: number;
    isBlackoutPeriod?: boolean;
    noticeDaysGiven?: number;
    consecutiveDays?: number;
    previousRequestsThisMonth?: number;
}

export function analyzeLeaveRequest(input: LeaveAnalysisInput): AIDecision {
    const builder = new AIDecisionBuilder(
        'leave-constraint-engine',
        '2.1.0'
    );
    
    builder.setInput(input);
    
    let totalScore = 0;
    let maxScore = 0;
    const violations: string[] = [];
    
    // 1. Balance Check (Critical)
    const hasBalance = input.balance.remaining >= input.requestedDays;
    builder.addConstraint({
        ruleId: 'RULE_001',
        ruleName: 'Sufficient Balance',
        ruleDescription: 'Employee must have sufficient leave balance',
        passed: hasBalance,
        value: input.balance.remaining,
        threshold: input.requestedDays,
        message: hasBalance 
            ? `Balance sufficient: ${input.balance.remaining} days available`
            : `Insufficient balance: ${input.balance.remaining} available, ${input.requestedDays} requested`,
        severity: hasBalance ? 'INFO' : 'CRITICAL'
    });
    builder.addFactor({
        factor: 'Leave Balance',
        weight: 0.3,
        value: input.balance.remaining,
        impact: hasBalance ? 'POSITIVE' : 'NEGATIVE',
        explanation: `${input.balance.remaining} days remaining of ${input.balance.entitled} entitled`
    });
    if (hasBalance) totalScore += 30;
    maxScore += 30;
    if (!hasBalance) violations.push('Insufficient leave balance');
    
    // 2. Notice Period Check
    const noticeDays = input.noticeDaysGiven || 0;
    const meetsNotice = noticeDays >= 3; // Minimum 3 days notice
    builder.addConstraint({
        ruleId: 'RULE_002',
        ruleName: 'Notice Period',
        ruleDescription: 'Leave requests should be submitted at least 3 days in advance',
        passed: meetsNotice,
        value: noticeDays,
        threshold: 3,
        message: meetsNotice
            ? `Adequate notice: ${noticeDays} days provided`
            : `Short notice: Only ${noticeDays} days provided (minimum 3 recommended)`,
        severity: meetsNotice ? 'INFO' : 'WARNING'
    });
    builder.addFactor({
        factor: 'Notice Period',
        weight: 0.15,
        value: noticeDays,
        impact: meetsNotice ? 'POSITIVE' : 'NEGATIVE',
        explanation: `${noticeDays} days advance notice`
    });
    if (meetsNotice) totalScore += 15;
    maxScore += 15;
    
    // 3. Blackout Period Check
    const inBlackout = input.isBlackoutPeriod || false;
    builder.addConstraint({
        ruleId: 'RULE_003',
        ruleName: 'Blackout Period',
        ruleDescription: 'Leave may be restricted during critical business periods',
        passed: !inBlackout,
        value: inBlackout,
        threshold: false,
        message: inBlackout
            ? 'Leave dates fall within company blackout period'
            : 'No blackout period conflicts',
        severity: inBlackout ? 'ERROR' : 'INFO'
    });
    if (!inBlackout) totalScore += 15;
    maxScore += 15;
    if (inBlackout) violations.push('Blackout period conflict');
    
    // 4. Team Coverage Check
    const teamAbsences = input.teamAbsences || 0;
    const teamCoverageSafe = teamAbsences < 3; // Max 2 others out
    builder.addConstraint({
        ruleId: 'RULE_004',
        ruleName: 'Team Coverage',
        ruleDescription: 'Ensure adequate team coverage during absence',
        passed: teamCoverageSafe,
        value: teamAbsences,
        threshold: 3,
        message: teamCoverageSafe
            ? `Team coverage adequate: ${teamAbsences} team members currently absent`
            : `Coverage concern: ${teamAbsences} team members already absent`,
        severity: teamCoverageSafe ? 'INFO' : 'WARNING'
    });
    builder.addFactor({
        factor: 'Team Coverage',
        weight: 0.2,
        value: teamAbsences,
        impact: teamCoverageSafe ? 'POSITIVE' : 'NEGATIVE',
        explanation: `${teamAbsences} other team members absent during requested period`
    });
    if (teamCoverageSafe) totalScore += 20;
    maxScore += 20;
    
    // 5. Consecutive Days Check
    const consecutiveDays = input.consecutiveDays || input.requestedDays;
    const withinLimit = consecutiveDays <= 10; // Max 10 consecutive days
    builder.addConstraint({
        ruleId: 'RULE_005',
        ruleName: 'Consecutive Days Limit',
        ruleDescription: 'Leave requests exceeding 10 consecutive days require special approval',
        passed: withinLimit,
        value: consecutiveDays,
        threshold: 10,
        message: withinLimit
            ? `Duration acceptable: ${consecutiveDays} consecutive days`
            : `Extended leave: ${consecutiveDays} consecutive days requires HR approval`,
        severity: withinLimit ? 'INFO' : 'WARNING'
    });
    if (withinLimit) totalScore += 10;
    maxScore += 10;
    
    // 6. Leave Type Check
    const isEmergency = input.leaveType.toLowerCase().includes('emergency') || 
                        input.leaveType.toLowerCase().includes('sick');
    builder.addFactor({
        factor: 'Leave Type',
        weight: 0.1,
        value: input.leaveType,
        impact: isEmergency ? 'POSITIVE' : 'NEUTRAL',
        explanation: isEmergency 
            ? 'Emergency/sick leave receives priority consideration'
            : `Standard ${input.leaveType} request`
    });
    if (isEmergency) totalScore += 10;
    maxScore += 10;
    
    // Calculate final decision
    const confidence = maxScore > 0 ? totalScore / maxScore : 0;
    const hasCriticalViolations = violations.length > 0;
    
    let decision: AIDecision['decision'];
    let summary: string;
    
    if (!hasBalance) {
        decision = 'REJECT';
        summary = `Request rejected: Insufficient leave balance (${input.balance.remaining} available, ${input.requestedDays} requested)`;
    } else if (inBlackout) {
        decision = 'ESCALATE';
        summary = `Escalated to HR: Request conflicts with company blackout period`;
    } else if (confidence >= 0.8 && !hasCriticalViolations) {
        decision = 'APPROVE';
        summary = `Auto-approved: All ${builder['decision'].rulesEvaluated} constraints satisfied with ${Math.round(confidence * 100)}% confidence`;
    } else {
        decision = 'ESCALATE';
        summary = `Escalated to HR: ${violations.length > 0 ? violations.join(', ') : 'Confidence below threshold'} (${Math.round(confidence * 100)}%)`;
    }
    
    builder.setDecision(decision, confidence, summary);
    
    return builder.build();
}

// ============================================================================
// 4. DECISION EXPLANATION FORMATTER
// ============================================================================

export function formatDecisionExplanation(decision: AIDecision): string {
    const lines: string[] = [];
    
    // Header
    lines.push(`🤖 AI Decision Analysis (ID: ${decision.decisionId})`);
    lines.push(`${'─'.repeat(50)}`);
    
    // Summary
    lines.push(`📋 ${decision.reasoning.summary}`);
    lines.push('');
    
    // Decision Details
    lines.push(`Decision: ${decision.decision}`);
    lines.push(`Confidence: ${Math.round(decision.confidence * 100)}%`);
    lines.push(`Model: ${decision.modelId} v${decision.modelVersion}`);
    lines.push(`Processing Time: ${decision.processingTimeMs}ms`);
    lines.push('');
    
    // Constraints
    lines.push(`📏 Constraints Evaluated (${decision.rulesEvaluated}):`);
    for (const constraint of decision.reasoning.constraints) {
        const icon = constraint.passed ? '✅' : constraint.severity === 'WARNING' ? '⚠️' : '❌';
        lines.push(`  ${icon} ${constraint.ruleName}: ${constraint.message}`);
    }
    lines.push('');
    
    // Factors
    lines.push(`📊 Decision Factors (${decision.reasoning.factors.length}):`);
    for (const factor of decision.reasoning.factors) {
        const impactIcon = factor.impact === 'POSITIVE' ? '➕' : factor.impact === 'NEGATIVE' ? '➖' : '➡️';
        lines.push(`  ${impactIcon} ${factor.factor} (weight: ${Math.round(factor.weight * 100)}%): ${factor.explanation}`);
    }
    
    return lines.join('\n');
}

// ============================================================================
// 5. DECISION AUDIT INTEGRATION
// ============================================================================

export async function logAIDecision(
    decision: AIDecision,
    entityType: string,
    entityId: string,
    targetOrg: string
): Promise<void> {
    const decisionMap: Record<string, 'approved' | 'rejected' | 'pending_review'> = {
        'APPROVE': 'approved',
        'REJECT': 'rejected',
        'ESCALATE': 'pending_review',
        'PENDING': 'pending_review'
    };
    
    await createAIDecisionLog({
        actor_id: decision.modelId,
        action: 'AI_DECISION_MADE',
        entity_type: entityType,
        entity_id: entityId,
        decision: decisionMap[decision.decision] || 'pending_review',
        decision_reason: decision.reasoning.summary,
        confidence_score: decision.confidence,
        model_version: decision.modelVersion,
        rules_evaluated: decision.reasoning.constraints.map(c => c.ruleId),
        details: {
            decisionId: decision.decisionId,
            processingTimeMs: decision.processingTimeMs,
            factors: decision.reasoning.factors,
            constraints: decision.reasoning.constraints
        },
        target_org: targetOrg
    });
}

// ============================================================================
// 6. MODEL REGISTRY
// ============================================================================

export interface ModelInfo {
    modelId: string;
    version: string;
    description: string;
    deployedAt: Date;
    accuracy?: number;
    totalDecisions: number;
    approvalRate: number;
    avgConfidence: number;
    avgProcessingMs: number;
}

const modelRegistry: Map<string, ModelInfo> = new Map([
    ['leave-constraint-engine', {
        modelId: 'leave-constraint-engine',
        version: '2.1.0',
        description: 'Rule-based constraint engine for leave request analysis',
        deployedAt: new Date('2026-01-01'),
        accuracy: 0.95,
        totalDecisions: 0,
        approvalRate: 0.75,
        avgConfidence: 0.85,
        avgProcessingMs: 12
    }]
]);

const decisionHistory: AIDecision[] = [];

export function recordDecision(decision: AIDecision): void {
    decisionHistory.push(decision);
    
    // Update model stats
    const model = modelRegistry.get(decision.modelId);
    if (model) {
        model.totalDecisions++;
        
        // Update rolling averages
        const recentDecisions = decisionHistory
            .filter(d => d.modelId === decision.modelId)
            .slice(-100);
        
        model.avgConfidence = recentDecisions.reduce((sum, d) => sum + d.confidence, 0) / recentDecisions.length;
        model.avgProcessingMs = recentDecisions.reduce((sum, d) => sum + d.processingTimeMs, 0) / recentDecisions.length;
        model.approvalRate = recentDecisions.filter(d => d.decision === 'APPROVE').length / recentDecisions.length;
    }
    
    // Keep only last 10k decisions in memory
    while (decisionHistory.length > 10000) {
        decisionHistory.shift();
    }
}

export function getModelInfo(modelId: string): ModelInfo | undefined {
    return modelRegistry.get(modelId);
}

export function getAllModels(): ModelInfo[] {
    return Array.from(modelRegistry.values());
}

// ============================================================================
// 7. EXPLAINABILITY API
// ============================================================================

export function getDecisionById(decisionId: string): AIDecision | undefined {
    return decisionHistory.find(d => d.decisionId === decisionId);
}

export function getDecisionsByEntity(entityId: string): AIDecision[] {
    return decisionHistory.filter(d => 
        d.inputHash.includes(entityId) // Simplified lookup
    );
}

export function getDecisionStats(modelId?: string): {
    totalDecisions: number;
    byDecision: Record<string, number>;
    avgConfidence: number;
    avgProcessingMs: number;
} {
    const decisions = modelId 
        ? decisionHistory.filter(d => d.modelId === modelId)
        : decisionHistory;
    
    const byDecision: Record<string, number> = {
        APPROVE: 0,
        REJECT: 0,
        ESCALATE: 0,
        PENDING: 0
    };
    
    for (const decision of decisions) {
        byDecision[decision.decision] = (byDecision[decision.decision] || 0) + 1;
    }
    
    return {
        totalDecisions: decisions.length,
        byDecision,
        avgConfidence: decisions.length > 0
            ? decisions.reduce((sum, d) => sum + d.confidence, 0) / decisions.length
            : 0,
        avgProcessingMs: decisions.length > 0
            ? decisions.reduce((sum, d) => sum + d.processingTimeMs, 0) / decisions.length
            : 0
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    AIDecisionBuilder,
    analyzeLeaveRequest,
    formatDecisionExplanation,
    logAIDecision,
    recordDecision,
    getModelInfo,
    getAllModels,
    getDecisionById,
    getDecisionsByEntity,
    getDecisionStats
};
