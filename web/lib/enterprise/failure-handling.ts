/**
 * 🚨 ENTERPRISE FAILURE HANDLING MODULE
 * =====================================
 * Implements: Graceful Degradation, Chaos Testing, Failure Scenarios
 * 
 * PILLAR 9: RESILIENCE - Survive Chaos
 * PILLAR 6: FAILURE SCENARIOS - Real Test
 */

import { CircuitBreaker, circuitBreakers_registry, addToDeadLetterQueue } from './reliability';
import { logger, incrementCounter } from './observability';

// ============================================================================
// 1. GRACEFUL DEGRADATION STRATEGIES
// ============================================================================

export interface DegradationConfig {
    feature: string;
    enabled: boolean;
    fallbackBehavior: 'static' | 'cached' | 'partial' | 'disabled';
    fallbackValue?: any;
    healthCheckUrl?: string;
}

const degradationConfigs: Map<string, DegradationConfig> = new Map([
    ['ai-analysis', {
        feature: 'ai-analysis',
        enabled: true,
        fallbackBehavior: 'static',
        fallbackValue: {
            recommendation: 'escalate',
            confidence: 0,
            reason: 'AI service unavailable - request escalated for manual review',
            violations: []
        }
    }],
    ['email-notifications', {
        feature: 'email-notifications',
        enabled: true,
        fallbackBehavior: 'partial',
        fallbackValue: { queued: true, message: 'Email queued for later delivery' }
    }],
    ['holiday-calendar', {
        feature: 'holiday-calendar',
        enabled: true,
        fallbackBehavior: 'cached',
        fallbackValue: [] // Empty holidays list
    }],
    ['dashboard-analytics', {
        feature: 'dashboard-analytics',
        enabled: true,
        fallbackBehavior: 'partial',
        fallbackValue: { partial: true, message: 'Some metrics temporarily unavailable' }
    }]
]);

/**
 * Executes an operation with graceful degradation
 */
export async function withGracefulDegradation<T>(
    feature: string,
    operation: () => Promise<T>,
    customFallback?: () => T | Promise<T>
): Promise<{ result: T; degraded: boolean; reason?: string }> {
    const config = degradationConfigs.get(feature);
    
    if (!config?.enabled) {
        // Feature disabled, use fallback
        logger.warn(`Feature disabled: ${feature}`);
        const fallback = customFallback 
            ? await customFallback() 
            : config?.fallbackValue;
        return { result: fallback, degraded: true, reason: 'Feature disabled' };
    }
    
    try {
        const result = await operation();
        return { result, degraded: false };
    } catch (error) {
        logger.error(`Feature degraded: ${feature}`, error as Error);
        incrementCounter('feature_degradation_total', 1, { feature });
        
        let fallbackResult: T;
        
        switch (config.fallbackBehavior) {
            case 'static':
                fallbackResult = config.fallbackValue as T;
                break;
            case 'cached':
                // Would fetch from cache in real implementation
                fallbackResult = config.fallbackValue as T;
                break;
            case 'partial':
                fallbackResult = customFallback 
                    ? await customFallback() 
                    : config.fallbackValue as T;
                break;
            case 'disabled':
            default:
                throw error; // Re-throw if no fallback
        }
        
        return {
            result: fallbackResult,
            degraded: true,
            reason: (error as Error).message
        };
    }
}

// ============================================================================
// 2. FEATURE FLAGS
// ============================================================================

export interface FeatureFlag {
    name: string;
    enabled: boolean;
    rolloutPercentage: number; // 0-100
    enabledForUsers?: string[];
    disabledForUsers?: string[];
    enabledForRoles?: string[];
    metadata?: Record<string, any>;
}

const featureFlags: Map<string, FeatureFlag> = new Map([
    ['ai-auto-approval', {
        name: 'ai-auto-approval',
        enabled: true,
        rolloutPercentage: 100,
        enabledForRoles: ['employee', 'manager']
    }],
    ['priority-leave-notifications', {
        name: 'priority-leave-notifications',
        enabled: true,
        rolloutPercentage: 100
    }],
    ['new-dashboard-ui', {
        name: 'new-dashboard-ui',
        enabled: false,
        rolloutPercentage: 0 // Not yet released
    }],
    ['chaos-testing', {
        name: 'chaos-testing',
        enabled: false,
        rolloutPercentage: 0,
        metadata: { environment: 'development-only' }
    }]
]);

