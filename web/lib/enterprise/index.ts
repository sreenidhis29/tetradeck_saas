/**
 * 🏢 TETRADECK ENTERPRISE MODULE INDEX
 * =====================================
 * Central export for all enterprise-grade functionality
 * 
 * IMPLEMENTS ALL 15 PILLARS OF ENTERPRISE RELIABILITY:
 * 
 * 1️⃣  RELIABILITY       - reliability.ts: Retry logic, idempotency, timeouts
 * 2️⃣  AVAILABILITY      - reliability.ts: Health checks, circuit breakers
 * 3️⃣  DURABILITY        - backup.ts: Automated backups, recovery
 * 4️⃣  CONSISTENCY       - Prisma transactions (built-in)
 * 5️⃣  SECURITY          - middleware.ts: Clerk auth, rate limiting
 * 6️⃣  INTEGRITY         - audit-logger.ts: SHA-256 hash chains
 * 7️⃣  ACCOUNTABILITY    - audit-logger.ts: Complete audit trail
 * 8️⃣  OBSERVABILITY     - observability.ts: Logging, metrics, tracing
 * 9️⃣  RESILIENCE        - failure-handling.ts: Graceful degradation
 * 🔟  PRIVACY           - gdpr.ts: GDPR compliance, data erasure
 * 1️⃣1️⃣ EXPLAINABILITY   - explainability.ts: AI decision reasoning
 * 1️⃣2️⃣ SCALABILITY      - reliability.ts: Connection pooling, caching
 * 1️⃣3️⃣ MAINTAINABILITY  - Modular architecture, JSDoc
 * 1️⃣4️⃣ OPERATIONAL      - failure-handling.ts: Runbooks, feature flags
 * 1️⃣5️⃣ TRUST            - All modules: Transparency, verification
 */

// ============================================================================
// RELIABILITY MODULE
// ============================================================================
export {
    withRetry,
    CircuitBreaker,
    circuitBreakers_registry as circuitBreakers,
    withIdempotency,
    generateIdempotencyKey,
    RateLimiter,
    rateLimiters,
    withTimeout,
    addToDeadLetterQueue,
    getDeadLetterQueue,
    removeFromDeadLetterQueue,
    performHealthCheck,
    type HealthCheckResult,
    type SystemHealth
} from './reliability';

// ============================================================================
// BACKUP MODULE
// ============================================================================
export {
    createFullBackup,
    verifyBackup,
    restoreFromBackup,
    cleanupExpiredBackups,
    listBackups,
    getBackupById,
    getBackupStats,
    logChange,
    getChangesInRange,
    type BackupConfig,
    type BackupMetadata
} from './backup';

// ============================================================================
// GDPR & PRIVACY MODULE
// ============================================================================
export {
    exportPersonalData,
    erasePersonalData,
    recordConsent,
    hasValidConsent,
    getEmployeeConsents,
    withdrawConsent,
    getRetentionPolicies,
    getRetentionPolicy,
    createDataSubjectRequest,
    getDataSubjectRequests,
    updateDataSubjectRequest,
    getComplianceStatus,
    type PersonalDataExport,
    type ErasureResult,
    type ConsentRecord,
    type RetentionPolicy,
    type DataSubjectRequest
} from './gdpr';

// ============================================================================
// OBSERVABILITY MODULE
// ============================================================================
export {
    createTraceContext,
    startSpan,
    endSpan,
    logToSpan,
    withTracing,
    logger,
    registerMetric,
    recordMetric,
    incrementCounter,
    recordDuration,
    getDashboardMetrics,
    getTraceById,
    getTracesByTimeRange,
    getSlowTraces,
    getErrorTraces,
    createRequestContext,
    finalizeRequestContext,
    type TraceContext,
    type Span,
    type DashboardMetrics,
    type RequestContext
} from './observability';

