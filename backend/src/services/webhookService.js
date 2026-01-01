/**
 * Webhook Service
 * 
 * Manages webhook registrations and delivers events to external systems.
 * Supports retry logic, signature verification, and delivery tracking.
 * 
 * @module services/webhookService
 */

const crypto = require('crypto');
const axios = require('axios');
const db = require('../config/db');
const env = require('../config/environment');
const logger = require('./logger');

// Supported webhook events
const EVENTS = {
    // Leave events
    'leave.requested': 'A leave request was submitted',
    'leave.approved': 'A leave request was approved',
    'leave.rejected': 'A leave request was rejected',
    'leave.cancelled': 'A leave request was cancelled',
    
    // Employee events
    'employee.created': 'A new employee was created',
    'employee.updated': 'An employee record was updated',
    'employee.terminated': 'An employee was terminated',
    
    // Onboarding events
    'onboarding.started': 'Employee onboarding started',
    'onboarding.task_completed': 'An onboarding task was completed',
    'onboarding.completed': 'Employee onboarding completed',
    
    // User events
    'user.created': 'A new user was created',
    'user.role_changed': 'A user role was changed',
    'user.deactivated': 'A user was deactivated',
    
    // System events
    'system.backup_completed': 'Database backup completed',
    'system.alert': 'System alert triggered',
};

/**
 * Generate HMAC signature for payload
 * @param {string} payload - JSON payload string
 * @param {string} secret - Webhook secret
 * @returns {string} HMAC signature
 */
function generateSignature(payload, secret) {
    return crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
}

/**
 * Register a new webhook
 * @param {Object} webhookData - Webhook configuration
 * @returns {Promise<Object>} Created webhook
 */
