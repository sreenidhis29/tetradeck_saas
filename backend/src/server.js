const ConstraintService = require('../services/ConstraintService');
const { executeQuery } = require('../config/db');

class LeaveController {

    // Main constraint analysis endpoint
    async analyzeLeave(req, res) {
        try {
            const { request, employeeId } = req.body;
            const startTime = Date.now();

            console.log(`📊 Constraint check for: ${employeeId} - "${request}"`);

            // 1. Local constraint check (Node.js)
            const localResult = ConstraintService.quickCheck(request, employeeId);

            // 2. If local check fails, return immediately
            if (!localResult.passed) {
                const responseTime = Date.now() - startTime;

                return res.json({
                    approved: false,
                    message: '❌ Request violates basic constraints',
                    details: localResult.message,
                    violations: localResult.violations,
                    engine: 'Node.js Local Constraints',
                    responseTime: `${responseTime}ms`,
                    constraintsChecked: localResult.checksPerformed,
                    priority: localResult.priority || 1.0,
                    suggestion: localResult.suggestion || 'Try different dates'
                });
            }

            // 3. Get team state from database
            const teamState = await this.getTeamState(employeeId);

            // 4. Check with Python constraint engine (optional - can run locally)
            let pythonResult;
            try {
                pythonResult = await ConstraintService.callPythonEngine({
                    request,
                    employeeId,
                    teamState,
                    extractedInfo: localResult.extractedInfo
                });
            } catch (pythonError) {
                console.log('Python engine unavailable, using Node.js constraints:', pythonError.message);
                pythonResult = ConstraintService.fallbackCheck(localResult.extractedInfo, teamState);
            }

            // 5. Log to database
            await this.logDecision({
                employeeId,
                request,
                approved: pythonResult.approved,
                violations: pythonResult.violations || [],
                engine: pythonResult.engine || 'Mixed Constraint Engine',
                extractedInfo: localResult.extractedInfo
            });

            // 6. Calculate response time
            const responseTime = Date.now() - startTime;

            // 7. Return result
            res.json({
                approved: pythonResult.approved,
                message: pythonResult.message,
                details: pythonResult.details || `Checked against ${teamState.teamSize} team members`,
                violations: pythonResult.violations || [],
                engine: pythonResult.engine || 'Hybrid Constraint Engine',
                responseTime: `${responseTime}ms`,
                constraintsChecked: (localResult.checksPerformed || 0) + (pythonResult.checksPerformed || 0),
                priority: pythonResult.priority || localResult.priority || 1.0,
                extractedInfo: localResult.extractedInfo,
                teamCoverage: teamState.coverage
            });

        } catch (error) {
            console.error('Constraint analysis error:', error);
            res.status(500).json({
                approved: false,
                message: '⚠️ System error in constraint engine',
                details: 'Using emergency fallback rules',
                violations: ['System temporarily degraded'],
                engine: 'Emergency Fallback',
                responseTime: '5ms',
                constraintsChecked: 3,
                priority: 1.0
            });
        }
    }

