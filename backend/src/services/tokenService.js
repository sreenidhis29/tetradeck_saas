/**
 * JWT Token Service
 * 
 * Handles secure token generation, validation, and refresh.
 * Implements proper JWT best practices with access and refresh tokens.
 * 
 * @module services/tokenService
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const env = require('../config/environment');

// Token configuration
const ACCESS_TOKEN_EXPIRY = env.security.jwtAccessExpiry;
const REFRESH_TOKEN_EXPIRY = env.security.jwtRefreshExpiry;

/**
 * Generate a cryptographically secure token ID
 * @returns {string} Unique token identifier
 */
function generateTokenId() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate access token
 * @param {Object} user - User object with id, role, email
 * @returns {Object} Token object with token and expiresAt
 */
function generateAccessToken(user) {
    const tokenId = generateTokenId();
    const payload = {
        jti: tokenId,
        sub: user.id,
        role: user.role,
        email: user.email,
        type: 'access',
    };

    const token = jwt.sign(payload, env.security.jwtSecret, {
        expiresIn: ACCESS_TOKEN_EXPIRY,
        issuer: 'company-hr-system',
        audience: 'company-hr-api',
    });

    // Decode to get actual expiry time
    const decoded = jwt.decode(token);

    return {
        token,
        tokenId,
        expiresAt: new Date(decoded.exp * 1000),
        expiresIn: ACCESS_TOKEN_EXPIRY,
    };
}

/**
 * Generate refresh token
 * @param {Object} user - User object with id
 * @param {string} deviceInfo - Optional device/client info
 * @returns {Promise<Object>} Refresh token object
 */
async function generateRefreshToken(user, deviceInfo = 'unknown') {
    const tokenId = generateTokenId();
    const payload = {
        jti: tokenId,
        sub: user.id,
        type: 'refresh',
    };

    const token = jwt.sign(payload, env.security.jwtRefreshSecret, {
        expiresIn: REFRESH_TOKEN_EXPIRY,
        issuer: 'company-hr-system',
        audience: 'company-hr-api',
    });

    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000);

    // Store refresh token in database for revocation capability
    try {
        await db.execute(`
            INSERT INTO refresh_tokens (
                token_id, user_id, device_info, expires_at, created_at
            ) VALUES (?, ?, ?, ?, NOW())
        `, [tokenId, user.id, deviceInfo, expiresAt]);
    } catch (error) {
        // Table might not exist yet - log but don't fail
        console.warn('Could not store refresh token - table may not exist:', error.message);
    }

    return {
        token,
        tokenId,
        expiresAt,
        expiresIn: REFRESH_TOKEN_EXPIRY,
    };
}

/**
 * Verify access token
 * @param {string} token - JWT access token
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
function verifyAccessToken(token) {
    try {
        const decoded = jwt.verify(token, env.security.jwtSecret, {
            issuer: 'company-hr-system',
            audience: 'company-hr-api',
        });

        if (decoded.type !== 'access') {
            throw new Error('Invalid token type');
        }

        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Access token expired');
        }
        if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid access token');
        }
        throw error;
    }
}

/**
 * Verify refresh token
 * @param {string} token - JWT refresh token
 * @returns {Promise<Object>} Decoded token payload
 * @throws {Error} If token is invalid, expired, or revoked
 */
async function verifyRefreshToken(token) {
    try {
        const decoded = jwt.verify(token, env.security.jwtRefreshSecret, {
            issuer: 'company-hr-system',
            audience: 'company-hr-api',
        });

        if (decoded.type !== 'refresh') {
            throw new Error('Invalid token type');
        }

        // Check if token has been revoked
        try {
            const storedToken = await db.getOne(`
                SELECT * FROM refresh_tokens 
                WHERE token_id = ? AND user_id = ? AND revoked = 0
            `, [decoded.jti, decoded.sub]);

            if (!storedToken) {
                throw new Error('Refresh token has been revoked');
            }
        } catch (dbError) {
            // If table doesn't exist, allow the token (for backwards compatibility)
            if (!dbError.message.includes("doesn't exist")) {
                throw dbError;
            }
        }

        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Refresh token expired');
        }
        if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid refresh token');
        }
        throw error;
    }
}

/**
 * Refresh tokens - generate new access and refresh tokens
 * @param {string} refreshToken - Current refresh token
 * @returns {Promise<Object>} New token pair
 */
async function refreshTokens(refreshToken) {
    const decoded = await verifyRefreshToken(refreshToken);

    // Get user from database
    const user = await db.getOne('SELECT id, email, role FROM users WHERE id = ?', [decoded.sub]);
    if (!user) {
        throw new Error('User not found');
    }

    // Revoke old refresh token
    try {
        await db.execute(`
            UPDATE refresh_tokens SET revoked = 1, revoked_at = NOW() 
            WHERE token_id = ?
        `, [decoded.jti]);
    } catch (error) {
        // Ignore if table doesn't exist
    }

    // Generate new tokens
    const accessToken = generateAccessToken(user);
    const newRefreshToken = await generateRefreshToken(user);

    return {
        accessToken,
        refreshToken: newRefreshToken,
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
        },
    };
}

/**
 * Revoke a specific refresh token
 * @param {string} tokenId - Token ID to revoke
 * @returns {Promise<boolean>} Success status
 */
async function revokeRefreshToken(tokenId) {
    try {
        const result = await db.execute(`
            UPDATE refresh_tokens SET revoked = 1, revoked_at = NOW() 
            WHERE token_id = ?
        `, [tokenId]);
        return result.affectedRows > 0;
    } catch (error) {
        console.warn('Could not revoke token:', error.message);
        return false;
    }
}

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 * @param {number} userId - User ID
 * @returns {Promise<number>} Number of tokens revoked
 */
async function revokeAllUserTokens(userId) {
    try {
        const result = await db.execute(`
            UPDATE refresh_tokens SET revoked = 1, revoked_at = NOW() 
            WHERE user_id = ? AND revoked = 0
        `, [userId]);
        return result.affectedRows;
    } catch (error) {
        console.warn('Could not revoke user tokens:', error.message);
        return 0;
    }
}

/**
 * Get active sessions for a user
 * @param {number} userId - User ID
 * @returns {Promise<Array>} List of active sessions
 */
async function getUserSessions(userId) {
    try {
        return await db.query(`
            SELECT token_id, device_info, created_at, expires_at 
            FROM refresh_tokens 
            WHERE user_id = ? AND revoked = 0 AND expires_at > NOW()
            ORDER BY created_at DESC
        `, [userId]);
    } catch (error) {
        return [];
    }
}

/**
 * Clean up expired tokens from database
 * @returns {Promise<number>} Number of tokens cleaned
 */
async function cleanupExpiredTokens() {
    try {
        const result = await db.execute(`
            DELETE FROM refresh_tokens 
            WHERE expires_at < NOW() OR (revoked = 1 AND revoked_at < DATE_SUB(NOW(), INTERVAL 30 DAY))
        `);
        return result.affectedRows;
    } catch (error) {
        console.warn('Could not cleanup tokens:', error.message);
        return 0;
    }
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    refreshTokens,
    revokeRefreshToken,
    revokeAllUserTokens,
    getUserSessions,
    cleanupExpiredTokens,
};
