/**
 * 👁️ ENTERPRISE OBSERVABILITY MODULE
 * ====================================
 * Implements: Structured Logging, Metrics, Distributed Tracing, Dashboards
 * 
 * PILLAR 8: OBSERVABILITY - See Inside the System
 */

import crypto from 'crypto';

// ============================================================================
// 1. TRACE CONTEXT (Distributed Tracing)
// ============================================================================

export interface TraceContext {
    traceId: string;           // Unique trace across services
    spanId: string;            // Current operation ID
    parentSpanId?: string;     // Parent operation
    baggage: Record<string, string>;  // Context propagation
}

export interface Span {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operationName: string;
    serviceName: string;
    startTime: number;
    endTime?: number;
    durationMs?: number;
    status: 'OK' | 'ERROR' | 'TIMEOUT';
    tags: Record<string, string | number | boolean>;
    logs: SpanLog[];
}

interface SpanLog {
    timestamp: number;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    fields?: Record<string, any>;
}

// Active spans storage
const activeSpans = new Map<string, Span>();
const completedSpans: Span[] = [];

/**
 * Creates a new trace context
 */
export function createTraceContext(parentContext?: TraceContext): TraceContext {
    return {
        traceId: parentContext?.traceId || crypto.randomUUID().replace(/-/g, ''),
        spanId: crypto.randomBytes(8).toString('hex'),
        parentSpanId: parentContext?.spanId,
        baggage: { ...parentContext?.baggage }
    };
}

/**
 * Starts a new span for tracing
 */
export function startSpan(
    operationName: string,
    context: TraceContext,
    tags: Record<string, string | number | boolean> = {}
): Span {
    const span: Span = {
        traceId: context.traceId,
        spanId: context.spanId,
        parentSpanId: context.parentSpanId,
        operationName,
        serviceName: process.env.SERVICE_NAME || 'tetradeck-web',
        startTime: Date.now(),
        status: 'OK',
        tags: {
            'service.version': process.env.npm_package_version || '1.0.0',
            ...tags
        },
        logs: []
    };
    
    activeSpans.set(span.spanId, span);
    return span;
}

/**
 * Ends a span and records duration
 */
export function endSpan(spanId: string, status: Span['status'] = 'OK'): Span | undefined {
    const span = activeSpans.get(spanId);
    if (!span) return undefined;
    
    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    span.status = status;
    
    activeSpans.delete(spanId);
    completedSpans.push(span);
    
    // Keep only last 10k spans in memory
    while (completedSpans.length > 10000) {
        completedSpans.shift();
    }
    
    return span;
}

/**
 * Adds a log to an active span
 */
export function logToSpan(
    spanId: string,
    level: SpanLog['level'],
    message: string,
    fields?: Record<string, any>
): void {
    const span = activeSpans.get(spanId);
    if (!span) return;
    
    span.logs.push({
        timestamp: Date.now(),
        level,
        message,
        fields
    });
}

/**
 * Decorator for automatic span creation
 */
export function withTracing<T>(
    operationName: string,
    operation: (ctx: TraceContext) => Promise<T>,
    parentContext?: TraceContext
): Promise<T> {
    const context = createTraceContext(parentContext);
    const span = startSpan(operationName, context);
    
    return operation(context)
        .then(result => {
            endSpan(span.spanId, 'OK');
            return result;
        })
        .catch(error => {
            logToSpan(span.spanId, 'error', (error as Error).message);
            endSpan(span.spanId, 'ERROR');
            throw error;
        });
}

// ============================================================================
// 2. STRUCTURED LOGGING
// ============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    service: string;
    traceId?: string;
    spanId?: string;
    userId?: string;
    requestId?: string;
    durationMs?: number;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
    metadata?: Record<string, any>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4
};

const currentLogLevel = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) || 'info'];
const logBuffer: LogEntry[] = [];

class StructuredLogger {
    private service: string;
    private defaultMetadata: Record<string, any>;
    
    constructor(service: string, defaultMetadata: Record<string, any> = {}) {
        this.service = service;
        this.defaultMetadata = defaultMetadata;
    }
    