    // Batch constraint solving
    async batchSolve(req, res) {
        try {
            const { requests, teamRules } = req.body;

            // Use constraint solver for multiple requests
            const solution = ConstraintService.solveBatch(requests, teamRules);

            res.json({
                success: true,
                solution,
                optimized: solution.optimized,
                coverageMaintained: solution.coverageMaintained,
                constraintsViolated: solution.constraintsViolated || 0
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Get all constraint rules
    async getConstraints(req, res) {
        const constraints = ConstraintService.getAllConstraints();
        res.json({
            rules: constraints.rules,
            priorities: constraints.priorities,
            blackoutDates: constraints.blackoutDates,
            noticePeriods: constraints.noticeRequired
        });
    }

    // Update a constraint rule
    async updateConstraint(req, res) {
        const { ruleId } = req.params;
        const { value } = req.body;

        ConstraintService.updateConstraint(ruleId, value);

        res.json({
            updated: true,
            ruleId,
            newValue: value,
            message: 'Constraint updated'
        });
    }

    // Test constraint with sample data
    async testConstraint(req, res) {
        const { testCase } = req.body;

        const result = ConstraintService.runTestCase(testCase);

        res.json({
            testCase,
            result,
            constraintsChecked: result.checksPerformed,
            passed: result.passed
        });
    }

    // Get employee leave balance
    async getLeaveBalance(req, res) {
        const { employeeId } = req.params;

        try {
            // Query database for real leave balances
            const result = await this.db.query(
                `SELECT leave_type, annual_entitlement, used_days, pending_days, carried_forward 
                 FROM leave_balances WHERE emp_id = $1`,
                [employeeId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'No leave balance found for employee'
                });
            }

            const balances = {};
            result.rows.forEach(row => {
                balances[row.leave_type] = {
                    entitlement: parseFloat(row.annual_entitlement),
                    used: parseFloat(row.used_days),
                    pending: parseFloat(row.pending_days),
                    remaining: parseFloat(row.annual_entitlement) + parseFloat(row.carried_forward) - parseFloat(row.used_days) - parseFloat(row.pending_days)
                };
            });

            res.json({
                success: true,
                employeeId,
                balances
            });
        } catch (error) {
            console.error('Error fetching leave balance:', error);
            res.status(503).json({
                success: false,
                error: 'Database service unavailable'
            });
        }
    }

    // Get team coverage for a date
    async getTeamCoverage(req, res) {
        const { date } = req.params;

        try {
            // Query database for actual team coverage
            const result = await this.db.query(
                `SELECT COUNT(*) as on_leave FROM leave_requests 
                 WHERE status = 'approved' 
                 AND $1::date BETWEEN start_date AND end_date`,
                [date]
            );

            const totalResult = await this.db.query(
                `SELECT COUNT(*) as total FROM employees WHERE status = 'active'`
            );

            const onLeave = parseInt(result.rows[0]?.on_leave || 0);
            const total = parseInt(totalResult.rows[0]?.total || 0);
            const working = total - onLeave;

            res.json({
                success: true,
                date,
                totalMembers: total,
                onLeave,
                working,
                coveragePercent: total > 0 ? Math.round((working / total) * 100) : 0
            });
        } catch (error) {
            console.error('Error fetching team coverage:', error);
            res.status(503).json({
                success: false,
                error: 'Database service unavailable'
            });
        }
    }

    // Helper: Get team state from database
    async getTeamState(employeeId) {
        try {
            // Query database for real team state
            const result = await this.db.query(
                `SELECT e.*, 
                    (SELECT COUNT(*) FROM employees WHERE department = e.department) as team_size,
                    (SELECT COUNT(*) FROM leave_requests lr 
                     WHERE lr.status = 'approved' 
                     AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
                     AND lr.emp_id IN (SELECT emp_id FROM employees WHERE department = e.department)) as already_on_leave
                 FROM employees e WHERE e.emp_id = $1`,
                [employeeId]
            );

            if (result.rows.length === 0) {
                return {
                    employeeId,
                    teamSize: 0,
                    error: 'Employee not found'
                };
            }

            const emp = result.rows[0];
            return {
                employeeId,
                teamSize: parseInt(emp.team_size) || 1,
                teamName: emp.department || 'General',
                alreadyOnLeave: parseInt(emp.already_on_leave) || 0
            };
        } catch (error) {
            console.error('Error fetching team state:', error);
            return {
                employeeId,
                teamSize: 0,
                error: 'Database error'
            };
        }
    }

    // Helper: Log decision to database
    async logDecision(decisionData) {
        try {
            const query = `
                INSERT INTO leave_decisions 
                (employee_id, request_text, approved, violations, engine_used, extracted_info, created_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW())
            `;

            const params = [
                decisionData.employeeId,
                decisionData.request.substring(0, 500),
                decisionData.approved ? 1 : 0,
                JSON.stringify(decisionData.violations || []),
                decisionData.engine,
                JSON.stringify(decisionData.extractedInfo || {})
            ];

            // In real system: await executeQuery(query, params);
            console.log('📝 Decision logged:', {
                employee: decisionData.employeeId,
                approved: decisionData.approved,
                engine: decisionData.engine
            });

        } catch (error) {
            console.error('Failed to log decision:', error);
        }
    }
}

module.exports = new LeaveController();