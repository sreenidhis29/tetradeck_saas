/**
 * Multi-Tenancy Service
 * 
 * Provides tenant isolation for SaaS deployments.
 * Supports schema-based and row-based isolation strategies.
 * 
 * @module services/tenantService
 */

const db = require('../config/db');
const env = require('../config/environment');

// Cache for tenant data
const tenantCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get tenant by ID
 * @param {string} tenantId - Tenant identifier
 * @returns {Promise<Object|null>} Tenant data
 */
async function getTenant(tenantId) {
    // Check cache first
    const cached = tenantCache.get(tenantId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    try {
        const tenant = await db.getOne(
            'SELECT * FROM tenants WHERE tenant_id = ? AND is_active = 1',
            [tenantId]
        );

        if (tenant) {
            // Parse JSON settings
            if (tenant.settings && typeof tenant.settings === 'string') {
                tenant.settings = JSON.parse(tenant.settings);
            }
            
            tenantCache.set(tenantId, {
                data: tenant,
                timestamp: Date.now(),
            });
        }

        return tenant;
    } catch (error) {
        console.error('Error fetching tenant:', error.message);
        return null;
    }
}

/**
 * Get tenant by domain
 * @param {string} domain - Domain name
 * @returns {Promise<Object|null>} Tenant data
 */
async function getTenantByDomain(domain) {
    try {
        const tenant = await db.getOne(
            'SELECT * FROM tenants WHERE domain = ? AND is_active = 1',
            [domain]
        );

        if (tenant && tenant.settings && typeof tenant.settings === 'string') {
            tenant.settings = JSON.parse(tenant.settings);
        }

        return tenant;
    } catch (error) {
        console.error('Error fetching tenant by domain:', error.message);
        return null;
    }
}

/**
 * Create a new tenant
 * @param {Object} tenantData - Tenant details
 * @returns {Promise<Object>} Created tenant
 */
async function createTenant(tenantData) {
    const {
        tenantId,
        name,
        domain = null,
        settings = {},
        subscriptionPlan = 'free',
    } = tenantData;

    // Validate tenant ID format
    if (!/^[a-z0-9-]+$/.test(tenantId)) {
        throw new Error('Tenant ID must contain only lowercase letters, numbers, and hyphens');
    }

    // Check if tenant already exists
    const existing = await getTenant(tenantId);
    if (existing) {
        throw new Error('Tenant ID already exists');
    }

    // Calculate trial end date (14 days)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    await db.execute(`
        INSERT INTO tenants (tenant_id, name, domain, settings, subscription_plan, subscription_status, trial_ends_at)
        VALUES (?, ?, ?, ?, ?, 'trial', ?)
    `, [tenantId, name, domain, JSON.stringify(settings), subscriptionPlan, trialEndsAt]);

    // Create default data for new tenant
    await initializeTenantData(tenantId);

    return getTenant(tenantId);
}

/**
 * Initialize default data for a new tenant
 * @param {string} tenantId - Tenant identifier
 */
async function initializeTenantData(tenantId) {
    // Add default leave types
    try {
        await db.execute(`
            INSERT INTO leave_types (tenant_id, name, days_per_year, carry_over, requires_approval)
            VALUES 
                (?, 'Vacation', 20, 5, 1),
                (?, 'Sick Leave', 10, 0, 1),
                (?, 'Personal', 5, 0, 1),
                (?, 'Parental', 90, 0, 1)
        `, [tenantId, tenantId, tenantId, tenantId]);
    } catch (error) {
        // Ignore if table doesn't exist or data exists
    }
}

/**
 * Update tenant settings
 * @param {string} tenantId - Tenant identifier
 * @param {Object} updates - Settings to update
 * @returns {Promise<Object>} Updated tenant
 */
async function updateTenant(tenantId, updates) {
    const allowedFields = ['name', 'domain', 'settings', 'subscription_plan', 'subscription_status'];
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (allowedFields.includes(dbKey)) {
            setClause.push(`${dbKey} = ?`);
            values.push(key === 'settings' ? JSON.stringify(value) : value);
        }
    }

    if (setClause.length === 0) {
        return getTenant(tenantId);
    }

    values.push(tenantId);
    await db.execute(
        `UPDATE tenants SET ${setClause.join(', ')}, updated_at = NOW() WHERE tenant_id = ?`,
        values
    );

    // Invalidate cache
    tenantCache.delete(tenantId);

    return getTenant(tenantId);
}

/**
 * Check if tenant subscription is active
 * @param {string} tenantId - Tenant identifier
 * @returns {Promise<Object>} Subscription status
 */
async function checkSubscription(tenantId) {
    const tenant = await getTenant(tenantId);
    
    if (!tenant) {
        return { valid: false, reason: 'Tenant not found' };
    }

    const now = new Date();

    // Check if trial has expired
    if (tenant.subscription_status === 'trial') {
        const trialEnd = new Date(tenant.trial_ends_at);
        if (now > trialEnd) {
            return {
                valid: false,
                reason: 'Trial expired',
                expiredAt: tenant.trial_ends_at,
            };
        }
        return {
            valid: true,
            status: 'trial',
            expiresAt: tenant.trial_ends_at,
            daysRemaining: Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24)),
        };
    }

    // Check subscription status
    if (['suspended', 'cancelled'].includes(tenant.subscription_status)) {
        return {
            valid: false,
            reason: `Subscription ${tenant.subscription_status}`,
        };
    }

    return {
        valid: true,
        status: tenant.subscription_status,
        plan: tenant.subscription_plan,
    };
}

/**
 * Get all active tenants
 * @returns {Promise<Array>} List of tenants
 */
async function getAllTenants() {
    try {
        return await db.query('SELECT * FROM tenants ORDER BY created_at DESC');
    } catch (error) {
        console.error('Error fetching tenants:', error.message);
        return [];
    }
}

/**
 * Express middleware to extract and validate tenant
 */
function tenantMiddleware() {
    return async (req, res, next) => {
        // Skip if multi-tenancy is disabled
        if (!env.multiTenant.enabled) {
            req.tenantId = env.multiTenant.defaultTenantId;
            return next();
        }

        // Extract tenant ID from various sources
        let tenantId = null;

        // 1. From subdomain (e.g., acme.hrapp.com)
        const host = req.get('host');
        if (host) {
            const subdomain = host.split('.')[0];
            if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
                tenantId = subdomain;
            }
        }

        // 2. From header (X-Tenant-ID)
        if (!tenantId && req.headers['x-tenant-id']) {
            tenantId = req.headers['x-tenant-id'];
        }

        // 3. From query parameter (for testing)
        if (!tenantId && req.query.tenant && env.isDevelopment) {
            tenantId = req.query.tenant;
        }

        // 4. From authenticated user's tenant
        if (!tenantId && req.user?.tenantId) {
            tenantId = req.user.tenantId;
        }

        // Default tenant if none found
        tenantId = tenantId || env.multiTenant.defaultTenantId;

        // Validate tenant
        const tenant = await getTenant(tenantId);
        if (!tenant) {
            return res.status(404).json({
                success: false,
                error: 'Tenant not found',
                code: 'TENANT_NOT_FOUND',
            });
        }

        // Check subscription
        const subscription = await checkSubscription(tenantId);
        if (!subscription.valid) {
            return res.status(403).json({
                success: false,
                error: 'Subscription inactive',
                code: 'SUBSCRIPTION_INACTIVE',
                reason: subscription.reason,
            });
        }

        // Attach tenant info to request
        req.tenantId = tenantId;
        req.tenant = tenant;
        req.subscription = subscription;

        next();
    };
}

/**
 * Helper to add tenant filter to queries
 * @param {string} tenantId - Tenant identifier
 * @returns {string} WHERE clause addition
 */
function tenantFilter(tenantId) {
    if (!env.multiTenant.enabled) {
        return '';
    }
    return `AND tenant_id = '${tenantId}'`;
}

/**
 * Get tenant-specific statistics
 * @param {string} tenantId - Tenant identifier
 * @returns {Promise<Object>} Tenant statistics
 */
async function getTenantStats(tenantId) {
    try {
        const [users, employees, leaves] = await Promise.all([
            db.getOne('SELECT COUNT(*) as count FROM users WHERE tenant_id = ?', [tenantId]),
            db.getOne('SELECT COUNT(*) as count FROM employees WHERE tenant_id = ?', [tenantId]),
            db.getOne('SELECT COUNT(*) as count FROM leave_requests WHERE tenant_id = ?', [tenantId]),
        ]);

        return {
            users: users?.count || 0,
            employees: employees?.count || 0,
            leaveRequests: leaves?.count || 0,
        };
    } catch (error) {
        return { users: 0, employees: 0, leaveRequests: 0 };
    }
}

module.exports = {
    getTenant,
    getTenantByDomain,
    createTenant,
    updateTenant,
    checkSubscription,
    getAllTenants,
    getTenantStats,
    tenantMiddleware,
    tenantFilter,
};
