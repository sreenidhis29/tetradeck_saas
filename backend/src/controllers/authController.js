/**
 * Authentication Controller
 * 
 * Handles user authentication with secure JWT tokens,
 * password hashing, and session management.
 * 
 * @module controllers/authController
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/db');
const env = require('../config/environment');
const tokenService = require('../services/tokenService');
const auditService = require('../services/auditService');

/**
 * User login - generates access and refresh tokens
 */
exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Validation error',
            message: 'Please provide email and password',
        });
    }

    try {
        // Find user by email
        const user = await db.getOne('SELECT * FROM users WHERE email = ?', [email]);

        if (!user) {
            // Record failed attempt for rate limiting
            if (req.recordFailedAttempt) req.recordFailedAttempt();
            
            // Log failed login attempt
            await auditService.log({
                action: 'LOGIN_FAILED',
                category: 'authentication',
                details: { email, reason: 'User not found' },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
            });

            return res.status(401).json({
                success: false,
                error: 'Authentication failed',
                message: 'Invalid email or password',
            });
        }

        // Check if user is active
        if (user.is_active === 0) {
            await auditService.log({
                action: 'LOGIN_BLOCKED',
                userId: user.id,
                category: 'authentication',
                details: { reason: 'Account inactive' },
                ipAddress: req.ip,
            });

            return res.status(403).json({
                success: false,
                error: 'Account disabled',
                message: 'Your account has been disabled. Please contact an administrator.',
            });
        }

        // Verify password
        let isMatch = await bcrypt.compare(password, user.password);
        
        // Handle Laravel's $2y$ hash format
        if (!isMatch && user.password.startsWith('$2y$')) {
            const phpHash = user.password.replace(/^\$2y(.+)$/i, '$2a$1');
            isMatch = await bcrypt.compare(password, phpHash);
        }

        if (!isMatch) {
            if (req.recordFailedAttempt) req.recordFailedAttempt();
            
            await auditService.log({
                action: 'LOGIN_FAILED',
                userId: user.id,
                category: 'authentication',
                details: { reason: 'Invalid password' },
                ipAddress: req.ip,
            });

            return res.status(401).json({
                success: false,
                error: 'Authentication failed',
                message: 'Invalid email or password',
            });
        }

        // Clear failed attempts on successful login
        if (req.clearFailedAttempts) req.clearFailedAttempts();

        // Check 2FA if enabled
        if (user.two_factor_enabled && user.two_factor_secret) {
            // Return partial response requiring 2FA
            const tempToken = jwt.sign(
                { sub: user.id, purpose: '2fa_verification' },
                env.security.jwtSecret,
                { expiresIn: '5m' }
            );

            return res.json({
                success: true,
                requiresTwoFactor: true,
                tempToken,
                message: 'Please provide your two-factor authentication code',
            });
        }

        // Generate tokens
        const accessToken = tokenService.generateAccessToken(user);
        const refreshToken = await tokenService.generateRefreshToken(
            user,
            req.get('User-Agent') || 'unknown'
        );

        // Update last login
        await db.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

        // Log successful login
        await auditService.log({
            action: 'LOGIN_SUCCESS',
            userId: user.id,
            category: 'authentication',
            details: { method: 'password' },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
        });

        // Get employee info if available
        const employee = await db.getOne(
            'SELECT emp_id, department, position as job_title FROM employees WHERE email = ?',
            [user.email]
        );

        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                empId: employee?.emp_id,
                department: employee?.department,
                jobTitle: employee?.job_title,
            },
            accessToken: accessToken.token,
            refreshToken: refreshToken.token,
            expiresAt: accessToken.expiresAt,
            tokenType: 'Bearer',
        });
    } catch (error) {
        console.error('Login error:', error);
        
        await auditService.log({
            action: 'LOGIN_ERROR',
            category: 'authentication',
            details: { error: error.message },
            severity: 'error',
        });

        res.status(500).json({
            success: false,
            error: 'Server error',
            message: 'An error occurred during authentication',
        });
    }
};

/**
 * Refresh access token using refresh token
 */
exports.refreshToken = async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(400).json({
            success: false,
            error: 'Validation error',
            message: 'Refresh token is required',
        });
    }

    try {
        const tokens = await tokenService.refreshTokens(refreshToken);

        await auditService.log({
            action: 'TOKEN_REFRESHED',
            userId: tokens.user.id,
            category: 'authentication',
            ipAddress: req.ip,
        });

        res.json({
            success: true,
            accessToken: tokens.accessToken.token,
            refreshToken: tokens.refreshToken.token,
            expiresAt: tokens.accessToken.expiresAt,
            tokenType: 'Bearer',
        });
    } catch (error) {
        console.error('Token refresh error:', error.message);

        res.status(401).json({
            success: false,
            error: 'Token refresh failed',
            message: error.message,
        });
    }
};

/**
 * Logout - revoke refresh token
 */