    private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
        if (LOG_LEVELS[level] < currentLogLevel) return;
        
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            service: this.service,
            ...this.defaultMetadata,
            ...metadata
        };
        
        // Add to buffer for metrics
        logBuffer.push(entry);
        while (logBuffer.length > 1000) {
            logBuffer.shift();
        }
        
        // Output as JSON for log aggregators
        const output = JSON.stringify(entry);
        
        switch (level) {
            case 'debug':
            case 'info':
                console.log(output);
                break;
            case 'warn':
                console.warn(output);
                break;
            case 'error':
            case 'fatal':
                console.error(output);
                break;
        }
    }
    
    debug(message: string, metadata?: Record<string, any>): void {
        this.log('debug', message, metadata);
    }
    
    info(message: string, metadata?: Record<string, any>): void {
        this.log('info', message, metadata);
    }
    
    warn(message: string, metadata?: Record<string, any>): void {
        this.log('warn', message, metadata);
    }
    
    error(message: string, error?: Error, metadata?: Record<string, any>): void {
        this.log('error', message, {
            ...metadata,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : undefined
        });
    }
    
    fatal(message: string, error?: Error, metadata?: Record<string, any>): void {
        this.log('fatal', message, {
            ...metadata,
            error: error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : undefined
        });
    }
    
    withContext(context: Record<string, any>): StructuredLogger {
        return new StructuredLogger(this.service, {
            ...this.defaultMetadata,
            ...context
        });
    }
}

// Default logger instance
export const logger = new StructuredLogger('tetradeck-web');

// ============================================================================
// 3. METRICS COLLECTION
// ============================================================================

type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

interface Metric {
    name: string;
    type: MetricType;
    description: string;
    labels: string[];
}

interface MetricValue {
    name: string;
    value: number;
    labels: Record<string, string>;
    timestamp: number;
}

const metricDefinitions = new Map<string, Metric>();
const metricValues: MetricValue[] = [];

/**
 * Registers a new metric
 */
export function registerMetric(metric: Metric): void {
    metricDefinitions.set(metric.name, metric);
}

/**
 * Records a metric value
 */
export function recordMetric(
    name: string,
    value: number,
    labels: Record<string, string> = {}
): void {
    const metric = metricDefinitions.get(name);
    if (!metric) {
        // Auto-register as gauge
        registerMetric({
            name,
            type: 'gauge',
            description: 'Auto-registered metric',
            labels: Object.keys(labels)
        });
    }
    
    metricValues.push({
        name,
        value,
        labels,
        timestamp: Date.now()
    });
    
    // Keep only last 100k values
    while (metricValues.length > 100000) {
        metricValues.shift();
    }
}

/**
 * Increments a counter
 */
export function incrementCounter(
    name: string,
    increment: number = 1,
    labels: Record<string, string> = {}
): void {
    recordMetric(name, increment, labels);
}

/**
 * Records request duration
 */
export function recordDuration(
    name: string,
    durationMs: number,
    labels: Record<string, string> = {}
): void {
    recordMetric(`${name}_duration_ms`, durationMs, labels);
}

// Pre-register common metrics
registerMetric({
    name: 'http_requests_total',
    type: 'counter',
    description: 'Total HTTP requests',
    labels: ['method', 'path', 'status']
});

registerMetric({
    name: 'http_request_duration_ms',
    type: 'histogram',
    description: 'HTTP request duration in milliseconds',
    labels: ['method', 'path']
});

registerMetric({
    name: 'db_query_duration_ms',
    type: 'histogram',
    description: 'Database query duration in milliseconds',
    labels: ['operation', 'table']
});

registerMetric({
    name: 'email_sent_total',
    type: 'counter',
    description: 'Total emails sent',
    labels: ['template', 'status']
});

registerMetric({
    name: 'leave_requests_total',
    type: 'counter',
    description: 'Total leave requests',
    labels: ['type', 'status', 'auto_approved']
});

// ============================================================================
// 4. DASHBOARD DATA AGGREGATION
// ============================================================================

export interface DashboardMetrics {
    timestamp: Date;
    period: '1h' | '24h' | '7d' | '30d';
    requests: {
        total: number;
        successful: number;
        failed: number;
        avgDurationMs: number;
        p95DurationMs: number;
    };
    errors: {
        total: number;
        byType: Record<string, number>;
    };
    database: {
        queryCount: number;
        avgDurationMs: number;
    };
    business: {
        leaveRequestsSubmitted: number;
        leaveRequestsApproved: number;
        attendanceCheckIns: number;
        emailsSent: number;
    };
}

