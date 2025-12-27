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

// CREATE new leave request (for employee dashboard)
router.post('/create', authenticateToken, async (req, res) => {
    try {
        const { type, start_date, end_date, reason, half_day } = req.body;
        
        // Get employee ID from token
        const empId = req.user?.emp_id || req.user?.employeeId || 'EMP001';
        
        // Validate required fields
        if (!type || !start_date || !end_date) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: type, start_date, end_date' 
            });
        }
        
        // Calculate days (simple calculation, can be enhanced)
        const startDateObj = new Date(start_date);
        const endDateObj = new Date(end_date);
        let total_days = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;
        if (half_day) total_days = 0.5;
        
        // Generate request ID
        const request_id = 'REQ' + Date.now();
        
        // Insert leave request
        const result = await db.query(`
            INSERT INTO leave_requests 
            (request_id, emp_id, leave_type, start_date, end_date, total_days, reason, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
        `, [request_id, empId, type, start_date, end_date, total_days, reason || 'Personal leave']);
        
        res.json({ 
            success: true, 
            message: 'Leave request created successfully',
            request_id: request_id,
            request: {
                request_id: request_id,
                emp_id: empId,
                leave_type: type,
                start_date,
                end_date,
                total_days,
                reason,
                status: 'pending'
            }
        });
    } catch (error) {
        console.error('Create leave error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update leave status (HR approve/reject) - PUT method
router.put('/:requestId/status', authenticateToken, async (req, res) => {
    try {
        const { requestId } = req.params;
        const { status } = req.body;
        const approvedBy = req.user?.name || 'HR';
        
        if (!['approved', 'rejected', 'Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }
        
        const normalizedStatus = status.toLowerCase();
        
        // Get request details first
        const request = await db.query(
            'SELECT * FROM leave_requests WHERE request_id = ?',
            [requestId]
        );
        
        if (!request || request.length === 0) {
            return res.status(404).json({ success: false, error: 'Request not found' });
        }
        
        // Update request status - HR approval (not AI)
        await db.execute(`
            UPDATE leave_requests 
            SET status = ?, approved_by = ?, approval_date = NOW()
            WHERE request_id = ?
        `, [normalizedStatus, `HR:${approvedBy}`, requestId]);
        
        // If approved, deduct from balance
        if (normalizedStatus === 'approved') {
            const leaveData = request[0];
            try {
                await db.execute(`
                    UPDATE leave_balances 
                    SET used_so_far = used_so_far + ?
                    WHERE emp_id = ? AND leave_type = ?
                `, [leaveData.total_days || 1, leaveData.emp_id, leaveData.leave_type?.toLowerCase() || 'vacation']);
            } catch (balanceError) {
                console.log('Balance update skipped:', balanceError.message);
            }
        }
        
        res.json({ success: true, message: `Leave ${normalizedStatus} successfully` });
    } catch (error) {
        console.error('Error updating leave status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Approve leave request (HR/Manager)
router.post('/approve/:requestId', authenticateToken, async (req, res) => {
    try {
        const { requestId } = req.params;
        const { approvedBy } = req.body;
        
        // Get request details first
        const requestResult = await db.execute(
            'SELECT emp_id, leave_type, total_days FROM leave_requests WHERE request_id = ?',
            [requestId]
        );
        const request = requestResult[0];
        
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
        const teamResult = await db.execute('SELECT * FROM teams WHERE team_id = ?', [teamId]);
        const team = teamResult[0];
        
        // Get team members
        const members = await db.execute(`
            SELECT e.emp_id, e.full_name, e.position
            FROM team_members tm
            JOIN employees e ON tm.emp_id = e.emp_id
            WHERE tm.team_id = ?
        `, [teamId]);
        
        // Get members on leave
        const onLeave = await db.execute(`
            SELECT e.emp_id, e.full_name, lr.leave_type, lr.start_date, lr.end_date
            FROM leave_requests lr
            JOIN employees e ON lr.emp_id = e.emp_id
            JOIN team_members tm ON e.emp_id = tm.emp_id
            WHERE tm.team_id = ?
            AND lr.status = 'approved'
            AND ? BETWEEN lr.start_date AND lr.end_date
        `, [teamId, checkDate]);
        
        const onLeaveArr = Array.isArray(onLeave) ? onLeave : [];
        const membersArr = Array.isArray(members) ? members : [];
        const onLeaveIds = onLeaveArr.map(m => m.emp_id);
        const present = membersArr.filter(m => !onLeaveIds.includes(m.emp_id));
        
        res.json({
            success: true,
            team: team,
            date: checkDate,
            summary: {
                total: membersArr.length,
                present: present.length,
                onLeave: onLeaveArr.length,
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
        
        const leaves = await db.execute(query, params);
        res.json({ success: true, leaves: leaves || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get leave statistics (for dashboards)
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const statsResult = await db.execute(`
            SELECT 
                COUNT(*) as total_requests,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today
            FROM leave_requests
        `);
        const stats = statsResult[0] || {};
        
        const avgResult = await db.execute(`
            SELECT AVG(processing_time_ms) as avg_time
            FROM constraint_decisions_log
            WHERE DATE(created_at) = CURDATE()
        `);
        const avgProcessing = avgResult[0] || {};
        
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
