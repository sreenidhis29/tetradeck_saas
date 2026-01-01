/**
 * Health Check Service
 * 
 * Provides comprehensive health check endpoints for monitoring.
 * Supports liveness, readiness, and detailed status checks.
 * 
 * @module services/healthService
 */

const db = require('../config/db');
const env = require('../config/environment');
const axios = require('axios');

/**
 * Check database health
 * @returns {Promise<Object>} Database health status
 */
async function checkDatabase() {
    const startTime = Date.now();
    try {
        const health = await db.getHealth();
        return {
            status: health.connected ? 'healthy' : 'unhealthy',
            responseTime: health.responseTime,
            details: health.poolInfo,
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            error: error.message,
        };
    }
}

/**
 * Check AI service health
 * @param {string} name - Service name
 * @param {string} url - Service URL
 * @returns {Promise<Object>} Service health status
 */
async function checkAIService(name, url) {
    const startTime = Date.now();
    try {
        const response = await axios.get(`${url}/health`, { timeout: 2000 });
        return {
            status: 'healthy',
            responseTime: Date.now() - startTime,
            version: response.data?.version,
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            error: error.code === 'ECONNREFUSED' ? 'Service unavailable' : error.message,
        };
    }
}

/**
 * Check Redis health (if enabled)
 * @returns {Promise<Object>} Redis health status
 */
async function checkRedis() {
    if (!env.redis.enabled) {
        return { status: 'disabled' };
    }
    
    // Placeholder - implement Redis health check when Redis client is added
    return { status: 'not_configured' };
}

/**
 * Get memory usage
 * @returns {Object} Memory usage stats
 */
function getMemoryUsage() {
    const used = process.memoryUsage();
    return {
        heapUsed: Math.round(used.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(used.heapTotal / 1024 / 1024) + 'MB',
        external: Math.round(used.external / 1024 / 1024) + 'MB',
        rss: Math.round(used.rss / 1024 / 1024) + 'MB',
    };
}

/**
 * Get system info
 * @returns {Object} System information
 */
function getSystemInfo() {
    return {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: Math.round(process.uptime()),
        environment: env.nodeEnv,
    };
}

/**
 * Liveness check - is the process running?
 * @returns {Object} Liveness status
 */
function livenessCheck() {
    return {
        status: 'alive',
        timestamp: new Date().toISOString(),
    };
}

/**
 * Readiness check - is the service ready to handle requests?
 * @returns {Promise<Object>} Readiness status
 */
async function readinessCheck() {
    const dbHealth = await checkDatabase();
    
    return {
        status: dbHealth.status === 'healthy' ? 'ready' : 'not_ready',
        timestamp: new Date().toISOString(),
        checks: {
            database: dbHealth.status,
        },
    };
}

/**
 * Full health check with all dependencies
 * @returns {Promise<Object>} Comprehensive health status
 */
async function fullHealthCheck() {
    const [dbHealth, leaveAI, onboardingAI] = await Promise.all([
        checkDatabase(),
        checkAIService('leave-agent', env.ai.leaveUrl),
        checkAIService('onboarding-agent', env.ai.onboardingUrl),
    ]);

    const checks = {
        database: dbHealth,
        aiServices: {
            leave: leaveAI,
            onboarding: onboardingAI,
        },
    };

    // Overall status is unhealthy if any critical service is down
    const isHealthy = dbHealth.status === 'healthy';

    return {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        checks,
        system: getSystemInfo(),
        memory: getMemoryUsage(),
    };
}

/**
 * Metrics endpoint data (Prometheus format)
 * @returns {Promise<string>} Prometheus metrics
 */
async function getMetrics() {
    const memory = process.memoryUsage();
    const dbHealth = await checkDatabase();

    const metrics = [
        `# HELP nodejs_heap_used_bytes Node.js heap used`,
        `# TYPE nodejs_heap_used_bytes gauge`,
        `nodejs_heap_used_bytes ${memory.heapUsed}`,
        ``,
        `# HELP nodejs_heap_total_bytes Node.js heap total`,
        `# TYPE nodejs_heap_total_bytes gauge`,
        `nodejs_heap_total_bytes ${memory.heapTotal}`,
        ``,
        `# HELP process_uptime_seconds Process uptime`,
        `# TYPE process_uptime_seconds gauge`,
        `process_uptime_seconds ${process.uptime()}`,
        ``,
        `# HELP database_healthy Database health status`,
        `# TYPE database_healthy gauge`,
        `database_healthy ${dbHealth.status === 'healthy' ? 1 : 0}`,
        ``,
        `# HELP database_response_time_ms Database response time`,
        `# TYPE database_response_time_ms gauge`,
        `database_response_time_ms ${dbHealth.responseTime || 0}`,
    ];

    return metrics.join('\n');
}

/**
 * Express router for health endpoints
 * @returns {Router} Express router
 */
function createHealthRouter() {
    const express = require('express');
    const router = express.Router();

    // Liveness probe - just checks if process is running
    router.get('/live', (req, res) => {
        res.json(livenessCheck());
    });

    // Readiness probe - checks if service can handle requests
    router.get('/ready', async (req, res) => {
        const status = await readinessCheck();
        res.status(status.status === 'ready' ? 200 : 503).json(status);
    });

    // Full health check with all dependencies
    router.get('/', async (req, res) => {
        const status = await fullHealthCheck();
        res.status(status.status === 'healthy' ? 200 : 503).json(status);
    });

    // Prometheus metrics endpoint
    router.get('/metrics', async (req, res) => {
        res.set('Content-Type', 'text/plain');
        res.send(await getMetrics());
    });

    return router;
}

module.exports = {
    livenessCheck,
    readinessCheck,
    fullHealthCheck,
    getMetrics,
    createHealthRouter,
    checkDatabase,
    checkAIService,
    getMemoryUsage,
    getSystemInfo,
};
