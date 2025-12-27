/**
 * PayrollController - API handlers for payroll management
 * Role-based access: Employee (own data), HR (all employees, approvals), Admin (system)
 */

const PayrollService = require('../services/PayrollService');

class PayrollController {
    
    // ==================== PAYROLL PERIODS (HR/Admin) ====================
    
    /**
     * Create new payroll period
     * POST /api/payroll/periods
     * Access: HR, Admin
     */
    async createPeriod(req, res) {
        try {
            const { period_name, start_date, end_date, notes } = req.body;
            
            if (!period_name || !start_date || !end_date) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Period name, start date, and end date are required' 
                });
            }
            
            const period = await PayrollService.createPayrollPeriod({
                period_name,
                start_date,
                end_date,
                notes
            });
            
            res.status(201).json({ success: true, period });
        } catch (error) {
            console.error('Create period error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
    
    /**
     * Get all payroll periods
     * GET /api/payroll/periods
     * Access: HR, Admin
     */
    async getPeriods(req, res) {
        try {
            const { status, year } = req.query;
            const periods = await PayrollService.getPayrollPeriods({ status, year });
            res.json({ success: true, periods });
        } catch (error) {
            console.error('Get periods error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    /**
     * Get single payroll period with details
     * GET /api/payroll/periods/:id
     * Access: HR, Admin
     */
    async getPeriodById(req, res) {
        try {
            const period = await PayrollService.getPayrollPeriodById(req.params.id);
            res.json({ success: true, period });
        } catch (error) {
            console.error('Get period error:', error);
            res.status(404).json({ success: false, error: error.message });
        }
    }
    
    /**
     * Update period status
     * PATCH /api/payroll/periods/:id/status
     * Access: HR, Admin
     */
    async updatePeriodStatus(req, res) {
        try {
            const { status } = req.body;
            const validStatuses = ['open', 'processing', 'exported', 'paid', 'closed'];
            
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
                });
            }
            
            const result = await PayrollService.updatePayrollPeriodStatus(
                req.params.id,
                status,
                req.user.emp_id
            );
            
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('Update period status error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
    
    // ==================== EMPLOYEE SALARY (HR/Admin) ====================
    
    /**
     * Get employee salary
     * GET /api/payroll/salary/:empId
     * Access: HR, Admin (any employee), Employee (own only)
     */
    async getEmployeeSalary(req, res) {
        try {
            const { empId } = req.params;
            
            // Check access - employees can only view their own
            if (req.user.role === 'employee' && req.user.emp_id !== empId) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }
            
            const salary = await PayrollService.getEmployeeSalary(empId);
            res.json({ success: true, salary });
        } catch (error) {
            console.error('Get salary error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    /**
     * Set/Update employee salary
     * POST /api/payroll/salary/:empId
     * Access: HR, Admin
     */
    async setEmployeeSalary(req, res) {
        try {
            const { empId } = req.params;
            const { base_salary, currency, pay_frequency, bank_account_last4, effective_from } = req.body;
            
            if (!base_salary || !effective_from) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Base salary and effective date are required' 
                });
            }
            
            const salary = await PayrollService.setEmployeeSalary(empId, {
                base_salary,
                currency,
                pay_frequency,
                bank_account_last4,
                effective_from
            }, req.user.emp_id);
            
            res.json({ success: true, salary });
        } catch (error) {
            console.error('Set salary error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
    
    // ==================== DEDUCTIONS ====================
    
    /**
     * Get deductions for a period
     * GET /api/payroll/periods/:id/deductions
     * Access: HR, Admin
     */
    async getDeductions(req, res) {
        try {
            const { empId } = req.query;
            const deductions = await PayrollService.getDeductions(req.params.id, empId);
            res.json({ success: true, deductions });
        } catch (error) {
            console.error('Get deductions error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    /**
     * Create manual deduction
     * POST /api/payroll/deductions
     * Access: HR, Admin
     */
    async createDeduction(req, res) {
        try {
            const { payroll_period_id, emp_id, deduction_type, description, days, amount, notes } = req.body;
            
            if (!payroll_period_id || !emp_id || !deduction_type || !description || !amount) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Period ID, employee ID, type, description, and amount are required' 
                });
            }
            
            const deduction = await PayrollService.createManualDeduction({
                payroll_period_id,
                emp_id,
                deduction_type,
                description,
                days,
                amount,
                notes
            }, req.user.emp_id);
            
            res.status(201).json({ success: true, deduction });
        } catch (error) {
            console.error('Create deduction error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
    
    /**
     * Approve/Reject deduction
     * PATCH /api/payroll/deductions/:id/review
     * Access: HR, Admin
     */
    async reviewDeduction(req, res) {
        try {
            const { status, notes } = req.body;
            
            if (!['approved', 'rejected'].includes(status)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Status must be approved or rejected' 
                });
            }
            
            const result = await PayrollService.reviewDeduction(
                req.params.id,
                status,
                req.user.emp_id,
                notes
            );
            
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('Review deduction error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
    
    // ==================== ADDITIONS ====================
    
    /**
     * Get additions for a period
     * GET /api/payroll/periods/:id/additions
     * Access: HR, Admin
     */
    async getAdditions(req, res) {
        try {
            const { empId } = req.query;
            const additions = await PayrollService.getAdditions(req.params.id, empId);
            res.json({ success: true, additions });
        } catch (error) {
            console.error('Get additions error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    /**
     * Create leave encashment request
     * POST /api/payroll/encashment
     * Access: Employee (own), HR (any)
     */
    async createEncashment(req, res) {
        try {
            const { payroll_period_id, emp_id, days, notes } = req.body;
            
            // Employees can only request for themselves
            const targetEmpId = req.user.role === 'employee' ? req.user.emp_id : emp_id;
            
            if (!payroll_period_id || !days) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Period ID and days are required' 
                });
            }
            
            const addition = await PayrollService.createLeaveEncashment({
                payroll_period_id,
                emp_id: targetEmpId,
                days,
                notes
            }, req.user.emp_id);
            
            res.status(201).json({ success: true, addition });
        } catch (error) {
            console.error('Create encashment error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
    
    /**
     * Create manual addition
     * POST /api/payroll/additions
     * Access: HR, Admin
     */
    async createAddition(req, res) {
        try {
            const { payroll_period_id, emp_id, addition_type, description, days, amount, is_taxable } = req.body;
            
            if (!payroll_period_id || !emp_id || !addition_type || !description || !amount) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Period ID, employee ID, type, description, and amount are required' 
                });
            }
            
            const addition = await PayrollService.createManualAddition({
                payroll_period_id,
                emp_id,
                addition_type,
                description,
                days,
                amount,
                is_taxable
            }, req.user.emp_id);
            
            res.status(201).json({ success: true, addition });
        } catch (error) {
            console.error('Create addition error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
    
    /**
     * Approve/Reject addition
     * PATCH /api/payroll/additions/:id/review
     * Access: HR, Admin
     */
    async reviewAddition(req, res) {
        try {
            const { status, notes } = req.body;
            
            if (!['approved', 'rejected'].includes(status)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Status must be approved or rejected' 
                });
            }
            
            const result = await PayrollService.reviewAddition(
                req.params.id,
                status,
                req.user.emp_id,
                notes
            );
            
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('Review addition error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
    
    // ==================== LEAVE PROCESSING ====================
    
    /**
     * Process leaves for a period (create deductions)
     * POST /api/payroll/periods/:id/process-leaves
     * Access: HR, Admin
     */
    async processLeaves(req, res) {
        try {
            const result = await PayrollService.processLeavesForPeriod(
                req.params.id,
                req.user.emp_id
            );
            
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('Process leaves error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
    
    /**
     * Get employee's leave impact on payroll
     * GET /api/payroll/periods/:id/leave-impact/:empId
     * Access: HR, Admin (any), Employee (own)
     */
    async getLeaveImpact(req, res) {
        try {
            const { id, empId } = req.params;
            
            // Employees can only view their own
            if (req.user.role === 'employee' && req.user.emp_id !== empId) {
                return res.status(403).json({ success: false, error: 'Access denied' });
            }
            
            const impact = await PayrollService.getEmployeeLeaveImpact(empId, id);
            res.json({ success: true, ...impact });
        } catch (error) {
            console.error('Get leave impact error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // ==================== EXPORT ====================
    
    /**
     * Generate payroll export
     * POST /api/payroll/periods/:id/export
     * Access: HR, Admin
     */
    async generateExport(req, res) {
        try {
            const { format } = req.body;
            const validFormats = ['quickbooks', 'tally', 'zoho', 'generic_csv'];
            
            if (format && !validFormats.includes(format)) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Invalid format. Must be one of: ${validFormats.join(', ')}` 
                });
            }
            
            const exportData = await PayrollService.generateExport(
                req.params.id,
                format || 'generic_csv',
                req.user.emp_id
            );
            
            res.json({ success: true, ...exportData });
        } catch (error) {
            console.error('Generate export error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
    
    /**
     * Download CSV export
     * GET /api/payroll/periods/:id/download
     * Access: HR, Admin
     */
    async downloadExport(req, res) {
        try {
            const exportData = await PayrollService.generateExport(
                req.params.id,
                'generic_csv',
                req.user.emp_id
            );
            
            const csv = PayrollService.generateCSV(exportData.data);
            
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${exportData.file_name}`);
            res.send(csv);
        } catch (error) {
            console.error('Download export error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
    
    // ==================== EMPLOYEE DASHBOARD ====================
    
    /**
     * Get employee's payroll summary (self-view)
     * GET /api/payroll/my-summary
     * Access: All employees (own data)
     */
    async getMyPayrollSummary(req, res) {
        try {
            const summary = await PayrollService.getEmployeePayrollSummary(req.user.emp_id);
            res.json({ success: true, ...summary });
        } catch (error) {
            console.error('Get my summary error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    /**
     * Get employee's deductions
     * GET /api/payroll/my-deductions
     * Access: All employees (own data)
     */
    async getMyDeductions(req, res) {
        try {
            const { period_id } = req.query;
            
            if (!period_id) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Period ID is required' 
                });
            }
            
            const deductions = await PayrollService.getDeductions(period_id, req.user.emp_id);
            res.json({ success: true, deductions });
        } catch (error) {
            console.error('Get my deductions error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    /**
     * Get employee's additions
     * GET /api/payroll/my-additions
     * Access: All employees (own data)
     */
    async getMyAdditions(req, res) {
        try {
            const { period_id } = req.query;
            
            if (!period_id) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Period ID is required' 
                });
            }
            
            const additions = await PayrollService.getAdditions(period_id, req.user.emp_id);
            res.json({ success: true, additions });
        } catch (error) {
            console.error('Get my additions error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    // ==================== HR DASHBOARD ====================
    
    /**
     * Get HR dashboard data
     * GET /api/payroll/hr-dashboard
     * Access: HR, Admin
     */
    async getHRDashboard(req, res) {
        try {
            const dashboard = await PayrollService.getHRDashboard();
            res.json({ success: true, ...dashboard });
        } catch (error) {
            console.error('Get HR dashboard error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    /**
     * Bulk approve deductions
     * POST /api/payroll/deductions/bulk-approve
     * Access: HR, Admin
     */
    async bulkApproveDeductions(req, res) {
        try {
            const { deduction_ids, action } = req.body;
            
            if (!deduction_ids || !Array.isArray(deduction_ids) || deduction_ids.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Deduction IDs array is required' 
                });
            }
            
            if (!['approved', 'rejected'].includes(action)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Action must be approved or rejected' 
                });
            }
            
            const results = [];
            for (const id of deduction_ids) {
                try {
                    await PayrollService.reviewDeduction(id, action, req.user.emp_id);
                    results.push({ id, success: true });
                } catch (e) {
                    results.push({ id, success: false, error: e.message });
                }
            }
            
            res.json({ success: true, results });
        } catch (error) {
            console.error('Bulk approve error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
    
    // ==================== ADMIN/SYSTEM ====================
    
    /**
     * Get system health metrics
     * GET /api/payroll/system-health
     * Access: Admin
     */
    async getSystemHealth(req, res) {
        try {
            const health = await PayrollService.getSystemHealth();
            res.json({ success: true, ...health });
        } catch (error) {
            console.error('Get system health error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    /**
     * Get audit logs
     * GET /api/payroll/audit-logs
     * Access: Admin
     */
    async getAuditLogs(req, res) {
        try {
            const { action_type, entity_type, emp_id, performed_by, from_date, to_date, limit } = req.query;
            
            const logs = await PayrollService.getAuditLogs({
                action_type,
                entity_type,
                emp_id,
                performed_by,
                from_date,
                to_date,
                limit: limit ? parseInt(limit) : 100
            });
            
            res.json({ success: true, logs });
        } catch (error) {
            console.error('Get audit logs error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    /**
     * Get system settings
     * GET /api/payroll/settings
     * Access: Admin
     */
    async getSettings(req, res) {
        try {
            const settings = await PayrollService.getSettings();
            res.json({ success: true, settings });
        } catch (error) {
            console.error('Get settings error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
    
    /**
     * Update system setting
     * PATCH /api/payroll/settings/:key
     * Access: Admin
     */
    async updateSetting(req, res) {
        try {
            const { key } = req.params;
            const { value } = req.body;
            
            if (value === undefined) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Value is required' 
                });
            }
            
            const result = await PayrollService.updateSetting(key, value, req.user.emp_id);
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('Update setting error:', error);
            res.status(400).json({ success: false, error: error.message });
        }
    }
}

module.exports = new PayrollController();
