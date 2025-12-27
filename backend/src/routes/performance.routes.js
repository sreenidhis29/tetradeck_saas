const express = require('express');
const router = express.Router();
const db = require('../config/db');
const axios = require('axios');
const { authenticateToken } = require('../middleware/authMiddleware');

// =====================================================
// PERFORMANCE MANAGEMENT ROUTES
// =====================================================

/**
 * GET /api/performance/cycles
 * Get all performance cycles (HR/Admin)
 */
router.get('/cycles', authenticateToken, async (req, res) => {
    try {
        const [cycles] = await db.execute(`
            SELECT c.*,
                   (SELECT COUNT(*) FROM performance_reviews WHERE cycle_id = c.cycle_id) as review_count,
                   (SELECT COUNT(*) FROM performance_goals WHERE cycle_id = c.cycle_id) as goal_count
            FROM performance_cycles c
            ORDER BY c.start_date DESC
        `);
        res.json({ success: true, cycles });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/performance/employee/:empId/goals
 * Get goals for an employee
 */
router.get('/employee/:empId/goals', authenticateToken, async (req, res) => {
    try {
        const [goals] = await db.execute(`
            SELECT g.*, c.cycle_name,
                   ROUND((g.current_value / g.target_value) * 100, 1) as progress_percentage
            FROM performance_goals g
            JOIN performance_cycles c ON g.cycle_id = c.cycle_id
            WHERE g.emp_id = ?
            ORDER BY g.due_date ASC
        `, [req.params.empId]);
        
        res.json({ success: true, goals });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/performance/goals
 * Create a new goal
 */
router.post('/goals', authenticateToken, async (req, res) => {
    const { emp_id, cycle_id, goal_title, goal_description, goal_type, category, 
            target_metric, target_value, weight_percentage, due_date } = req.body;
    
    try {
        const [result] = await db.execute(`
            INSERT INTO performance_goals 
            (emp_id, cycle_id, goal_title, goal_description, goal_type, category,
             target_metric, target_value, weight_percentage, status, due_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
        `, [emp_id, cycle_id, goal_title, goal_description, goal_type, category,
            target_metric, target_value, weight_percentage, due_date]);
        
        res.json({ success: true, goal_id: result.insertId, message: 'Goal created' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/performance/goals/:goalId
 * Update goal progress
 */
router.put('/goals/:goalId', authenticateToken, async (req, res) => {
    const { current_value, status, approved_by } = req.body;
    
    try {
        let query = 'UPDATE performance_goals SET';
        const updates = [];
        const values = [];
        
        if (current_value !== undefined) {
            updates.push(' current_value = ?');
            values.push(current_value);
        }
        if (status) {
            updates.push(' status = ?');
            values.push(status);
        }
        if (approved_by && status === 'approved') {
            updates.push(' approved_by = ?, approved_at = NOW()');
            values.push(approved_by);
        }
        
        query += updates.join(',') + ' WHERE goal_id = ?';
        values.push(req.params.goalId);
        
        await db.execute(query, values);
        res.json({ success: true, message: 'Goal updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/performance/employee/:empId/review
 * Get performance review for an employee
 */
router.get('/employee/:empId/review', authenticateToken, async (req, res) => {
    const { cycle_id } = req.query;
    
    try {
        const [reviews] = await db.execute(`
            SELECT r.*, c.cycle_name,
                   e.full_name as employee_name, e.department,
                   rev.full_name as reviewer_name
            FROM performance_reviews r
            JOIN performance_cycles c ON r.cycle_id = c.cycle_id
            JOIN employees e ON r.emp_id = e.emp_id
            LEFT JOIN employees rev ON r.reviewer_id = rev.emp_id
            WHERE r.emp_id = ? ${cycle_id ? 'AND r.cycle_id = ?' : ''}
            ORDER BY r.created_at DESC
        `, cycle_id ? [req.params.empId, cycle_id] : [req.params.empId]);
        
        res.json({ success: true, reviews });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/performance/review
 * Create/Submit performance review
 */
router.post('/review', authenticateToken, async (req, res) => {
    const { emp_id, cycle_id, reviewer_id, review_type, overall_rating, goals_rating,
            competencies_rating, strengths, areas_for_improvement, achievements,
            development_plan, manager_comments } = req.body;
    
    try {
        // Get AI analysis of the review
        let aiAnalysis = {};
        try {
            const aiRes = await axios.post('http://127.0.0.1:8003/analyze-review', {
                strengths, areas_for_improvement, achievements, overall_rating
            }, { timeout: 5000 });
            aiAnalysis = aiRes.data;
        } catch (err) {
            console.log('AI analysis skipped');
        }
        
        const [result] = await db.execute(`
            INSERT INTO performance_reviews 
            (emp_id, cycle_id, reviewer_id, review_type, overall_rating, goals_rating,
             competencies_rating, strengths, areas_for_improvement, achievements,
             development_plan, manager_comments, status, ai_analysis)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)
        `, [emp_id, cycle_id, reviewer_id, review_type, overall_rating, goals_rating,
            competencies_rating, strengths, areas_for_improvement, achievements,
            development_plan, manager_comments, JSON.stringify(aiAnalysis)]);
        
        res.json({ success: true, review_id: result.insertId, ai_analysis: aiAnalysis });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/performance/feedback
 * Give feedback to an employee
 */
router.post('/feedback', authenticateToken, async (req, res) => {
    const { emp_id, given_by, feedback_type, feedback_text, is_anonymous, visibility, related_goal_id } = req.body;
    
    try {
        // Analyze sentiment
        let sentiment = 'neutral';
        try {
            const aiRes = await axios.post('http://127.0.0.1:8003/analyze-sentiment', {
                text: feedback_text
            }, { timeout: 3000 });
            sentiment = aiRes.data.sentiment;
        } catch (err) {
            // Simple fallback sentiment
            const positiveWords = ['great', 'excellent', 'good', 'amazing', 'fantastic'];
            const negativeWords = ['poor', 'bad', 'needs improvement', 'lacking'];
            const lower = feedback_text.toLowerCase();
            if (positiveWords.some(w => lower.includes(w))) sentiment = 'positive';
            else if (negativeWords.some(w => lower.includes(w))) sentiment = 'negative';
        }
        
        const [result] = await db.execute(`
            INSERT INTO performance_feedback 
            (emp_id, given_by, feedback_type, feedback_text, is_anonymous, visibility, related_goal_id, ai_sentiment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [emp_id, given_by, feedback_type, feedback_text, is_anonymous, visibility, related_goal_id, sentiment]);
        
        res.json({ success: true, feedback_id: result.insertId, sentiment });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/performance/employee/:empId/feedback
 * Get feedback received by an employee
 */
router.get('/employee/:empId/feedback', authenticateToken, async (req, res) => {
    try {
        const [feedback] = await db.execute(`
            SELECT f.*,
                   CASE WHEN f.is_anonymous THEN 'Anonymous' ELSE e.full_name END as given_by_name
            FROM performance_feedback f
            LEFT JOIN employees e ON f.given_by = e.emp_id
            WHERE f.emp_id = ?
            ORDER BY f.created_at DESC
        `, [req.params.empId]);
        
        res.json({ success: true, feedback });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/performance/hr/dashboard
 * HR Performance Dashboard
 */
router.get('/hr/dashboard', authenticateToken, async (req, res) => {
    try {
        // Active cycle stats
        const [cycleStats] = await db.execute(`
            SELECT c.cycle_id, c.cycle_name, c.status,
                   COUNT(DISTINCT g.emp_id) as employees_with_goals,
                   COUNT(DISTINCT r.emp_id) as reviews_completed,
                   AVG(r.overall_rating) as avg_rating
            FROM performance_cycles c
            LEFT JOIN performance_goals g ON c.cycle_id = g.cycle_id
            LEFT JOIN performance_reviews r ON c.cycle_id = r.cycle_id AND r.status = 'finalized'
            WHERE c.status = 'active'
            GROUP BY c.cycle_id
        `);
        
        // Rating distribution
        const [ratingDist] = await db.execute(`
            SELECT 
                CASE 
                    WHEN overall_rating >= 4.5 THEN 'Exceptional'
                    WHEN overall_rating >= 3.5 THEN 'Exceeds Expectations'
                    WHEN overall_rating >= 2.5 THEN 'Meets Expectations'
                    WHEN overall_rating >= 1.5 THEN 'Needs Improvement'
                    ELSE 'Unsatisfactory'
                END as rating_category,
                COUNT(*) as count
            FROM performance_reviews
            WHERE cycle_id = (SELECT cycle_id FROM performance_cycles WHERE status = 'active' LIMIT 1)
            AND status IN ('submitted', 'finalized')
            GROUP BY rating_category
        `);
        
        // Department averages
        const [deptAvg] = await db.execute(`
            SELECT e.department, 
                   AVG(r.overall_rating) as avg_rating,
                   COUNT(*) as review_count
            FROM performance_reviews r
            JOIN employees e ON r.emp_id = e.emp_id
            WHERE r.cycle_id = (SELECT cycle_id FROM performance_cycles WHERE status = 'active' LIMIT 1)
            GROUP BY e.department
        `);
        
        res.json({ 
            success: true, 
            dashboard: {
                cycle_stats: cycleStats,
                rating_distribution: ratingDist,
                department_averages: deptAvg
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/performance/competencies
 * Get competency framework
 */
router.get('/competencies', authenticateToken, async (req, res) => {
    try {
        const [competencies] = await db.execute(`
            SELECT * FROM competency_framework ORDER BY category, competency_name
        `);
        res.json({ success: true, competencies });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/performance/calibration
 * Schedule calibration session (HR)
 */
router.post('/calibration', authenticateToken, async (req, res) => {
    const { cycle_id, department, calibration_date, participants } = req.body;
    
    try {
        const [result] = await db.execute(`
            INSERT INTO performance_calibration 
            (cycle_id, department, calibration_date, participants, status)
            VALUES (?, ?, ?, ?, 'scheduled')
        `, [cycle_id, department, calibration_date, JSON.stringify(participants)]);
        
        res.json({ success: true, calibration_id: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/performance/predict
 * AI performance prediction
 */
router.post('/predict', authenticateToken, async (req, res) => {
    const { employeeId } = req.body;
    try {
        const axios = require('axios');
        const aiRes = await axios.post('http://127.0.0.1:8003/predict', { employeeId }, { timeout: 15000 });
        res.json(aiRes.data);
    } catch (error) {
        res.status(503).json({ 
            success: false, 
            error: 'AI service unavailable. Ensure performance AI service is running on port 8003.'
        });
    }
});

/**
 * POST /api/performance/risk
 * AI retention risk assessment
 */
router.post('/risk', authenticateToken, async (req, res) => {
    const { employeeId } = req.body;
    try {
        const axios = require('axios');
        const aiRes = await axios.post('http://127.0.0.1:8003/risk', { employeeId }, { timeout: 15000 });
        res.json(aiRes.data);
    } catch (error) {
        res.status(503).json({ 
            success: false, 
            error: 'AI service unavailable. Ensure performance AI service is running on port 8003.'
        });
    }
});

/**
 * POST /api/performance/plan
 * AI development plan generation
 */
router.post('/plan', authenticateToken, async (req, res) => {
    const { employeeId, goals } = req.body;
    try {
        const axios = require('axios');
        const aiRes = await axios.post('http://127.0.0.1:8003/plan', { employeeId, goals }, { timeout: 15000 });
        res.json(aiRes.data);
    } catch (error) {
        res.status(503).json({ 
            success: false, 
            error: 'AI service unavailable. Ensure performance AI service is running on port 8003.'
        });
    }
});

/**
 * POST /api/performance/promotion
 * AI promotion readiness evaluation
 */
router.post('/promotion', authenticateToken, async (req, res) => {
    const { employeeId } = req.body;
    try {
        const axios = require('axios');
        const aiRes = await axios.post('http://127.0.0.1:8003/promotion', { employeeId }, { timeout: 15000 });
        res.json(aiRes.data);
    } catch (error) {
        res.status(503).json({ 
            success: false, 
            error: 'AI service unavailable. Ensure performance AI service is running on port 8003.'
        });
    }
});

/**
 * POST /api/performance/reviews
 * Save performance review
 */
router.post('/reviews', authenticateToken, async (req, res) => {
    const { employeeId, review_period, rating, comments, goals_achieved } = req.body;
    try {
        const result = await db.query(`
            INSERT INTO performance_reviews 
            (emp_id, review_period, rating, comments, goals_achieved, reviewer_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        `, [employeeId, review_period, rating, comments, goals_achieved || 0, req.user?.emp_id || 'HR001']);
        
        res.json({ 
            success: true, 
            message: 'Performance review saved',
            review_id: result.insertId
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