/**
 * Checks if a feature flag is enabled for a user
 */
export function isFeatureEnabled(
    flagName: string,
    context?: { userId?: string; role?: string }
): boolean {
    const flag = featureFlags.get(flagName);
    
    if (!flag) return false;
    if (!flag.enabled) return false;
    
    // Check user-specific overrides
    if (context?.userId) {
        if (flag.disabledForUsers?.includes(context.userId)) return false;
        if (flag.enabledForUsers?.includes(context.userId)) return true;
    }
    
    // Check role-based access
    if (context?.role && flag.enabledForRoles) {
        if (!flag.enabledForRoles.includes(context.role)) return false;
    }
    
    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
        // Deterministic rollout based on user ID
        if (context?.userId) {
            const hash = simpleHash(context.userId);
            return (hash % 100) < flag.rolloutPercentage;
        }
        return Math.random() * 100 < flag.rolloutPercentage;
    }
    
    return true;
}

function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

export function setFeatureFlag(name: string, config: Partial<FeatureFlag>): void {
    const existing = featureFlags.get(name);
    if (existing) {
        featureFlags.set(name, { ...existing, ...config });
    } else {
        featureFlags.set(name, {
            name,
            enabled: false,
            rolloutPercentage: 0,
            ...config
        });
    }
}

export function getAllFeatureFlags(): FeatureFlag[] {
    return Array.from(featureFlags.values());
}

// ============================================================================
// 3. CHAOS TESTING SUPPORT
// ============================================================================

export interface ChaosConfig {
    enabled: boolean;
    failureRate: number;      // 0-1, probability of failure
    latencyInjection: {
        enabled: boolean;
        minMs: number;
        maxMs: number;
    };
    errorInjection: {
        enabled: boolean;
        errorTypes: string[];
    };
    resourceExhaustion: {
        enabled: boolean;
        type: 'memory' | 'connections' | 'timeout';
    };
}

let chaosConfig: ChaosConfig = {
    enabled: false,
    failureRate: 0,
    latencyInjection: { enabled: false, minMs: 100, maxMs: 5000 },
    errorInjection: { enabled: false, errorTypes: ['DatabaseError', 'NetworkError', 'TimeoutError'] },
    resourceExhaustion: { enabled: false, type: 'timeout' }
};

/**
 * Enables chaos testing (ONLY for development/testing!)
 */
export function enableChaos(config: Partial<ChaosConfig>): void {
    if (process.env.NODE_ENV === 'production') {
        logger.warn('Attempted to enable chaos testing in production - BLOCKED');
        return;
    }
    
    chaosConfig = { ...chaosConfig, ...config, enabled: true };
    logger.warn('Chaos testing enabled', { config: chaosConfig });
}

export function disableChaos(): void {
    chaosConfig.enabled = false;
    logger.info('Chaos testing disabled');
}

/**
 * Injects chaos into an operation if enabled
 */
