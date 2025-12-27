const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/authMiddleware');
const db = require('../config/db');

// Get all users (HR/Admin only)
router.get('/all', authenticateToken, authorize('hr', 'admin'), async (req, res) => {
    try {
        const users = await db.query(`
            SELECT id, name, email, role, is_active, created_at, last_login_at 
            FROM users 
            ORDER BY created_at DESC
        `);
        res.json(users || []);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single user
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const users = await db.query('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?', [req.params.id]);
        if (!users || users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(users[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user status (Admin only)
router.patch('/:id/status', authenticateToken, authorize('admin'), async (req, res) => {
    try {
        const { is_active } = req.body;
        await db.execute('UPDATE users SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, req.params.id]);
        res.json({ success: true, message: 'User status updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user role (Admin only)
router.patch('/:id/role', authenticateToken, authorize('admin'), async (req, res) => {
    try {
        const { role } = req.body;
        if (!['employee', 'hr', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        await db.execute('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
        res.json({ success: true, message: 'User role updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
