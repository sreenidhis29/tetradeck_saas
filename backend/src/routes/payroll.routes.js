/**
 * Payroll Routes - Full CRUD with role-based access
 */

const express = require('express');
const router = express.Router();
const PayrollController = require('../controllers/payroll.controller');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Middleware to ensure user is authenticated on all routes
router.use(authenticateToken);

// ==================== EMPLOYEE ROUTES (Own Data) ====================

// Get my payroll summary
router.get('/my-summary', PayrollController.getMyPayrollSummary.bind(PayrollController));

// Get my deductions for a period
router.get('/my-deductions', PayrollController.getMyDeductions.bind(PayrollController));

// Get my additions for a period
router.get('/my-additions', PayrollController.getMyAdditions.bind(PayrollController));

// Request leave encashment (any employee for self)
router.post('/encashment', PayrollController.createEncashment.bind(PayrollController));

// Get my salary info
router.get('/my-salary', (req, res, next) => {
    req.params.empId = req.user.emp_id;
    PayrollController.getEmployeeSalary(req, res, next);
});

// ==================== HR ROUTES ====================

// HR Dashboard
router.get('/hr-dashboard', authorize('hr', 'admin'), PayrollController.getHRDashboard.bind(PayrollController));

// ==================== PAYROLL PERIODS ====================

// Get all periods
router.get('/periods', authorize('hr', 'admin'), PayrollController.getPeriods.bind(PayrollController));

// Create new period
router.post('/periods', authorize('hr', 'admin'), PayrollController.createPeriod.bind(PayrollController));

// Get single period
router.get('/periods/:id', authorize('hr', 'admin'), PayrollController.getPeriodById.bind(PayrollController));

// Update period status
router.patch('/periods/:id/status', authorize('hr', 'admin'), PayrollController.updatePeriodStatus.bind(PayrollController));

// Process leaves for period
router.post('/periods/:id/process-leaves', authorize('hr', 'admin'), PayrollController.processLeaves.bind(PayrollController));

// Get leave impact for employee in period
router.get('/periods/:id/leave-impact/:empId', PayrollController.getLeaveImpact.bind(PayrollController));

// Get deductions for period
router.get('/periods/:id/deductions', authorize('hr', 'admin'), PayrollController.getDeductions.bind(PayrollController));

// Get additions for period
router.get('/periods/:id/additions', authorize('hr', 'admin'), PayrollController.getAdditions.bind(PayrollController));

// Generate export
router.post('/periods/:id/export', authorize('hr', 'admin'), PayrollController.generateExport.bind(PayrollController));

// Download CSV
router.get('/periods/:id/download', authorize('hr', 'admin'), PayrollController.downloadExport.bind(PayrollController));

// ==================== SALARY MANAGEMENT ====================

// Get employee salary
router.get('/salary/:empId', PayrollController.getEmployeeSalary.bind(PayrollController));

// Set employee salary
router.post('/salary/:empId', authorize('hr', 'admin'), PayrollController.setEmployeeSalary.bind(PayrollController));

// ==================== DEDUCTIONS ====================

// Create manual deduction
router.post('/deductions', authorize('hr', 'admin'), PayrollController.createDeduction.bind(PayrollController));

// Review (approve/reject) deduction
router.patch('/deductions/:id/review', authorize('hr', 'admin'), PayrollController.reviewDeduction.bind(PayrollController));

// Bulk approve deductions
router.post('/deductions/bulk-approve', authorize('hr', 'admin'), PayrollController.bulkApproveDeductions.bind(PayrollController));

// ==================== ADDITIONS ====================

// Create manual addition
router.post('/additions', authorize('hr', 'admin'), PayrollController.createAddition.bind(PayrollController));

// Review (approve/reject) addition
router.patch('/additions/:id/review', authorize('hr', 'admin'), PayrollController.reviewAddition.bind(PayrollController));

// ==================== ADMIN ROUTES ====================

// System health
router.get('/system-health', authorize('admin'), PayrollController.getSystemHealth.bind(PayrollController));

// Audit logs
router.get('/audit-logs', authorize('admin'), PayrollController.getAuditLogs.bind(PayrollController));

// Settings
router.get('/settings', authorize('admin'), PayrollController.getSettings.bind(PayrollController));
router.patch('/settings/:key', authorize('admin'), PayrollController.updateSetting.bind(PayrollController));

module.exports = router;
