// Authentication middleware with JWT support
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const authenticateToken = async (req, res, next) => {
    // Get token from header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // Skip auth for health endpoints
    if (req.path === '/health' || req.path === '/constraints/status') {
        return next();
    }

    if (!token) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'No token provided'
        });
    }

    // Demo token for testing
    if (token === 'demo-token-123') {
        req.user = {
            id: 1,
            emp_id: 'EMP001',
            employeeId: 'EMP001',
            name: 'Demo User',
            role: 'employee',
            department: 'Engineering'
        };
        return next();
    }

    // Verify JWT token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key_change_me');
        
        // Get user from database
        const users = await db.query('SELECT u.*, e.emp_id, e.department FROM users u LEFT JOIN employees e ON u.email = e.email WHERE u.id = ?', [decoded.id]);
        
        if (!users || users.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        const user = users[0];
        req.user = {
            id: user.id,
            emp_id: user.emp_id || 'EMP001',
            employeeId: user.emp_id || 'EMP001',
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department || 'Engineering'
        };
        next();
    } catch (error) {
        console.error('Token verification failed:', error.message);
        return res.status(401).json({
            error: 'Invalid token',
            message: 'Token expired or invalid'
        });
    }
};

// Role-based authorization
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        if (allowedRoles.includes(req.user.role)) {
            next();
        } else {
            res.status(403).json({
                error: 'Forbidden',
                message: `Requires roles: ${allowedRoles.join(', ')}`
            });
        }
    };
};

module.exports = {
    authenticateToken,
    authorize
};