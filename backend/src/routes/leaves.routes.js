const express = require('express');
const router = express.Router();
const leavesController = require('../controllers/leaves.controller');
const { authenticateToken } = require('../middleware/authMiddleware');
const db = require('../config/db');

// Main constraint-based analysis endpoint
router.post('/analyze', authenticateToken, leavesController.analyzeLeaveRequest);

// Get my leave requests - from token (for employee panel)
router.get('/my-leaves', authenticateToken, async (req, res) => {
    try {
        // Get employee ID from authenticated user
        const empId = req.user?.emp_id || req.user?.employeeId || req.user?.id;
        if (!empId) {
            return res.status(400).json({ success: false, error: 'Employee ID not found in token' });
        }
        const leaves = await db.execute(`
            SELECT * FROM leave_requests 
            WHERE emp_id = ? 
            ORDER BY created_at DESC
        `, [empId]);
        res.json({ success: true, leaves: leaves || [] });
    } catch (error) {
        console.error('Error fetching leaves:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get my leave requests with explicit empId (legacy support)
router.get('/my-leaves/:empId', authenticateToken, async (req, res) => {
    try {
        const leaves = await db.execute(`
            SELECT * FROM leave_requests 
            WHERE emp_id = ? 
            ORDER BY created_at DESC
        `, [req.params.empId]);
        res.json({ success: true, leaves: leaves || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get leave balance (for employee panel)
router.get('/balance/:empId', authenticateToken, async (req, res) => {
    try {
        const [balances] = await db.execute(`
            SELECT * FROM leave_balances WHERE emp_id = ?
        `, [req.params.empId]);
        res.json({ success: true, balances });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get pending requests (for HR/Manager panel)
router.get('/pending', authenticateToken, async (req, res) => {
    try {
        const [pending] = await db.execute(`
            SELECT lr.*, 
                   e.full_name as employee_name,
                   e.department,
                   t.team_name
            FROM leave_requests lr
            JOIN employees e ON lr.emp_id = e.emp_id
            LEFT JOIN team_members tm ON e.emp_id = tm.emp_id
            LEFT JOIN teams t ON tm.team_id = t.team_id
            WHERE lr.status = 'pending'
            ORDER BY lr.created_at DESC
        `);
        res.json({ success: true, requests: pending });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Approve leave request (HR/Manager)
router.post('/approve/:requestId', authenticateToken, async (req, res) => {
    try {
        const { requestId } = req.params;
        const { approvedBy } = req.body;
        
        // Get request details first
        const [[request]] = await db.execute(
            'SELECT emp_id, leave_type, total_days FROM leave_requests WHERE request_id = ?',
            [requestId]
        );
        
        if (!request) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }
        
        // Update request status
        await db.execute(`
            UPDATE leave_requests 
            SET status = 'approved', approved_by = ?, approval_date = CURDATE()
            WHERE request_id = ?
        `, [approvedBy || 'HR', requestId]);
        
        // Deduct from balance
        await db.execute(`
            UPDATE leave_balances 
            SET used_so_far = used_so_far + ?
            WHERE emp_id = ? AND leave_type = ?
        `, [request.total_days, request.emp_id, request.leave_type]);
        
        res.json({ success: true, message: 'Leave approved successfully' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reject leave request (HR/Manager)
router.post('/reject/:requestId', authenticateToken, async (req, res) => {
    try {
        const { requestId } = req.params;
        const { reason } = req.body;
        
        await db.execute(`
            UPDATE leave_requests SET status = 'rejected' WHERE request_id = ?
        `, [requestId]);
        
        res.json({ success: true, message: 'Leave rejected' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get team status (for Manager dashboard)
router.get('/team-status/:teamId', authenticateToken, async (req, res) => {
    try {
        const { teamId } = req.params;
        const checkDate = req.query.date || new Date().toISOString().split('T')[0];
        
        // Get team info
        const [[team]] = await db.execute('SELECT * FROM teams WHERE team_id = ?', [teamId]);
        
        // Get team members
        const [members] = await db.execute(`
            SELECT e.emp_id, e.full_name, e.position
            FROM team_members tm
            JOIN employees e ON tm.emp_id = e.emp_id
            WHERE tm.team_id = ?
        `, [teamId]);
        
        // Get members on leave
        const [onLeave] = await db.execute(`
            SELECT e.emp_id, e.full_name, lr.leave_type, lr.start_date, lr.end_date
            FROM leave_requests lr
            JOIN employees e ON lr.emp_id = e.emp_id
            JOIN team_members tm ON e.emp_id = tm.emp_id
            WHERE tm.team_id = ?
            AND lr.status = 'approved'
            AND ? BETWEEN lr.start_date AND lr.end_date
        `, [teamId, checkDate]);
        
        const onLeaveIds = onLeave.map(m => m.emp_id);
        const present = members.filter(m => !onLeaveIds.includes(m.emp_id));
        
        res.json({
            success: true,
            team: team,
            date: checkDate,
            summary: {
                total: members.length,
                present: present.length,
                onLeave: onLeave.length,
                coveragePercent: Math.round((present.length / members.length) * 100)
            },
            members: { present, onLeave }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all leaves (for HR dashboard)
router.get('/all', authenticateToken, async (req, res) => {
    try {
        const { status, department, startDate, endDate } = req.query;
        let query = `
            SELECT lr.*, 
                   e.full_name as employee_name,
                   e.department,
                   t.team_name
            FROM leave_requests lr
            JOIN employees e ON lr.emp_id = e.emp_id
            LEFT JOIN team_members tm ON e.emp_id = tm.emp_id
            LEFT JOIN teams t ON tm.team_id = t.team_id
            WHERE 1=1
        `;
        const params = [];
        
        if (status) {
            query += ' AND lr.status = ?';
            params.push(status);
        }
        if (department) {
            query += ' AND e.department = ?';
            params.push(department);
        }
        if (startDate) {
            query += ' AND lr.start_date >= ?';
            params.push(startDate);
        }
        if (endDate) {
            query += ' AND lr.end_date <= ?';
            params.push(endDate);
        }
        
        query += ' ORDER BY lr.created_at DESC LIMIT 100';
        
        const [leaves] = await db.execute(query, params);
        res.json({ success: true, leaves });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get leave statistics (for dashboards)
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const [[stats]] = await db.execute(`
            SELECT 
                COUNT(*) as total_requests,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today
            FROM leave_requests
        `);
        
        const [[avgProcessing]] = await db.execute(`
            SELECT AVG(processing_time_ms) as avg_time
            FROM constraint_decisions_log
            WHERE DATE(created_at) = CURDATE()
        `);
        
        res.json({
            success: true,
            stats: {
                ...stats,
                avgProcessingTime: Math.round(avgProcessing?.avg_time || 0)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
