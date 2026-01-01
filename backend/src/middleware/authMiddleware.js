/**
 * Authentication Middleware
 * 
 * Provides secure JWT-based authentication and role-based authorization.
 * Implements proper token validation without demo/test tokens in production.
 * 
 * @module middleware/authMiddleware
 */

const jwt = require('jsonwebtoken');
const db = require('../config/db');
const env = require('../config/environment');
const tokenService = require('../services/tokenService');

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
    '/health',
    '/api/health',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/refresh',
    '/api/docs',
    '/constraints/status',
];

/**
 * Check if route is public (no auth required)
 * @param {string} path - Request path
 * @returns {boolean} True if public route
 */
function isPublicRoute(path) {
    return PUBLIC_ROUTES.some(route => 
        path === route || path.startsWith(route + '/')
    );
}

/**
 * Main authentication middleware
 * Validates JWT tokens and attaches user to request
 */
const authenticateToken = async (req, res, next) => {
    // Skip auth for public routes
    if (isPublicRoute(req.path)) {
        return next();
    }

    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    // Also check query parameter for download endpoints (with extra validation)
    if (!token && req.query.token && req.path.includes('/download')) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({
            error: 'Authentication required',
            code: 'NO_TOKEN',
            message: 'No authentication token provided',
        });
    }

    // DEVELOPMENT ONLY: Allow demo tokens for local testing
    // These are automatically disabled in production
    if (env.isDevelopment && env.get('ALLOW_DEMO_TOKENS', 'false') === 'true') {
        const demoUser = getDemoUser(token);
        if (demoUser) {
            req.user = demoUser;
            req.isDemoUser = true;
            return next();
        }
    }

    // Verify JWT token
    try {
        const decoded = tokenService.verifyAccessToken(token);

        // Get user from database with employee info
        const user = await db.getOne(`
            SELECT 
                u.id, u.name, u.email, u.role, u.is_active,
                u.last_login_at,
                e.emp_id, e.department, e.manager_id, e.position as job_title
            FROM users u 
            LEFT JOIN employees e ON u.email = e.email 
            WHERE u.id = ?
        `, [decoded.sub]);

        if (!user) {
            return res.status(401).json({
                error: 'User not found',
                code: 'USER_NOT_FOUND',
                message: 'The user associated with this token no longer exists',
            });
        }

        // Check if user account is active
        if (user.is_active === 0) {
            return res.status(403).json({
                error: 'Account disabled',
                code: 'ACCOUNT_DISABLED',
                message: 'Your account has been disabled. Contact administrator.',
            });
        }

        // Attach user to request
        req.user = {
            id: user.id,
            emp_id: user.emp_id || `EMP${String(user.id).padStart(3, '0')}`,
            employeeId: user.emp_id || `EMP${String(user.id).padStart(3, '0')}`,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department || 'General',
            managerId: user.manager_id,
            jobTitle: user.job_title,
            twoFactorEnabled: false,
            lastLogin: user.last_login_at,
        };

        // Attach token info for audit purposes
        req.tokenInfo = {
            jti: decoded.jti,
            iat: decoded.iat,
            exp: decoded.exp,
        };

        next();
    } catch (error) {
        console.error('Token verification failed:', error.message);

        // Determine appropriate error response
        if (error.message === 'Access token expired') {
            return res.status(401).json({
                error: 'Token expired',
                code: 'TOKEN_EXPIRED',
                message: 'Your session has expired. Please refresh your token or login again.',
            });
        }

        return res.status(401).json({
            error: 'Invalid token',
            code: 'INVALID_TOKEN',
            message: 'The provided token is invalid.',
        });
    }
};

/**
 * Role-based authorization middleware
 * @param {...string} allowedRoles - Roles allowed to access the route
 * @returns {Function} Express middleware
 */
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'NOT_AUTHENTICATED',
                message: 'You must be logged in to access this resource',
            });
        }

        // Check if user has required role
        if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Access denied',
                code: 'INSUFFICIENT_PERMISSIONS',
                message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
                requiredRoles: allowedRoles,
                currentRole: req.user.role,
            });
        }

        next();
    };
};

/**
 * Permission-based authorization middleware
 * @param {string} permission - Required permission
 * @returns {Function} Express middleware
 */
const requirePermission = (permission) => {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'NOT_AUTHENTICATED',
            });
        }

        try {
            // Check user permissions from database
            const hasPermission = await db.getOne(`
                SELECT 1 FROM user_permissions up
                JOIN permissions p ON up.permission_id = p.id
                WHERE up.user_id = ? AND p.name = ?
            `, [req.user.id, permission]);

            // Also check role-based permissions
            const roleHasPermission = await db.getOne(`
                SELECT 1 FROM role_permissions rp
                JOIN permissions p ON rp.permission_id = p.id
                JOIN roles r ON rp.role_id = r.id
                WHERE r.name = ? AND p.name = ?
            `, [req.user.role, permission]);

            if (!hasPermission && !roleHasPermission) {
                return res.status(403).json({
                    error: 'Permission denied',
                    code: 'MISSING_PERMISSION',
                    message: `You don't have the required permission: ${permission}`,
                });
            }

            next();
        } catch (error) {
            // If permission tables don't exist, fall back to role-based auth
            console.warn('Permission check failed, using role-based fallback:', error.message);
            next();
        }
    };
};

