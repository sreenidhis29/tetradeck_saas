const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/authMiddleware');
const db = require('../config/db');

// Get all employees
router.get('/all', authenticateToken, async (req, res) => {
    try {
        const employees = await db.query(`
            SELECT emp_id, full_name, email, department, position, is_active, hire_date 
            FROM employees 
            WHERE is_active = 1
            ORDER BY full_name
        `);
        res.json({ success: true, employees: employees || [] });
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get managers (employees who can be reporting managers)
router.get('/managers', authenticateToken, async (req, res) => {
    try {
        const managers = await db.query(`
            SELECT emp_id, full_name, email, department, position 
            FROM employees 
            WHERE is_active = 1 
            AND (position LIKE '%Manager%' OR position LIKE '%Lead%' OR position LIKE '%Director%' OR position LIKE '%Head%')
            ORDER BY department, full_name
        `);
        res.json({ success: true, managers: managers || [] });
    } catch (error) {
        console.error('Error fetching managers:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single employee
router.get('/:empId', authenticateToken, async (req, res) => {
    try {
        const employees = await db.query('SELECT * FROM employees WHERE emp_id = ?', [req.params.empId]);
        if (!employees || employees.length === 0) {
            return res.status(404).json({ success: false, error: 'Employee not found' });
        }
        res.json({ success: true, employee: employees[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get employees by department
router.get('/department/:dept', authenticateToken, async (req, res) => {
    try {
        const employees = await db.query(`
            SELECT emp_id, full_name, email, position 
            FROM employees 
            WHERE department = ? AND is_active = 1
            ORDER BY full_name
        `, [req.params.dept]);
        res.json({ success: true, employees: employees || [] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all departments
router.get('/meta/departments', authenticateToken, async (req, res) => {
    try {
        const depts = await db.query(`
            SELECT DISTINCT department 
            FROM employees 
            WHERE is_active = 1 AND department IS NOT NULL
            ORDER BY department
        `);
        res.json({ success: true, departments: (depts || []).map(d => d.department) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
