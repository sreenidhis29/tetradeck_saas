/**
 * PayrollService - Complete Payroll Management
 * Handles salary calculations, deductions, leave integration, exports
 */

const db = require('../config/db');

class PayrollService {
    
    // ==================== PAYROLL PERIODS ====================
    
    /**
     * Create a new payroll period
     */
    async createPayrollPeriod(periodData) {
        const { period_name, start_date, end_date, notes } = periodData;
        
        // Check for overlapping periods
        const existing = await db.query(
            `SELECT id FROM payroll_periods 
             WHERE (start_date <= ? AND end_date >= ?) 
             OR (start_date <= ? AND end_date >= ?)
             OR (start_date >= ? AND end_date <= ?)`,
            [start_date, start_date, end_date, end_date, start_date, end_date]
        );
        
        if (existing && existing.length > 0) {
            throw new Error('Overlapping payroll period exists');
        }
        
        const result = await db.query(
            `INSERT INTO payroll_periods (period_name, start_date, end_date, notes) 
             VALUES (?, ?, ?, ?)`,
            [period_name, start_date, end_date, notes || null]
        );
        
        await this.logAudit('CREATE', 'payroll_period', result.insertId, null, null, periodData);
        
        return { id: result.insertId, ...periodData, status: 'open' };
    }
    
    /**
     * Get all payroll periods with summary stats
     */
    async getPayrollPeriods(filters = {}) {
        let query = `
            SELECT 
                pp.*,
                (SELECT COUNT(DISTINCT emp_id) FROM payroll_deductions WHERE payroll_period_id = pp.id) as deduction_count,
                (SELECT COUNT(DISTINCT emp_id) FROM payroll_additions WHERE payroll_period_id = pp.id) as addition_count,
                (SELECT COALESCE(SUM(amount), 0) FROM payroll_deductions WHERE payroll_period_id = pp.id AND status = 'approved') as total_deductions,
                (SELECT COALESCE(SUM(amount), 0) FROM payroll_additions WHERE payroll_period_id = pp.id AND status = 'approved') as total_additions
            FROM payroll_periods pp
            WHERE 1=1
        `;
        const params = [];
        
        if (filters.status) {
            query += ` AND pp.status = ?`;
            params.push(filters.status);
        }
        
        if (filters.year) {
            query += ` AND YEAR(pp.start_date) = ?`;
            params.push(filters.year);
        }
        
        query += ` ORDER BY pp.start_date DESC`;
        
        return await db.query(query, params);
    }
    
    /**
     * Get single payroll period with full details
     */
    async getPayrollPeriodById(periodId) {
        const periods = await db.query(
            `SELECT * FROM payroll_periods WHERE id = ?`,
            [periodId]
        );
        
        if (!periods || periods.length === 0) {
            throw new Error('Payroll period not found');
        }
        
        const period = periods[0];
        
        // Get deductions for this period
        period.deductions = await db.query(
            `SELECT pd.*, e.full_name, e.department
             FROM payroll_deductions pd
             JOIN employees e ON pd.emp_id = e.emp_id
             WHERE pd.payroll_period_id = ?
             ORDER BY e.department, e.full_name`,
            [periodId]
        );
        
        // Get additions for this period
        period.additions = await db.query(
            `SELECT pa.*, e.full_name, e.department
             FROM payroll_additions pa
             JOIN employees e ON pa.emp_id = e.emp_id
             WHERE pa.payroll_period_id = ?
             ORDER BY e.department, e.full_name`,
            [periodId]
        );
        
        return period;
    }
    
    /**
     * Update payroll period status
     */
    async updatePayrollPeriodStatus(periodId, status, processedBy) {
        const oldPeriod = await this.getPayrollPeriodById(periodId);
        
        await db.query(
            `UPDATE payroll_periods 
             SET status = ?, processed_at = NOW(), processed_by = ?
             WHERE id = ?`,
            [status, processedBy, periodId]
        );
        
        await this.logAudit('STATUS_CHANGE', 'payroll_period', periodId, null, processedBy, 
            { old_status: oldPeriod.status, new_status: status });
        
        return { success: true, new_status: status };
    }
    