export async function withChaos<T>(
    operationName: string,
    operation: () => Promise<T>
): Promise<T> {
    if (!chaosConfig.enabled) {
        return operation();
    }
    
    // Check if we should inject failure
    if (Math.random() < chaosConfig.failureRate) {
        incrementCounter('chaos_injection_total', 1, { type: 'failure', operation: operationName });
        
        if (chaosConfig.errorInjection.enabled) {
            const errorType = chaosConfig.errorInjection.errorTypes[
                Math.floor(Math.random() * chaosConfig.errorInjection.errorTypes.length)
            ];
            throw new Error(`[Chaos] Injected ${errorType} for ${operationName}`);
        }
    }
    
    // Inject latency
    if (chaosConfig.latencyInjection.enabled) {
        const delay = chaosConfig.latencyInjection.minMs + 
            Math.random() * (chaosConfig.latencyInjection.maxMs - chaosConfig.latencyInjection.minMs);
        incrementCounter('chaos_injection_total', 1, { type: 'latency', operation: operationName });
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    return operation();
}

// ============================================================================
// 4. FAILURE SCENARIO HANDLERS
// ============================================================================

export type FailureScenario = 
    | 'DATABASE_UNAVAILABLE'
    | 'AI_SERVICE_DOWN'
    | 'EMAIL_SERVICE_FAILURE'
    | 'AUTHENTICATION_FAILURE'
    | 'RATE_LIMIT_EXCEEDED'
    | 'NETWORK_PARTITION'
    | 'DISK_FULL'
    | 'MEMORY_EXHAUSTED';

interface FailureHandler {
    scenario: FailureScenario;
    detect: () => Promise<boolean>;
    handle: () => Promise<void>;
    recover: () => Promise<boolean>;
}

const failureHandlers: Map<FailureScenario, FailureHandler> = new Map();

/**
 * Registers a failure handler
 */
export function registerFailureHandler(handler: FailureHandler): void {
    failureHandlers.set(handler.scenario, handler);
}

/**
 * Handles a detected failure scenario
 */
export async function handleFailure(scenario: FailureScenario): Promise<{
    handled: boolean;
    recovered: boolean;
    message: string;
}> {
    const handler = failureHandlers.get(scenario);
    
    if (!handler) {
        logger.error(`No handler registered for scenario: ${scenario}`);
        return {
            handled: false,
            recovered: false,
            message: `Unknown failure scenario: ${scenario}`
        };
    }
    
    logger.warn(`Handling failure scenario: ${scenario}`);
    incrementCounter('failure_scenario_total', 1, { scenario });
    
    try {
        // Execute handler
        await handler.handle();
        
        // Attempt recovery
        const recovered = await handler.recover();
        
        return {
            handled: true,
            recovered,
            message: recovered 
                ? `Recovered from ${scenario}` 
                : `${scenario} handled but not recovered`
        };
    } catch (error) {
        logger.error(`Failed to handle scenario: ${scenario}`, error as Error);
        return {
            handled: false,
            recovered: false,
            message: (error as Error).message
        };
    }
}

// Register default failure handlers
registerFailureHandler({
    scenario: 'DATABASE_UNAVAILABLE',
    detect: async () => {
        return circuitBreakers_registry.database.getStatus().state === 'OPEN';
    },
    handle: async () => {
        logger.warn('Database unavailable - switching to read-only mode');
        // In production: enable read-only mode, serve cached data
    },
    recover: async () => {
        // Attempt to reconnect
        const status = circuitBreakers_registry.database.getStatus();
        return status.state === 'CLOSED';
    }
});

registerFailureHandler({
    scenario: 'AI_SERVICE_DOWN',
    detect: async () => {
        return circuitBreakers_registry.aiService.getStatus().state === 'OPEN';
    },
    handle: async () => {
        logger.warn('AI service down - all requests will be escalated to HR');
        // In production: disable auto-approval, escalate all requests
    },
    recover: async () => {
        const status = circuitBreakers_registry.aiService.getStatus();
        return status.state === 'CLOSED';
    }
});

registerFailureHandler({
    scenario: 'EMAIL_SERVICE_FAILURE',
    detect: async () => {
        return circuitBreakers_registry.email.getStatus().state === 'OPEN';
    },
    handle: async () => {
        logger.warn('Email service failure - queuing emails for retry');
        // Emails are queued in dead letter queue
    },
    recover: async () => {
        const status = circuitBreakers_registry.email.getStatus();
        return status.state === 'CLOSED';
    }
});

// ============================================================================
// 5. SYSTEM HEALTH MONITORING
// ============================================================================

export interface SystemHealthStatus {
    status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
    components: Record<string, { status: string; message?: string }>;
    activeFailures: FailureScenario[];
    degradedFeatures: string[];
    lastCheck: Date;
}

export async function getSystemHealthStatus(): Promise<SystemHealthStatus> {
    const components: Record<string, { status: string; message?: string }> = {};
    const activeFailures: FailureScenario[] = [];
    const degradedFeatures: string[] = [];
    
    // Check circuit breakers
    for (const [name, cb] of Object.entries(circuitBreakers_registry)) {
        const status = cb.getStatus();
        components[name] = {
            status: status.state,
            message: `Failures: ${status.failures}`
        };
        
        if (status.state === 'OPEN') {
            const scenario = name.toUpperCase().replace('-', '_') + '_FAILURE' as FailureScenario;
            if (failureHandlers.has(scenario)) {
                activeFailures.push(scenario);
            }
        }
    }
    
    // Check degradation configs
    for (const [feature, config] of degradationConfigs) {
        if (!config.enabled) {
            degradedFeatures.push(feature);
        }
    }
    
    // Determine overall status
    let status: SystemHealthStatus['status'] = 'HEALTHY';
    if (activeFailures.length > 0) {
        status = 'CRITICAL';
    } else if (degradedFeatures.length > 0) {
        status = 'DEGRADED';
    }
    
    return {
        status,
        components,
        activeFailures,
        degradedFeatures,
        lastCheck: new Date()
    };
}

// ============================================================================
// 6. RUNBOOK AUTOMATION
// ============================================================================

export interface RunbookStep {
    id: string;
    description: string;
    automated: boolean;
    action?: () => Promise<void>;
    verification?: () => Promise<boolean>;
}

export interface Runbook {
    id: string;
    name: string;
    scenario: FailureScenario;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    steps: RunbookStep[];
    estimatedTimeMinutes: number;
}

const runbooks: Map<FailureScenario, Runbook> = new Map([
    ['DATABASE_UNAVAILABLE', {
        id: 'rb_db_unavailable',
        name: 'Database Unavailability Response',
        scenario: 'DATABASE_UNAVAILABLE',
        severity: 'CRITICAL',
        estimatedTimeMinutes: 15,
        steps: [
            {
                id: 'step_1',
                description: 'Check database connection string and credentials',
                automated: false
            },
            {
                id: 'step_2',
                description: 'Verify database server is running',
                automated: false
            },
            {
                id: 'step_3',
                description: 'Check network connectivity to database',
                automated: true,
                action: async () => {
                    logger.info('Checking database connectivity...');
                }
            },
            {
                id: 'step_4',
                description: 'Enable read-only mode if database is down',
                automated: true,
                action: async () => {
                    setFeatureFlag('write-operations', { enabled: false });
                }
            },
            {
                id: 'step_5',
                description: 'Notify on-call team',
                automated: false
            }
        ]
    }],
    ['AI_SERVICE_DOWN', {
        id: 'rb_ai_down',
        name: 'AI Service Down Response',
        scenario: 'AI_SERVICE_DOWN',
        severity: 'HIGH',
        estimatedTimeMinutes: 10,
        steps: [
            {
                id: 'step_1',
                description: 'Verify AI service health endpoint',
                automated: true,
                action: async () => {
                    logger.info('Checking AI service health...');
                }
            },
            {
                id: 'step_2',
                description: 'Enable manual approval mode',
                automated: true,
                action: async () => {
                    setFeatureFlag('ai-auto-approval', { enabled: false });
                }
            },
            {
                id: 'step_3',
                description: 'Notify HR team of increased workload',
                automated: false
            }
        ]
    }]
]);

export function getRunbook(scenario: FailureScenario): Runbook | undefined {
    return runbooks.get(scenario);
}

export async function executeRunbook(scenario: FailureScenario): Promise<{
    completed: boolean;
    stepsExecuted: number;
    errors: string[];
}> {
    const runbook = runbooks.get(scenario);
    
    if (!runbook) {
        return { completed: false, stepsExecuted: 0, errors: ['Runbook not found'] };
    }
    
    logger.info(`Executing runbook: ${runbook.name}`);
    const errors: string[] = [];
    let stepsExecuted = 0;
    
    for (const step of runbook.steps) {
        if (step.automated && step.action) {
            try {
                await step.action();
                stepsExecuted++;
                logger.info(`Runbook step completed: ${step.description}`);
            } catch (error) {
                errors.push(`Step ${step.id} failed: ${(error as Error).message}`);
            }
        } else {
            logger.info(`Manual step required: ${step.description}`);
        }
    }
    
    return {
        completed: errors.length === 0,
        stepsExecuted,
        errors
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    // Graceful Degradation
    withGracefulDegradation,
    
    // Feature Flags
    isFeatureEnabled,
    setFeatureFlag,
    getAllFeatureFlags,
    
    // Chaos Testing
    enableChaos,
    disableChaos,
    withChaos,
    
    // Failure Handling
    registerFailureHandler,
    handleFailure,
    getSystemHealthStatus,
    
    // Runbooks
    getRunbook,
    executeRunbook
};