export function getDashboardMetrics(period: DashboardMetrics['period'] = '24h'): DashboardMetrics {
    const periodMs = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
    };
    
    const cutoff = Date.now() - periodMs[period];
    const recentMetrics = metricValues.filter(m => m.timestamp > cutoff);
    
    // Aggregate HTTP requests
    const httpRequests = recentMetrics.filter(m => m.name === 'http_requests_total');
    const httpDurations = recentMetrics.filter(m => m.name === 'http_request_duration_ms');
    
    // Calculate percentile
    const sortedDurations = httpDurations.map(m => m.value).sort((a, b) => a - b);
    const p95Index = Math.floor(sortedDurations.length * 0.95);
    
    // Aggregate errors from logs
    const recentLogs = logBuffer.filter(l => new Date(l.timestamp).getTime() > cutoff);
    const errorLogs = recentLogs.filter(l => l.level === 'error' || l.level === 'fatal');
    const errorsByType: Record<string, number> = {};
    for (const log of errorLogs) {
        const type = log.error?.name || 'UnknownError';
        errorsByType[type] = (errorsByType[type] || 0) + 1;
    }
    
    return {
        timestamp: new Date(),
        period,
        requests: {
            total: httpRequests.length,
            successful: httpRequests.filter(r => r.labels.status?.startsWith('2')).length,
            failed: httpRequests.filter(r => r.labels.status?.startsWith('5')).length,
            avgDurationMs: httpDurations.length > 0
                ? httpDurations.reduce((sum, m) => sum + m.value, 0) / httpDurations.length
                : 0,
            p95DurationMs: sortedDurations[p95Index] || 0
        },
        errors: {
            total: errorLogs.length,
            byType: errorsByType
        },
        database: {
            queryCount: recentMetrics.filter(m => m.name === 'db_query_duration_ms').length,
            avgDurationMs: 0
        },
        business: {
            leaveRequestsSubmitted: recentMetrics.filter(m => 
                m.name === 'leave_requests_total'
            ).length,
            leaveRequestsApproved: recentMetrics.filter(m => 
                m.name === 'leave_requests_total' && m.labels.status === 'approved'
            ).length,
            attendanceCheckIns: recentMetrics.filter(m => 
                m.name === 'attendance_check_in_total'
            ).length,
            emailsSent: recentMetrics.filter(m => 
                m.name === 'email_sent_total'
            ).length
        }
    };
}

// ============================================================================
// 5. TRACE QUERY API
// ============================================================================

export function getTracesByTimeRange(
    startTime: Date,
    endTime: Date,
    limit: number = 100
): Span[] {
    return completedSpans
        .filter(span => {
            const spanTime = span.startTime;
            return spanTime >= startTime.getTime() && spanTime <= endTime.getTime();
        })
        .slice(-limit);
}

export function getTraceById(traceId: string): Span[] {
    return completedSpans.filter(span => span.traceId === traceId);
}

export function getSlowTraces(thresholdMs: number = 1000, limit: number = 50): Span[] {
    return completedSpans
        .filter(span => (span.durationMs || 0) > thresholdMs)
        .sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0))
        .slice(0, limit);
}

export function getErrorTraces(limit: number = 50): Span[] {
    return completedSpans
        .filter(span => span.status === 'ERROR')
        .slice(-limit);
}

// ============================================================================
// 6. REQUEST TRACKING MIDDLEWARE HELPERS
// ============================================================================

export interface RequestContext {
    requestId: string;
    traceId: string;
    spanId: string;
    userId?: string;
    path: string;
    method: string;
    startTime: number;
}

export function createRequestContext(
    method: string,
    path: string,
    userId?: string,
    parentTraceId?: string
): RequestContext {
    const trace = createTraceContext(parentTraceId ? { traceId: parentTraceId, spanId: '', baggage: {} } : undefined);
    
    return {
        requestId: crypto.randomUUID(),
        traceId: trace.traceId,
        spanId: trace.spanId,
        userId,
        path,
        method,
        startTime: Date.now()
    };
}

export function finalizeRequestContext(
    context: RequestContext,
    statusCode: number
): void {
    const duration = Date.now() - context.startTime;
    
    // Record metrics
    incrementCounter('http_requests_total', 1, {
        method: context.method,
        path: context.path,
        status: statusCode.toString()
    });
    
    recordDuration('http_request', duration, {
        method: context.method,
        path: context.path
    });
    
    // Log request
    logger.info('Request completed', {
        requestId: context.requestId,
        traceId: context.traceId,
        userId: context.userId,
        method: context.method,
        path: context.path,
        statusCode,
        durationMs: duration
    });
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
    // Tracing
    createTraceContext,
    startSpan,
    endSpan,
    logToSpan,
    withTracing,
    getTraceById,
    getTracesByTimeRange,
    getSlowTraces,
    getErrorTraces,
    
    // Logging
    logger,
    
    // Metrics
    registerMetric,
    recordMetric,
    incrementCounter,
    recordDuration,
    getDashboardMetrics,
    
    // Request tracking
    createRequestContext,
    finalizeRequestContext
};