    // ==================== EMPLOYEE SALARY ====================
    
    /**
     * Get employee salary info
     */
    async getEmployeeSalary(empId) {
        const salaries = await db.query(
            `SELECT * FROM employee_salary 
             WHERE emp_id = ? AND (effective_to IS NULL OR effective_to >= CURDATE())
             ORDER BY effective_from DESC LIMIT 1`,
            [empId]
        );
        return salaries && salaries.length > 0 ? salaries[0] : null;
    }
    
    /**
     * Set/update employee salary
     */
    async setEmployeeSalary(empId, salaryData, updatedBy) {
        const { base_salary, currency, pay_frequency, bank_account_last4, effective_from } = salaryData;
        
        // End current salary record
        await db.query(
            `UPDATE employee_salary 
             SET effective_to = DATE_SUB(?, INTERVAL 1 DAY)
             WHERE emp_id = ? AND effective_to IS NULL`,
            [effective_from, empId]
        );
        
        // Insert new salary record
        const result = await db.query(
            `INSERT INTO employee_salary (emp_id, base_salary, currency, pay_frequency, bank_account_last4, effective_from)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [empId, base_salary, currency || 'INR', pay_frequency || 'monthly', bank_account_last4, effective_from]
        );
        
        await this.logAudit('SET_SALARY', 'employee_salary', result.insertId, empId, updatedBy, salaryData);
        
        return { id: result.insertId, ...salaryData };
    }
    
    /**
     * Calculate daily rate for an employee
     */
    async calculateDailyRate(empId) {
        const salary = await this.getEmployeeSalary(empId);
        if (!salary) return 0;
        
        // Standard: monthly salary / 30 days
        return parseFloat((salary.base_salary / 30).toFixed(2));
    }
    
    // ==================== DEDUCTIONS ====================
    
    /**
     * Create deduction from approved unpaid leave
     */
    async createLeaveDeduction(periodId, leaveRequest, createdBy) {
        const { id: leaveId, emp_id, leave_type, start_date, end_date, number_of_days } = leaveRequest;
        
        // Only create deductions for unpaid leave or LOP (Loss of Pay)
        if (!['unpaid', 'lop', 'loss_of_pay'].includes(leave_type.toLowerCase())) {
            return null; // No deduction needed for paid leave
        }
        
        const dailyRate = await this.calculateDailyRate(emp_id);
        const amount = dailyRate * number_of_days;
        
        const result = await db.query(
            `INSERT INTO payroll_deductions 
             (payroll_period_id, emp_id, deduction_type, description, reference_id, days, amount, status)
             VALUES (?, ?, 'unpaid_leave', ?, ?, ?, ?, 'pending_review')`,
            [
                periodId,
                emp_id,
                `Unpaid Leave: ${start_date} to ${end_date}`,
                `leave_${leaveId}`,
                number_of_days,
                amount
            ]
        );
        
        // Mark leave as having deduction created
        await db.query(
            `UPDATE leave_requests SET deduction_created = TRUE, payroll_period_id = ? WHERE id = ?`,
            [periodId, leaveId]
        );
        
        await this.logAudit('CREATE_DEDUCTION', 'payroll_deduction', result.insertId, emp_id, createdBy, 
            { leave_id: leaveId, days: number_of_days, amount });
        
        return { id: result.insertId, emp_id, amount, days: number_of_days };
    }
    
    /**
     * Create manual deduction
     */
    async createManualDeduction(deductionData, createdBy) {
        const { payroll_period_id, emp_id, deduction_type, description, days, amount, notes } = deductionData;
        
        const result = await db.query(
            `INSERT INTO payroll_deductions 
             (payroll_period_id, emp_id, deduction_type, description, days, amount, notes, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_review')`,
            [payroll_period_id, emp_id, deduction_type, description, days || 0, amount, notes]
        );
        
        await this.logAudit('CREATE_MANUAL_DEDUCTION', 'payroll_deduction', result.insertId, emp_id, createdBy, deductionData);
        
        return { id: result.insertId, ...deductionData, status: 'pending_review' };
    }
    
    /**
     * Get deductions for a period (with optional employee filter)
     */
    async getDeductions(periodId, empId = null) {
        let query = `
            SELECT pd.*, e.full_name, e.department, e.email,
                   es.base_salary
            FROM payroll_deductions pd
            JOIN employees e ON pd.emp_id = e.emp_id
            LEFT JOIN employee_salary es ON pd.emp_id = es.emp_id AND es.effective_to IS NULL
            WHERE pd.payroll_period_id = ?
        `;
        const params = [periodId];
        
        if (empId) {
            query += ` AND pd.emp_id = ?`;
            params.push(empId);
        }
        
        query += ` ORDER BY e.department, e.full_name`;
        
        return await db.query(query, params);
    }
    
    /**
     * Approve/Reject deduction
     */
    async reviewDeduction(deductionId, status, reviewedBy, notes = null) {
        const deductions = await db.query(`SELECT * FROM payroll_deductions WHERE id = ?`, [deductionId]);
        if (!deductions || deductions.length === 0) {
            throw new Error('Deduction not found');
        }
        
        const oldDeduction = deductions[0];
        
        await db.query(
            `UPDATE payroll_deductions 
             SET status = ?, reviewed_by = ?, reviewed_at = NOW(), notes = CONCAT(IFNULL(notes, ''), ?)
             WHERE id = ?`,
            [status, reviewedBy, notes ? `\nReview: ${notes}` : '', deductionId]
        );
        
        await this.logAudit('REVIEW_DEDUCTION', 'payroll_deduction', deductionId, oldDeduction.emp_id, reviewedBy,
            { old_status: oldDeduction.status, new_status: status, notes });
        
        return { success: true, new_status: status };
    }
    
    // ==================== ADDITIONS ====================
    
    /**
     * Create leave encashment request
     */
    async createLeaveEncashment(additionData, createdBy) {
        const { payroll_period_id, emp_id, days, notes } = additionData;
        
        // Validate encashment days
        const settings = await this.getSettings();
        const maxDays = parseInt(settings.max_encashment_days || '15');
        
        if (days > maxDays) {
            throw new Error(`Cannot encash more than ${maxDays} days per year`);
        }
        
        // Check remaining leave balance
        const balance = await db.query(
            `SELECT balance FROM leave_balances WHERE emp_id = ? AND leave_type = 'earned'`,
            [emp_id]
        );
        
        if (!balance || balance.length === 0 || balance[0].balance < days) {
            throw new Error('Insufficient leave balance for encashment');
        }
        
        const dailyRate = await this.calculateDailyRate(emp_id);
        const amount = dailyRate * days;
        
        const result = await db.query(
            `INSERT INTO payroll_additions 
             (payroll_period_id, emp_id, addition_type, description, days, amount, is_taxable, status)
             VALUES (?, ?, 'leave_encashment', ?, ?, ?, TRUE, 'pending_review')`,
            [payroll_period_id, emp_id, `Leave Encashment: ${days} days`, days, amount]
        );
        
        await this.logAudit('CREATE_ENCASHMENT', 'payroll_addition', result.insertId, emp_id, createdBy,
            { days, amount });
        
        return { id: result.insertId, emp_id, days, amount, status: 'pending_review' };
    }
    
    /**
     * Create manual addition (bonus, overtime)
     */
    async createManualAddition(additionData, createdBy) {
        const { payroll_period_id, emp_id, addition_type, description, days, amount, is_taxable } = additionData;
        
        const result = await db.query(
            `INSERT INTO payroll_additions 
             (payroll_period_id, emp_id, addition_type, description, days, amount, is_taxable, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_review')`,
            [payroll_period_id, emp_id, addition_type, description, days || 0, amount, is_taxable !== false]
        );
        
        await this.logAudit('CREATE_MANUAL_ADDITION', 'payroll_addition', result.insertId, emp_id, createdBy, additionData);
        
        return { id: result.insertId, ...additionData, status: 'pending_review' };
    }
    
    /**
     * Get additions for a period
     */
    async getAdditions(periodId, empId = null) {
        let query = `
            SELECT pa.*, e.full_name, e.department, e.email
            FROM payroll_additions pa
            JOIN employees e ON pa.emp_id = e.emp_id
            WHERE pa.payroll_period_id = ?
        `;
        const params = [periodId];
        
        if (empId) {
            query += ` AND pa.emp_id = ?`;
            params.push(empId);
        }
        
        query += ` ORDER BY e.department, e.full_name`;
        
        return await db.query(query, params);
    }
    
    /**
     * Approve/Reject addition
     */
    async reviewAddition(additionId, status, reviewedBy, notes = null) {
        const additions = await db.query(`SELECT * FROM payroll_additions WHERE id = ?`, [additionId]);
        if (!additions || additions.length === 0) {
            throw new Error('Addition not found');
        }
        
        const oldAddition = additions[0];
        
        await db.query(
            `UPDATE payroll_additions 
             SET status = ?, reviewed_by = ?, reviewed_at = NOW()
             WHERE id = ?`,
            [status, reviewedBy, additionId]
        );
        
        // If leave encashment approved, deduct from balance
        if (status === 'approved' && oldAddition.addition_type === 'leave_encashment') {
            await db.query(
                `UPDATE leave_balances SET balance = balance - ? WHERE emp_id = ? AND leave_type = 'earned'`,
                [oldAddition.days, oldAddition.emp_id]
            );
        }
        
        await this.logAudit('REVIEW_ADDITION', 'payroll_addition', additionId, oldAddition.emp_id, reviewedBy,
            { old_status: oldAddition.status, new_status: status, notes });
        
        return { success: true, new_status: status };
    }
    
    // ==================== LEAVE INTEGRATION ====================
    
    /**
     * Process all approved unpaid leaves for a period
     */
    async processLeavesForPeriod(periodId, processedBy) {
        const period = await this.getPayrollPeriodById(periodId);
        
        // Find all approved unpaid leaves in this period that haven't been processed
        const leaves = await db.query(
            `SELECT lr.*, e.full_name
             FROM leave_requests lr
             JOIN employees e ON lr.emp_id = e.emp_id
             WHERE lr.status = 'approved'
             AND lr.leave_type IN ('unpaid', 'lop', 'loss_of_pay')
             AND lr.deduction_created = FALSE
             AND lr.start_date >= ? AND lr.end_date <= ?`,
            [period.start_date, period.end_date]
        );
        
        const results = [];
        for (const leave of leaves) {
            const deduction = await this.createLeaveDeduction(periodId, leave, processedBy);
            if (deduction) {
                results.push(deduction);
            }
        }
        
        return {
            processed_count: results.length,
            deductions: results
        };
    }
    
    /**
     * Get employee's payroll impact from leaves
     */
    async getEmployeeLeaveImpact(empId, periodId) {
        const period = await this.getPayrollPeriodById(periodId);
        
        // Get all leaves in this period
        const leaves = await db.query(
            `SELECT lr.*, lt.is_paid
             FROM leave_requests lr
             LEFT JOIN (
                SELECT 'earned' as type, TRUE as is_paid UNION
                SELECT 'sick', TRUE UNION
                SELECT 'casual', TRUE UNION
                SELECT 'unpaid', FALSE UNION
                SELECT 'lop', FALSE
             ) lt ON LOWER(lr.leave_type) = lt.type
             WHERE lr.emp_id = ?
             AND lr.status = 'approved'
             AND lr.start_date >= ? AND lr.end_date <= ?`,
            [empId, period.start_date, period.end_date]
        );
        
        const paidDays = leaves.filter(l => l.is_paid !== false).reduce((sum, l) => sum + l.number_of_days, 0);
        const unpaidDays = leaves.filter(l => l.is_paid === false).reduce((sum, l) => sum + l.number_of_days, 0);
        
        const dailyRate = await this.calculateDailyRate(empId);
        
        return {
            leaves,
            paid_leave_days: paidDays,
            unpaid_leave_days: unpaidDays,
            daily_rate: dailyRate,
            total_deduction: unpaidDays * dailyRate
        };
    }
    
    // ==================== EXPORT ====================
    
    /**
     * Generate payroll export for QuickBooks/CSV
     */
    async generateExport(periodId, format, exportedBy) {
        const period = await this.getPayrollPeriodById(periodId);
        
        // Get all employees with their payroll data
        const employees = await db.query(
            `SELECT e.emp_id, e.full_name, e.email, e.department,
                    es.base_salary, es.bank_account_last4
             FROM employees e
             LEFT JOIN employee_salary es ON e.emp_id = es.emp_id AND es.effective_to IS NULL
             WHERE e.is_active = 1
             ORDER BY e.department, e.full_name`
        );
        
        const exportData = [];
        let totalDeductions = 0;
        let totalAdditions = 0;
        
        for (const emp of employees) {
            // Get approved deductions
            const deductions = await db.query(
                `SELECT SUM(amount) as total FROM payroll_deductions 
                 WHERE payroll_period_id = ? AND emp_id = ? AND status = 'approved'`,
                [periodId, emp.emp_id]
            );
            
            // Get approved additions
            const additions = await db.query(
                `SELECT SUM(amount) as total, SUM(CASE WHEN is_taxable THEN amount ELSE 0 END) as taxable
                 FROM payroll_additions 
                 WHERE payroll_period_id = ? AND emp_id = ? AND status = 'approved'`,
                [periodId, emp.emp_id]
            );
            
            const empDeductions = deductions[0]?.total || 0;
            const empAdditions = additions[0]?.total || 0;
            const empTaxableAdditions = additions[0]?.taxable || 0;
            
            totalDeductions += empDeductions;
            totalAdditions += empAdditions;
            
            const netPay = (emp.base_salary || 0) - empDeductions + empAdditions;
            
            exportData.push({
                employee_id: emp.emp_id,
                employee_name: emp.full_name,
                department: emp.department,
                email: emp.email,
                base_salary: emp.base_salary || 0,
                deductions: empDeductions,
                additions: empAdditions,
                taxable_additions: empTaxableAdditions,
                net_pay: netPay,
                bank_account: emp.bank_account_last4 ? `****${emp.bank_account_last4}` : 'N/A'
            });
        }
        
        // Generate file name
        const fileName = `payroll_${period.period_name.replace(/\s+/g, '_')}_${Date.now()}.csv`;
        
        // Log export
        const exportResult = await db.query(
            `INSERT INTO payroll_exports 
             (payroll_period_id, export_format, file_name, total_employees, total_deductions, total_additions, exported_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [periodId, format, fileName, employees.length, totalDeductions, totalAdditions, exportedBy]
        );
        
        await this.logAudit('EXPORT', 'payroll_export', exportResult.insertId, null, exportedBy,
            { period_id: periodId, format, employee_count: employees.length });
        
        return {
            export_id: exportResult.insertId,
            file_name: fileName,
            period: period.period_name,
            data: exportData,
            summary: {
                total_employees: employees.length,
                total_deductions: totalDeductions,
                total_additions: totalAdditions,
                total_net_payroll: exportData.reduce((sum, e) => sum + e.net_pay, 0)
            }
        };
    }
    
    /**
     * Convert export data to CSV format
     */
    generateCSV(exportData) {
        const headers = [
            'Employee ID',
            'Employee Name', 
            'Department',
            'Email',
            'Base Salary',
            'Deductions',
            'Additions',
            'Taxable Additions',
            'Net Pay',
            'Bank Account'
        ];
        
        let csv = headers.join(',') + '\n';
        
        for (const row of exportData) {
            csv += [
                row.employee_id,
                `"${row.employee_name}"`,
                row.department,
                row.email,
                row.base_salary,
                row.deductions,
                row.additions,
                row.taxable_additions,
                row.net_pay,
                row.bank_account
            ].join(',') + '\n';
        }
        
        return csv;
    }
    
    // ==================== EMPLOYEE VIEW ====================
    
    /**
     * Get employee's payroll summary (for employee self-view)
     */
    async getEmployeePayrollSummary(empId) {
        const salary = await this.getEmployeeSalary(empId);
        
        // Get recent payroll periods
        const periods = await db.query(
            `SELECT pp.*, 
                    (SELECT SUM(amount) FROM payroll_deductions WHERE payroll_period_id = pp.id AND emp_id = ? AND status IN ('approved', 'processed')) as my_deductions,
                    (SELECT SUM(amount) FROM payroll_additions WHERE payroll_period_id = pp.id AND emp_id = ? AND status IN ('approved', 'processed')) as my_additions
             FROM payroll_periods pp
             WHERE pp.status IN ('exported', 'paid', 'closed')
             ORDER BY pp.end_date DESC
             LIMIT 12`,
            [empId, empId]
        );
        
        // Get pending items
        const pendingDeductions = await db.query(
            `SELECT pd.*, pp.period_name
             FROM payroll_deductions pd
             JOIN payroll_periods pp ON pd.payroll_period_id = pp.id
             WHERE pd.emp_id = ? AND pd.status = 'pending_review'`,
            [empId]
        );
        
        const pendingAdditions = await db.query(
            `SELECT pa.*, pp.period_name
             FROM payroll_additions pa
             JOIN payroll_periods pp ON pa.payroll_period_id = pp.id
             WHERE pa.emp_id = ? AND pa.status = 'pending_review'`,
            [empId]
        );
        
        return {
            salary_info: salary,
            recent_periods: periods,
            pending_deductions: pendingDeductions,
            pending_additions: pendingAdditions
        };
    }
    
    // ==================== HR DASHBOARD ====================
    
    /**
     * Get HR dashboard data
     */
    async getHRDashboard() {
        // Current/open period
        const currentPeriods = await db.query(
            `SELECT * FROM payroll_periods WHERE status = 'open' ORDER BY start_date DESC LIMIT 1`
        );
        const currentPeriod = currentPeriods && currentPeriods.length > 0 ? currentPeriods[0] : null;
        
        // Pending reviews count
        const pendingDeductions = await db.query(
            `SELECT COUNT(*) as count FROM payroll_deductions WHERE status = 'pending_review'`
        );
        const pendingAdditions = await db.query(
            `SELECT COUNT(*) as count FROM payroll_additions WHERE status = 'pending_review'`
        );
        
        // Recent periods summary
        const recentPeriods = await this.getPayrollPeriods({ limit: 6 });
        
        // Employees needing salary setup
        const noSalarySetup = await db.query(
            `SELECT e.emp_id, e.full_name, e.department
             FROM employees e
             LEFT JOIN employee_salary es ON e.emp_id = es.emp_id AND es.effective_to IS NULL
             WHERE e.is_active = 1 AND es.id IS NULL`
        );
        
        // Unprocessed leaves (approved unpaid leaves without deductions)
        const unprocessedLeaves = await db.query(
            `SELECT lr.*, e.full_name
             FROM leave_requests lr
             JOIN employees e ON lr.emp_id = e.emp_id
             WHERE lr.status = 'approved'
             AND lr.leave_type IN ('unpaid', 'lop', 'loss_of_pay')
             AND lr.deduction_created = FALSE
             LIMIT 20`
        );
        
        return {
            current_period: currentPeriod,
            pending_reviews: {
                deductions: pendingDeductions[0]?.count || 0,
                additions: pendingAdditions[0]?.count || 0
            },
            recent_periods: recentPeriods,
            employees_no_salary: noSalarySetup,
            unprocessed_leaves: unprocessedLeaves
        };
    }
    
    // ==================== ADMIN/SYSTEM ====================
    
    /**
     * Get system health metrics
     */
    async getSystemHealth() {
        // Database stats
        const tableStats = await db.query(
            `SELECT 
                (SELECT COUNT(*) FROM employees WHERE is_active = 1) as active_employees,
                (SELECT COUNT(*) FROM employee_salary WHERE effective_to IS NULL) as employees_with_salary,
                (SELECT COUNT(*) FROM payroll_periods) as total_periods,
                (SELECT COUNT(*) FROM payroll_deductions) as total_deductions,
                (SELECT COUNT(*) FROM payroll_additions) as total_additions,
                (SELECT COUNT(*) FROM payroll_exports) as total_exports
            `
        );
        
        // Recent audit logs
        const recentAudit = await db.query(
            `SELECT * FROM payroll_audit_log ORDER BY created_at DESC LIMIT 50`
        );
        
        // System settings
        const settings = await this.getSettings();
        
        return {
            stats: tableStats[0],
            recent_audit: recentAudit,
            settings
        };
    }
    
    /**
     * Get system settings
     */
    async getSettings() {
        const settings = await db.query(
            `SELECT setting_key, setting_value FROM system_settings WHERE category = 'payroll'`
        );
        
        const result = {};
        for (const s of settings) {
            result[s.setting_key] = s.setting_value;
        }
        return result;
    }
    
    /**
     * Update system setting
     */
    async updateSetting(key, value, updatedBy) {
        await db.query(
            `UPDATE system_settings SET setting_value = ?, updated_by = ? WHERE setting_key = ?`,
            [value, updatedBy, key]
        );
        
        await this.logAudit('UPDATE_SETTING', 'system_settings', 0, null, updatedBy, { key, value });
        
        return { success: true };
    }
    
    // ==================== AUDIT ====================
    
    /**
     * Log audit trail
     */
    async logAudit(actionType, entityType, entityId, empId, performedBy, data, req = null) {
        try {
            await db.query(
                `INSERT INTO payroll_audit_log 
                 (action_type, entity_type, entity_id, emp_id, performed_by, performed_by_role, old_value, new_value, ip_address, user_agent)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    actionType,
                    entityType,
                    entityId,
                    empId,
                    performedBy,
                    'system', // Role will be set by controller
                    null,
                    JSON.stringify(data),
                    req?.ip || null,
                    req?.get?.('User-Agent') || null
                ]
            );
        } catch (error) {
            console.error('Audit log error:', error);
        }
    }
    
    /**
     * Get audit logs with filters
     */
    async getAuditLogs(filters = {}) {
        let query = `SELECT * FROM payroll_audit_log WHERE 1=1`;
        const params = [];
        
        if (filters.action_type) {
            query += ` AND action_type = ?`;
            params.push(filters.action_type);
        }
        
        if (filters.entity_type) {
            query += ` AND entity_type = ?`;
            params.push(filters.entity_type);
        }
        
        if (filters.emp_id) {
            query += ` AND emp_id = ?`;
            params.push(filters.emp_id);
        }
        
        if (filters.performed_by) {
            query += ` AND performed_by = ?`;
            params.push(filters.performed_by);
        }
        
        if (filters.from_date) {
            query += ` AND created_at >= ?`;
            params.push(filters.from_date);
        }
        
        if (filters.to_date) {
            query += ` AND created_at <= ?`;
            params.push(filters.to_date);
        }
        
        query += ` ORDER BY created_at DESC LIMIT ${filters.limit || 100}`;
        
        return await db.query(query, params);
    }
}

module.exports = new PayrollService();