exports.logout = async (req, res) => {
    const { refreshToken } = req.body;

    try {
        if (refreshToken) {
            // Decode and revoke the specific refresh token
            const decoded = jwt.decode(refreshToken);
            if (decoded?.jti) {
                await tokenService.revokeRefreshToken(decoded.jti);
            }
        }

        await auditService.log({
            action: 'LOGOUT',
            userId: req.user?.id,
            category: 'authentication',
            ipAddress: req.ip,
        });

        res.json({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.json({
            success: true,
            message: 'Logged out',
        });
    }
};

/**
 * Logout from all devices - revoke all refresh tokens
 */
exports.logoutAll = async (req, res) => {
    try {
        const count = await tokenService.revokeAllUserTokens(req.user.id);

        await auditService.log({
            action: 'LOGOUT_ALL_DEVICES',
            userId: req.user.id,
            category: 'authentication',
            details: { sessionsRevoked: count },
            ipAddress: req.ip,
        });

        res.json({
            success: true,
            message: `Logged out from ${count} device(s)`,
            sessionsRevoked: count,
        });
    } catch (error) {
        console.error('Logout all error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: 'Failed to logout from all devices',
        });
    }
};

/**
 * Get current user profile
 */
exports.getMe = async (req, res) => {
    try {
        const user = await db.getOne(`
            SELECT 
                u.id, u.name, u.email, u.role, u.created_at, u.last_login_at,
                e.emp_id, e.department, e.position as job_title, e.manager_id, e.hire_date
            FROM users u 
            LEFT JOIN employees e ON u.email = e.email 
            WHERE u.id = ?
        `, [req.user.id]);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Not found',
                message: 'User not found',
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                empId: user.emp_id,
                department: user.department,
                jobTitle: user.job_title,
                managerId: user.manager_id,
                hireDate: user.hire_date,
                createdAt: user.created_at,
                lastLogin: user.last_login_at,
                twoFactorEnabled: false,
            },
        });
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: 'Failed to retrieve user profile',
        });
    }
};

/**
 * Get active sessions for current user
 */
exports.getSessions = async (req, res) => {
    try {
        const sessions = await tokenService.getUserSessions(req.user.id);

        res.json({
            success: true,
            sessions: sessions.map(s => ({
                id: s.token_id,
                device: s.device_info,
                createdAt: s.created_at,
                expiresAt: s.expires_at,
            })),
        });
    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: 'Failed to retrieve sessions',
        });
    }
};

/**
 * Revoke a specific session
 */
exports.revokeSession = async (req, res) => {
    const { sessionId } = req.params;

    try {
        const revoked = await tokenService.revokeRefreshToken(sessionId);

        if (!revoked) {
            return res.status(404).json({
                success: false,
                error: 'Not found',
                message: 'Session not found or already revoked',
            });
        }

        await auditService.log({
            action: 'SESSION_REVOKED',
            userId: req.user.id,
            category: 'authentication',
            details: { sessionId },
            ipAddress: req.ip,
        });

        res.json({
            success: true,
            message: 'Session revoked successfully',
        });
    } catch (error) {
        console.error('Revoke session error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: 'Failed to revoke session',
        });
    }
};

/**
 * Change password
 */
exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({
            success: false,
            error: 'Validation error',
            message: 'Current password and new password are required',
        });
    }

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
        return res.status(400).json({
            success: false,
            error: 'Weak password',
            message: passwordValidation.message,
            requirements: passwordValidation.requirements,
        });
    }

    try {
        const user = await db.getOne('SELECT password FROM users WHERE id = ?', [req.user.id]);

        // Verify current password
        let isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch && user.password.startsWith('$2y$')) {
            const phpHash = user.password.replace(/^\$2y(.+)$/i, '$2a$1');
            isMatch = await bcrypt.compare(currentPassword, phpHash);
        }

        if (!isMatch) {
            await auditService.log({
                action: 'PASSWORD_CHANGE_FAILED',
                userId: req.user.id,
                category: 'authentication',
                details: { reason: 'Invalid current password' },
                ipAddress: req.ip,
            });

            return res.status(401).json({
                success: false,
                error: 'Authentication failed',
                message: 'Current password is incorrect',
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        await db.execute('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [
            hashedPassword,
            req.user.id,
        ]);

        // Revoke all refresh tokens to force re-login
        await tokenService.revokeAllUserTokens(req.user.id);

        await auditService.log({
            action: 'PASSWORD_CHANGED',
            userId: req.user.id,
            category: 'authentication',
            ipAddress: req.ip,
        });

        res.json({
            success: true,
            message: 'Password changed successfully. Please login again.',
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: 'Failed to change password',
        });
    }
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result
 */
function validatePassword(password) {
    const requirements = {
        minLength: env.passwordPolicy.minLength,
        requireUppercase: env.passwordPolicy.requireUppercase,
        requireNumber: env.passwordPolicy.requireNumber,
        requireSpecial: env.passwordPolicy.requireSpecial,
    };

    const errors = [];

    if (password.length < requirements.minLength) {
        errors.push(`Password must be at least ${requirements.minLength} characters`);
    }
    if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (requirements.requireNumber && !/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (requirements.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    return {
        valid: errors.length === 0,
        message: errors.join('. '),
        requirements,
    };
}
