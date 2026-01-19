/**
 * 🏢 ENTERPRISE RELIABILITY MODULE
 * ================================
 * Implements: Retry Logic, Circuit Breakers, Idempotency, Rate Limiting
 * 
 * PILLAR 1: RELIABILITY - The Foundation
 * PILLAR 9: RESILIENCE - Survive Chaos
 */

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

// ============================================================================
// 1. RETRY LOGIC WITH EXPONENTIAL BACKOFF
// ============================================================================

interface RetryConfig {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    retryableErrors?: string[];
}

const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'P1001', 'P1017']
};

export async function withRetry<T>(
    operation: () => Promise<T>,
    config: RetryConfig = {},
    operationName: string = 'operation'
): Promise<T> {
    const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;
            const errorCode = (error as any)?.code || (error as any)?.message || '';
            
            // Check if error is retryable
            const isRetryable = cfg.retryableErrors.some(code => 
                errorCode.includes(code)
            );
            
            if (!isRetryable || attempt === cfg.maxAttempts) {
                console.error(`[Reliability] ${operationName} failed after ${attempt} attempts:`, error);
                throw error;
            }
            
            // Calculate delay with exponential backoff + jitter
            const delay = Math.min(
                cfg.baseDelayMs * Math.pow(cfg.backoffMultiplier, attempt - 1) + Math.random() * 100,
                cfg.maxDelayMs
            );
            
            console.warn(`[Reliability] ${operationName} attempt ${attempt} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw lastError;
}

// ============================================================================
// 2. CIRCUIT BREAKER PATTERN
// ============================================================================

interface CircuitBreakerState {
    failures: number;
    lastFailureTime: number;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

interface CircuitBreakerConfig {
    failureThreshold: number;      // Number of failures before opening
    recoveryTimeMs: number;        // Time before attempting recovery
    halfOpenSuccessThreshold: number;  // Successes needed to close
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

const DEFAULT_CB_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeMs: 30000,         // 30 seconds
    halfOpenSuccessThreshold: 2
};

export class CircuitBreaker {
    private name: string;
    private config: CircuitBreakerConfig;
    private successCount: number = 0;
    
    constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
        this.name = name;
        this.config = { ...DEFAULT_CB_CONFIG, ...config };
        
        if (!circuitBreakers.has(name)) {
            circuitBreakers.set(name, {
                failures: 0,
                lastFailureTime: 0,
                state: 'CLOSED'
            });
        }
    }
    
    private getState(): CircuitBreakerState {
        return circuitBreakers.get(this.name)!;
    }
    
    private updateState(update: Partial<CircuitBreakerState>): void {
        const current = this.getState();
        circuitBreakers.set(this.name, { ...current, ...update });
    }
    
    async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
        const state = this.getState();
        
        // Check if circuit is open
        if (state.state === 'OPEN') {
            const timeSinceFailure = Date.now() - state.lastFailureTime;
            
            if (timeSinceFailure > this.config.recoveryTimeMs) {
                // Move to half-open state
                this.updateState({ state: 'HALF_OPEN' });
                this.successCount = 0;
                console.log(`[CircuitBreaker:${this.name}] Transitioning to HALF_OPEN`);
            } else {
                console.warn(`[CircuitBreaker:${this.name}] Circuit OPEN, using fallback`);
                if (fallback) {
                    return fallback();
                }
                throw new Error(`Circuit breaker ${this.name} is open`);
            }
        }
        
        try {
            const result = await operation();
            
            // Handle success
            if (state.state === 'HALF_OPEN') {
                this.successCount++;
                if (this.successCount >= this.config.halfOpenSuccessThreshold) {
                    this.updateState({ state: 'CLOSED', failures: 0 });
                    console.log(`[CircuitBreaker:${this.name}] Circuit CLOSED after recovery`);
                }
            } else {
                this.updateState({ failures: 0 });
            }
            
            return result;
        } catch (error) {
            // Handle failure
            const newFailures = state.failures + 1;
            
            if (newFailures >= this.config.failureThreshold) {
                this.updateState({
                    state: 'OPEN',
                    failures: newFailures,
                    lastFailureTime: Date.now()
                });
                console.error(`[CircuitBreaker:${this.name}] Circuit OPENED after ${newFailures} failures`);
            } else {
                this.updateState({ failures: newFailures });
            }
            
            if (fallback) {
                console.warn(`[CircuitBreaker:${this.name}] Using fallback after failure`);
                return fallback();
            }
            
            throw error;
        }
    }
    
    getStatus(): { name: string; state: string; failures: number } {
        const state = this.getState();
        return {
            name: this.name,
            state: state.state,
            failures: state.failures
        };
    }
}

// Pre-configured circuit breakers for common services
export const circuitBreakers_registry = {
    database: new CircuitBreaker('database', { failureThreshold: 3, recoveryTimeMs: 15000 }),
    email: new CircuitBreaker('email', { failureThreshold: 5, recoveryTimeMs: 60000 }),
    aiService: new CircuitBreaker('ai-service', { failureThreshold: 3, recoveryTimeMs: 30000 }),
    externalApi: new CircuitBreaker('external-api', { failureThreshold: 5, recoveryTimeMs: 45000 })
};

// ============================================================================
// 3. IDEMPOTENCY KEY MANAGEMENT
// ============================================================================

interface IdempotencyRecord {
    key: string;
    response: string;
    createdAt: Date;
    expiresAt: Date;
}

// In-memory store (replace with Redis in production)
const idempotencyStore = new Map<string, IdempotencyRecord>();

export async function withIdempotency<T>(
    idempotencyKey: string,
    operation: () => Promise<T>,
    ttlSeconds: number = 86400  // 24 hours default
): Promise<{ result: T; cached: boolean }> {
    // Check if we have a cached response
    const cached = idempotencyStore.get(idempotencyKey);
    
    if (cached && cached.expiresAt > new Date()) {
        console.log(`[Idempotency] Returning cached response for key: ${idempotencyKey}`);
        return {
            result: JSON.parse(cached.response),
            cached: true
        };
    }
    
    // Execute operation and cache result
    const result = await operation();
    
    const record: IdempotencyRecord = {
        key: idempotencyKey,
        response: JSON.stringify(result),
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    };
    
    idempotencyStore.set(idempotencyKey, record);
    
    // Cleanup old entries periodically
    if (idempotencyStore.size > 10000) {
        const now = new Date();
        for (const [key, value] of idempotencyStore.entries()) {
            if (value.expiresAt < now) {
                idempotencyStore.delete(key);
            }
        }
    }
    
    return { result, cached: false };
}

export function generateIdempotencyKey(...parts: (string | number)[]): string {
    const content = parts.join(':');
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// ============================================================================
// 4. RATE LIMITING
// ============================================================================

interface RateLimitConfig {
    windowMs: number;          // Time window in milliseconds
    maxRequests: number;       // Max requests per window
    keyPrefix?: string;        // Prefix for rate limit keys
}

interface RateLimitEntry {
    count: number;
    windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export class RateLimiter {
    private config: Required<RateLimitConfig>;
    
    constructor(config: RateLimitConfig) {
        this.config = {
            windowMs: config.windowMs,
            maxRequests: config.maxRequests,
            keyPrefix: config.keyPrefix || 'rl'
        };
    }
    
    check(identifier: string): { allowed: boolean; remaining: number; resetMs: number } {
        const key = `${this.config.keyPrefix}:${identifier}`;
        const now = Date.now();
        
        let entry = rateLimitStore.get(key);
        
        // Create new window if needed
        if (!entry || (now - entry.windowStart) > this.config.windowMs) {
            entry = { count: 0, windowStart: now };
        }
        
        const resetMs = this.config.windowMs - (now - entry.windowStart);
        const remaining = Math.max(0, this.config.maxRequests - entry.count - 1);
        
        if (entry.count >= this.config.maxRequests) {
            return { allowed: false, remaining: 0, resetMs };
        }
        
        // Increment count
        entry.count++;
        rateLimitStore.set(key, entry);
        
        return { allowed: true, remaining, resetMs };
    }
    
    async withRateLimit<T>(
        identifier: string,
        operation: () => Promise<T>
    ): Promise<T> {
        const { allowed, remaining, resetMs } = this.check(identifier);
        
        if (!allowed) {
            const error = new Error(`Rate limit exceeded. Try again in ${Math.ceil(resetMs / 1000)} seconds`) as any;
            error.code = 'RATE_LIMIT_EXCEEDED';
            error.retryAfter = Math.ceil(resetMs / 1000);
            throw error;
        }
        
        return operation();
    }
}

// Pre-configured rate limiters
export const rateLimiters = {
    api: new RateLimiter({ windowMs: 60000, maxRequests: 100, keyPrefix: 'api' }),
    auth: new RateLimiter({ windowMs: 300000, maxRequests: 10, keyPrefix: 'auth' }),
    email: new RateLimiter({ windowMs: 3600000, maxRequests: 50, keyPrefix: 'email' }),
    leaveSubmit: new RateLimiter({ windowMs: 60000, maxRequests: 5, keyPrefix: 'leave' })
};

// ============================================================================
// 5. REQUEST TIMEOUT WRAPPER
// ============================================================================

export async function withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number,
    operationName: string = 'operation'
): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
            reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    
    return Promise.race([operation, timeoutPromise]);
}

// ============================================================================
// 6. DEAD LETTER QUEUE (DLQ)
// ============================================================================

interface DeadLetterEntry {
    id: string;
    operation: string;
    payload: any;
    error: string;
    attemptCount: number;
    createdAt: Date;
    lastAttemptAt: Date;
}

const deadLetterQueue: DeadLetterEntry[] = [];

export function addToDeadLetterQueue(
    operation: string,
    payload: any,
    error: Error,
    attemptCount: number
): string {
    const id = crypto.randomUUID();
    const entry: DeadLetterEntry = {
        id,
        operation,
        payload,
        error: error.message,
        attemptCount,
        createdAt: new Date(),
        lastAttemptAt: new Date()
    };
    
    deadLetterQueue.push(entry);
    console.error(`[DLQ] Added failed operation: ${operation}`, { id, error: error.message });
    
    // Keep only last 1000 entries
    while (deadLetterQueue.length > 1000) {
        deadLetterQueue.shift();
    }
    
    return id;
}

export function getDeadLetterQueue(): DeadLetterEntry[] {
    return [...deadLetterQueue];
}

export function removeFromDeadLetterQueue(id: string): boolean {
    const index = deadLetterQueue.findIndex(e => e.id === id);
    if (index > -1) {
        deadLetterQueue.splice(index, 1);
        return true;
    }
    return false;
}

// ============================================================================
// 7. HEALTH CHECK AGGREGATOR
// ============================================================================

export interface HealthCheckResult {
    service: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    latencyMs: number;
    message?: string;
    lastCheck: Date;
}

export interface SystemHealth {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    checks: HealthCheckResult[];
    timestamp: Date;
    uptime: number;
}

const startTime = Date.now();

export async function performHealthCheck(): Promise<SystemHealth> {
    const checks: HealthCheckResult[] = [];
    
    // Database health check
    const dbCheck = await checkDatabase();
    checks.push(dbCheck);
    
    // Circuit breaker status
    for (const [name, cb] of Object.entries(circuitBreakers_registry)) {
        const status = cb.getStatus();
        checks.push({
            service: `circuit-breaker:${name}`,
            status: status.state === 'CLOSED' ? 'healthy' : status.state === 'HALF_OPEN' ? 'degraded' : 'unhealthy',
            latencyMs: 0,
            message: `State: ${status.state}, Failures: ${status.failures}`,
            lastCheck: new Date()
        });
    }
    
    // Determine overall status
    const hasUnhealthy = checks.some(c => c.status === 'unhealthy');
    const hasDegraded = checks.some(c => c.status === 'degraded');
    const overall = hasUnhealthy ? 'unhealthy' : hasDegraded ? 'degraded' : 'healthy';
    
    return {
        overall,
        checks,
        timestamp: new Date(),
        uptime: Date.now() - startTime
    };
}

async function checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        return {
            service: 'database',
            status: 'healthy',
            latencyMs: Date.now() - start,
            lastCheck: new Date()
        };
    } catch (error) {
        return {
            service: 'database',
            status: 'unhealthy',
            latencyMs: Date.now() - start,
            message: (error as Error).message,
            lastCheck: new Date()
        };
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    withRetry,
    CircuitBreaker,
    circuitBreakers: circuitBreakers_registry,
    withIdempotency,
    generateIdempotencyKey,
    RateLimiter,
    rateLimiters,
    withTimeout,
    addToDeadLetterQueue,
    getDeadLetterQueue,
    removeFromDeadLetterQueue,
    performHealthCheck
};