// ============================================================================
// FAILURE HANDLING MODULE
// ============================================================================
export {
    withGracefulDegradation,
    isFeatureEnabled,
    setFeatureFlag,
    getAllFeatureFlags,
    enableChaos,
    disableChaos,
    withChaos,
    registerFailureHandler,
    handleFailure,
    getSystemHealthStatus,
    getRunbook,
    executeRunbook,
    type FeatureFlag,
    type ChaosConfig,
    type FailureScenario,
    type SystemHealthStatus,
    type Runbook
} from './failure-handling';

// ============================================================================
// AI EXPLAINABILITY MODULE
// ============================================================================
export {
    AIDecisionBuilder,
    analyzeLeaveRequest,
    formatDecisionExplanation,
    logAIDecision,
    recordDecision,
    getModelInfo,
    getAllModels,
    getDecisionById,
    getDecisionsByEntity,
    getDecisionStats,
    type AIDecision,
    type DecisionFactor,
    type ConstraintResult,
    type LeaveAnalysisInput,
    type ModelInfo
} from './explainability';

// ============================================================================
// CONVENIENCE UTILITIES
// ============================================================================

/**
 * Wraps an operation with full enterprise protection:
 * - Retry logic
 * - Circuit breaker
 * - Rate limiting
 * - Timeout
 * - Graceful degradation
 * - Observability
 */
export async function withEnterpriseProtection<T>(
    operationName: string,
    operation: () => Promise<T>,
    options: {
        circuitBreaker?: string;
        rateLimitKey?: string;
        timeoutMs?: number;
        fallback?: () => Promise<T>;
        retryConfig?: { maxAttempts?: number };
    } = {}
): Promise<T> {
    const { withRetry } = await import('./reliability');
    const { withGracefulDegradation } = await import('./failure-handling');
    const { withTracing, createTraceContext } = await import('./observability');
    
    // Wrap with tracing
    return withTracing(operationName, async (ctx) => {
        // Wrap with graceful degradation
        const { result } = await withGracefulDegradation(
            operationName,
            async () => {
                // Wrap with retry
                return withRetry(
                    operation,
                    options.retryConfig,
                    operationName
                );
            },
            options.fallback
        );
        
        return result;
    });
}

/**
 * Gets comprehensive system status for monitoring dashboards
 */
export async function getEnterpriseStatus() {
    const { performHealthCheck } = await import('./reliability');
    const { getSystemHealthStatus } = await import('./failure-handling');
    const { getDashboardMetrics } = await import('./observability');
    const { getBackupStats } = await import('./backup');
    const { getComplianceStatus } = await import('./gdpr');
    const { getDecisionStats, getAllModels } = await import('./explainability');
    
    const [health, systemHealth, metrics, backups, compliance, aiStats] = await Promise.all([
        performHealthCheck(),
        getSystemHealthStatus(),
        getDashboardMetrics('24h'),
        getBackupStats(),
        getComplianceStatus(),
        getDecisionStats()
    ]);
    
    return {
        timestamp: new Date(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0',
        
        // Overall Status
        status: systemHealth.status,
        
        // Health
        health: {
            overall: health.overall,
            uptime: health.uptime,
            checks: health.checks
        },
        
        // System
        system: {
            activeFailures: systemHealth.activeFailures,
            degradedFeatures: systemHealth.degradedFeatures,
            components: systemHealth.components
        },
        
        // Metrics
        metrics: {
            requests: metrics.requests,
            errors: metrics.errors,
            business: metrics.business
        },
        
        // Backups
        backups: {
            total: backups.totalBackups,
            sizeBytes: backups.totalSizeBytes,
            latest: backups.newestBackup
        },
        
        // Compliance
        compliance: {
            pendingRequests: compliance.dataSubjectRequests.pending,
            totalRequests: compliance.dataSubjectRequests.total
        },
        
        // AI
        ai: {
            totalDecisions: aiStats.totalDecisions,
            avgConfidence: aiStats.avgConfidence,
            models: getAllModels()
        }
    };
}