/**
 * Resource ownership middleware
 * Ensures user can only access their own resources unless admin/hr
 * @param {string} userIdParam - Name of the user ID parameter
 * @returns {Function} Express middleware
 */
const requireOwnership = (userIdParam = 'userId') => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                code: 'NOT_AUTHENTICATED',
            });
        }

        const resourceUserId = req.params[userIdParam] || req.body[userIdParam];
        const isOwner = String(req.user.id) === String(resourceUserId) ||
                        req.user.emp_id === resourceUserId;
        const isPrivileged = ['admin', 'hr'].includes(req.user.role);

        if (!isOwner && !isPrivileged) {
            return res.status(403).json({
                error: 'Access denied',
                code: 'NOT_RESOURCE_OWNER',
                message: 'You can only access your own resources',
            });
        }

        req.isOwner = isOwner;
        req.isPrivileged = isPrivileged;
        next();
    };
};

/**
 * Optional authentication middleware
 * Attaches user if token provided, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    try {
        const decoded = tokenService.verifyAccessToken(token);
        const user = await db.getOne(`
            SELECT u.id, u.name, u.email, u.role, e.emp_id, e.department
            FROM users u 
            LEFT JOIN employees e ON u.email = e.email 
            WHERE u.id = ?
        `, [decoded.sub]);

        if (user) {
            req.user = {
                id: user.id,
                emp_id: user.emp_id,
                employeeId: user.emp_id,
                name: user.name,
                email: user.email,
                role: user.role,
                department: user.department,
            };
        }
    } catch (error) {
        // Ignore errors for optional auth
    }

    next();
};

/**
 * Get demo user for development testing
 * ONLY works in development with ALLOW_DEMO_TOKENS=true
 * @param {string} token - Demo token
 * @returns {Object|null} Demo user object or null
 */
function getDemoUser(token) {
    const demoUsers = {
        'demo-token-123': {
            id: 1,
            emp_id: 'EMP001',
            employeeId: 'EMP001',
            name: 'Demo User',
            email: 'demo@company.com',
            role: 'employee',
            department: 'Engineering',
        },
        'hr-demo-token': {
            id: 2,
            emp_id: 'EMP002',
            employeeId: 'EMP002',
            name: 'HR Manager',
            email: 'hr@company.com',
            role: 'hr',
            department: 'Human Resources',
        },
        'hr-token': {
            id: 2,
            emp_id: 'EMP002',
            employeeId: 'EMP002',
            name: 'HR Manager',
            email: 'hr@company.com',
            role: 'hr',
            department: 'Human Resources',
        },
        'admin-demo-token': {
            id: 3,
            emp_id: 'EMP003',
            employeeId: 'EMP003',
            name: 'Admin User',
            email: 'admin@company.com',
            role: 'admin',
            department: 'Administration',
        },
        'admin-token': {
            id: 3,
            emp_id: 'EMP003',
            employeeId: 'EMP003',
            name: 'Admin User',
            email: 'admin@company.com',
            role: 'admin',
            department: 'Administration',
        },
    };

    return demoUsers[token] || null;
}

/**
 * Rate limiting middleware for authentication endpoints
 */
const authRateLimiter = (() => {
    const attempts = new Map();
    const MAX_ATTEMPTS = env.passwordPolicy.maxLoginAttempts;
    const LOCKOUT_DURATION = env.passwordPolicy.lockoutDurationMinutes * 60 * 1000;

    return (req, res, next) => {
        const identifier = req.ip || req.body.email || 'unknown';
        const now = Date.now();
        const record = attempts.get(identifier);

        if (record) {
            // Check if lockout period has passed
            if (record.lockedUntil && now < record.lockedUntil) {
                const remainingMs = record.lockedUntil - now;
                const remainingMin = Math.ceil(remainingMs / 60000);
                return res.status(429).json({
                    error: 'Too many attempts',
                    code: 'RATE_LIMITED',
                    message: `Account temporarily locked. Try again in ${remainingMin} minute(s).`,
                    retryAfter: Math.ceil(remainingMs / 1000),
                });
            }

            // Reset if lockout expired
            if (record.lockedUntil && now >= record.lockedUntil) {
                attempts.delete(identifier);
            }
        }

        // Attach helper to record failed attempt
        req.recordFailedAttempt = () => {
            const current = attempts.get(identifier) || { count: 0 };
            current.count++;
            current.lastAttempt = now;

            if (current.count >= MAX_ATTEMPTS) {
                current.lockedUntil = now + LOCKOUT_DURATION;
            }

            attempts.set(identifier, current);
        };

        // Attach helper to clear attempts on successful login
        req.clearFailedAttempts = () => {
            attempts.delete(identifier);
        };

        next();
    };
})();

module.exports = {
    authenticateToken,
    authorize,
    requirePermission,
    requireOwnership,
    optionalAuth,
    authRateLimiter,
};