async function registerWebhook(webhookData) {
    const {
        tenantId = env.multiTenant.defaultTenantId,
        name,
        url,
        events,
        headers = {},
    } = webhookData;

    // Validate URL
    try {
        new URL(url);
    } catch {
        throw new Error('Invalid webhook URL');
    }

    // Validate events
    const invalidEvents = events.filter(e => !EVENTS[e]);
    if (invalidEvents.length > 0) {
        throw new Error(`Invalid events: ${invalidEvents.join(', ')}`);
    }

    // Generate secret
    const secret = crypto.randomBytes(32).toString('hex');

    const result = await db.execute(`
        INSERT INTO webhooks (tenant_id, name, url, secret, events, headers)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [tenantId, name, url, secret, JSON.stringify(events), JSON.stringify(headers)]);

    return {
        id: result.insertId,
        name,
        url,
        secret,
        events,
        isActive: true,
    };
}

/**
 * Get all webhooks for a tenant
 * @param {string} tenantId - Tenant identifier
 * @returns {Promise<Array>} List of webhooks
 */
async function getWebhooks(tenantId = env.multiTenant.defaultTenantId) {
    const webhooks = await db.query(
        'SELECT * FROM webhooks WHERE tenant_id = ? ORDER BY created_at DESC',
        [tenantId]
    );

    return webhooks.map(w => ({
        ...w,
        events: JSON.parse(w.events || '[]'),
        headers: JSON.parse(w.headers || '{}'),
    }));
}

/**
 * Update a webhook
 * @param {number} webhookId - Webhook ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated webhook
 */
async function updateWebhook(webhookId, updates) {
    const allowedFields = ['name', 'url', 'events', 'headers', 'is_active'];
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (allowedFields.includes(dbKey)) {
            setClause.push(`${dbKey} = ?`);
            values.push(['events', 'headers'].includes(dbKey) ? JSON.stringify(value) : value);
        }
    }

    if (setClause.length === 0) {
        throw new Error('No valid fields to update');
    }

    values.push(webhookId);
    await db.execute(
        `UPDATE webhooks SET ${setClause.join(', ')}, updated_at = NOW() WHERE id = ?`,
        values
    );

    return db.getOne('SELECT * FROM webhooks WHERE id = ?', [webhookId]);
}

/**
 * Delete a webhook
 * @param {number} webhookId - Webhook ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteWebhook(webhookId) {
    const result = await db.execute('DELETE FROM webhooks WHERE id = ?', [webhookId]);
    return result.affectedRows > 0;
}

/**
 * Trigger a webhook event
 * @param {string} eventType - Event type
 * @param {Object} payload - Event payload
 * @param {string} tenantId - Tenant identifier
 */
async function trigger(eventType, payload, tenantId = env.multiTenant.defaultTenantId) {
    if (!EVENTS[eventType]) {
        logger.warn('Unknown webhook event type', { eventType });
        return;
    }

    // Get all active webhooks subscribed to this event
    const webhooks = await db.query(`
        SELECT * FROM webhooks 
        WHERE tenant_id = ? 
        AND is_active = 1 
        AND JSON_CONTAINS(events, ?)
    `, [tenantId, `"${eventType}"`]);

    // Deliver to each webhook
    for (const webhook of webhooks) {
        deliverWebhook(webhook, eventType, payload).catch(error => {
            logger.error('Webhook delivery failed', {
                webhookId: webhook.id,
                eventType,
                error: error.message,
            });
        });
    }
}

/**
 * Deliver a webhook
 * @param {Object} webhook - Webhook configuration
 * @param {string} eventType - Event type
 * @param {Object} payload - Event payload
 */
async function deliverWebhook(webhook, eventType, payload) {
    const deliveryPayload = {
        event: eventType,
        timestamp: new Date().toISOString(),
        webhookId: webhook.id,
        data: payload,
    };

    const payloadString = JSON.stringify(deliveryPayload);
    const signature = generateSignature(payloadString, webhook.secret);

    const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': eventType,
        'X-Webhook-Delivery': crypto.randomUUID(),
        ...JSON.parse(webhook.headers || '{}'),
    };

    let attempts = 0;
    let lastError = null;
    let responseStatus = null;
    let responseBody = null;

    while (attempts < env.webhooks.retryCount) {
        attempts++;

        try {
            const response = await axios.post(webhook.url, payloadString, {
                headers,
                timeout: env.webhooks.timeoutMs,
            });

            responseStatus = response.status;
            responseBody = JSON.stringify(response.data).substring(0, 1000);

            // Log successful delivery
            await logDelivery(webhook.id, eventType, deliveryPayload, responseStatus, responseBody, attempts);

            // Update webhook stats
            await db.execute(`
                UPDATE webhooks 
                SET last_triggered_at = NOW(), failure_count = 0 
                WHERE id = ?
            `, [webhook.id]);

            return;
        } catch (error) {
            lastError = error;
            responseStatus = error.response?.status || 0;
            responseBody = error.message;

            // Wait before retry (exponential backoff)
            if (attempts < env.webhooks.retryCount) {
                await new Promise(r => setTimeout(r, Math.pow(2, attempts) * 1000));
            }
        }
    }

    // Log failed delivery
    await logDelivery(webhook.id, eventType, deliveryPayload, responseStatus, responseBody, attempts);

    // Update failure count
    await db.execute(`
        UPDATE webhooks 
        SET failure_count = failure_count + 1, last_triggered_at = NOW() 
        WHERE id = ?
    `, [webhook.id]);

    // Disable webhook after too many failures
    const failureCount = (await db.getOne('SELECT failure_count FROM webhooks WHERE id = ?', [webhook.id]))?.failure_count || 0;
    if (failureCount >= 10) {
        await db.execute('UPDATE webhooks SET is_active = 0 WHERE id = ?', [webhook.id]);
        logger.warn('Webhook disabled due to failures', { webhookId: webhook.id, failures: failureCount });
    }
}

/**
 * Log webhook delivery attempt
 */
async function logDelivery(webhookId, eventType, payload, status, response, attempts) {
    try {
        await db.execute(`
            INSERT INTO webhook_deliveries (webhook_id, event_type, payload, response_status, response_body, attempt_count, delivered_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        `, [webhookId, eventType, JSON.stringify(payload), status, response, attempts]);
    } catch (error) {
        logger.error('Failed to log webhook delivery', { error: error.message });
    }
}

/**
 * Get delivery history for a webhook
 * @param {number} webhookId - Webhook ID
 * @param {number} limit - Max results
 * @returns {Promise<Array>} Delivery history
 */
async function getDeliveryHistory(webhookId, limit = 50) {
    return db.query(`
        SELECT * FROM webhook_deliveries 
        WHERE webhook_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
    `, [webhookId, limit]);
}

/**
 * Test a webhook by sending a test event
 * @param {number} webhookId - Webhook ID
 * @returns {Promise<Object>} Test result
 */
async function testWebhook(webhookId) {
    const webhook = await db.getOne('SELECT * FROM webhooks WHERE id = ?', [webhookId]);
    if (!webhook) {
        throw new Error('Webhook not found');
    }

    const testPayload = {
        test: true,
        message: 'This is a test webhook delivery',
        timestamp: new Date().toISOString(),
    };

    try {
        await deliverWebhook(webhook, 'system.test', testPayload);
        return { success: true, message: 'Test webhook delivered successfully' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

module.exports = {
    EVENTS,
    registerWebhook,
    getWebhooks,
    updateWebhook,
    deleteWebhook,
    trigger,
    testWebhook,
    getDeliveryHistory,
    generateSignature,
};
