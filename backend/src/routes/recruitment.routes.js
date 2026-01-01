const express = require('express');
const router = express.Router();
const db = require('../config/db');
const axios = require('axios');
const { authenticateToken } = require('../middleware/authMiddleware');

// =====================================================
// RECRUITMENT MANAGEMENT ROUTES
// =====================================================

/**
 * GET /api/recruitment/jobs
 * Get all job postings
 */
router.get('/jobs', authenticateToken, async (req, res) => {
    try {
        const { status, department } = req.query;
        let query = `
            SELECT j.*,
                   e.full_name as hiring_manager_name,
                   (SELECT COUNT(*) FROM candidates WHERE job_id = j.job_id) as applicant_count
            FROM job_postings j
            LEFT JOIN employees e ON j.hiring_manager = e.emp_id
            WHERE 1=1
        `;
        const params = [];
        
        if (status) {
            query += ' AND j.status = ?';
            params.push(status);
        }
        if (department) {
            query += ' AND j.department = ?';
            params.push(department);
        }
        
        query += ' ORDER BY j.posted_date DESC';
        
        const [jobs] = await db.execute(query, params);
        res.json({ success: true, jobs });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/recruitment/jobs
 * Create a new job posting
 */
router.post('/jobs', authenticateToken, async (req, res) => {
    const { job_title, department, location, employment_type, experience_min, experience_max,
            salary_min, salary_max, job_description, requirements, nice_to_have,
            skills_required, hiring_manager, headcount } = req.body;
    
    try {
        const [result] = await db.execute(`
            INSERT INTO job_postings 
            (job_title, department, location, employment_type, experience_min, experience_max,
             salary_min, salary_max, job_description, requirements, nice_to_have,
             skills_required, hiring_manager, headcount, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
        `, [job_title, department, location, employment_type, experience_min || 0, experience_max || 10,
            salary_min, salary_max, job_description, requirements, nice_to_have,
            JSON.stringify(skills_required), hiring_manager, headcount || 1]);
        
        res.json({ success: true, job_id: result.insertId, message: 'Job posting created' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/recruitment/jobs/:jobId
 * Update job posting
 */
router.put('/jobs/:jobId', authenticateToken, async (req, res) => {
    const { status, ...updateData } = req.body;
    
    try {
        if (status) {
            await db.execute(`UPDATE job_postings SET status = ? WHERE job_id = ?`, 
                [status, req.params.jobId]);
        }
        
        if (Object.keys(updateData).length > 0) {
            const fields = Object.keys(updateData).map(k => `${k} = ?`).join(', ');
            const values = Object.values(updateData);
            values.push(req.params.jobId);
            await db.execute(`UPDATE job_postings SET ${fields} WHERE job_id = ?`, values);
        }
        
        res.json({ success: true, message: 'Job posting updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/recruitment/candidates
 * Get candidates with filtering
 */
router.get('/candidates', authenticateToken, async (req, res) => {
    try {
        const { job_id, status, stage } = req.query;
        let query = `
            SELECT c.*, j.job_title
            FROM candidates c
            JOIN job_postings j ON c.job_id = j.job_id
            WHERE 1=1
        `;
        const params = [];
        
        if (job_id) {
            query += ' AND c.job_id = ?';
            params.push(job_id);
        }
        if (status) {
            query += ' AND c.status = ?';
            params.push(status);
        }
        if (stage) {
            query += ' AND c.current_stage = ?';
            params.push(stage);
        }
        
        query += ' ORDER BY c.ai_match_score DESC, c.applied_date DESC';
        
        const [candidates] = await db.execute(query, params);
        res.json({ success: true, candidates });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/recruitment/candidates
 * Add new candidate (apply for job)
 */
router.post('/candidates', authenticateToken, async (req, res) => {
    const { job_id, full_name, email, phone, resume_url, linkedin_url, portfolio_url,
            years_of_experience, current_company, current_role, expected_salary, 
            notice_period, skills, education, source } = req.body;
    
    try {
        // Get job requirements for AI screening
        const [jobs] = await db.execute(
            'SELECT skills_required, requirements FROM job_postings WHERE job_id = ?', 
            [job_id]
        );
        
        let aiScreening = { match_score: 0, analysis: 'AI screening pending' };
        
        if (jobs.length > 0) {
            try {
                const aiRes = await axios.post('http://127.0.0.1:8004/screen-candidate', {
                    candidate: { skills, years_of_experience, education, current_role },
                    job: jobs[0]
                }, { timeout: 5000 });
                aiScreening = aiRes.data;
            } catch (err) {
                // Calculate basic match score without AI
                const jobSkills = JSON.parse(jobs[0].skills_required || '[]');
                const candidateSkills = skills || [];
                const matchCount = candidateSkills.filter(s => 
                    jobSkills.some(js => js.toLowerCase().includes(s.toLowerCase()))
                ).length;
                aiScreening.match_score = Math.min(95, (matchCount / Math.max(jobSkills.length, 1)) * 100);
            }
        }
        
        const [result] = await db.execute(`
            INSERT INTO candidates 
            (job_id, full_name, email, phone, resume_url, linkedin_url, portfolio_url,
             years_of_experience, current_company, current_role, expected_salary,
             notice_period, skills, education, source, ai_match_score, ai_screening_notes, current_stage, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'screening', 'active')
        `, [job_id, full_name, email, phone, resume_url, linkedin_url, portfolio_url,
            years_of_experience, current_company, current_role, expected_salary,
            notice_period, JSON.stringify(skills), education, source, 
            aiScreening.match_score, aiScreening.analysis]);
        
        res.json({ 
            success: true, 
            candidate_id: result.insertId,
            ai_screening: aiScreening,
            message: 'Candidate added successfully' 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/recruitment/candidates/:candidateId/stage
 * Move candidate to next stage
 */
router.put('/candidates/:candidateId/stage', authenticateToken, async (req, res) => {
    const { stage, status, notes } = req.body;
    
    try {
        await db.execute(`
            UPDATE candidates 
            SET current_stage = ?, status = COALESCE(?, status), updated_at = NOW()
            WHERE candidate_id = ?
        `, [stage, status, req.params.candidateId]);
        
        // Log stage change
        await db.execute(`
            INSERT INTO candidate_stage_history (candidate_id, stage, notes, changed_by)
            VALUES (?, ?, ?, ?)
        `, [req.params.candidateId, stage, notes, req.user?.emp_id || 1]);
        
        res.json({ success: true, message: `Candidate moved to ${stage}` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/recruitment/interviews
 * Schedule interview
 */
router.post('/interviews', authenticateToken, async (req, res) => {
    const { candidate_id, job_id, interview_type, interview_round, scheduled_date,
            duration_minutes, interviewer_ids, location, meeting_link, interview_template } = req.body;
    
    try {
        const [result] = await db.execute(`
            INSERT INTO interviews 
            (candidate_id, job_id, interview_type, interview_round, scheduled_date,
             duration_minutes, interviewer_ids, location, meeting_link, interview_template, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
        `, [candidate_id, job_id, interview_type, interview_round, scheduled_date,
            duration_minutes, JSON.stringify(interviewer_ids), location, meeting_link, interview_template]);
        
        // Update candidate stage to interview
        await db.execute(`
            UPDATE candidates SET current_stage = ? WHERE candidate_id = ?
        `, [`interview_${interview_round}`, candidate_id]);
        
        res.json({ success: true, interview_id: result.insertId, message: 'Interview scheduled' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/recruitment/interviews/:candidateId
 * Get interviews for a candidate
 */
router.get('/interviews/:candidateId', authenticateToken, async (req, res) => {
    try {
        const [interviews] = await db.execute(`
            SELECT i.*,
                   c.full_name as candidate_name,
                   j.job_title
            FROM interviews i
            JOIN candidates c ON i.candidate_id = c.candidate_id
            JOIN job_postings j ON i.job_id = j.job_id
            WHERE i.candidate_id = ?
            ORDER BY i.interview_round ASC
        `, [req.params.candidateId]);
        
        res.json({ success: true, interviews });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/recruitment/scorecard
 * Submit interview scorecard
 */
router.post('/scorecard', authenticateToken, async (req, res) => {
    const { interview_id, interviewer_id, technical_score, communication_score,
            problem_solving_score, cultural_fit_score, overall_score, strengths,
            concerns, questions_asked, recommendation, detailed_notes } = req.body;
    
    try {
        // Check for bias in feedback
        let biasCheck = { has_bias: false, flags: [] };
        try {
            const aiRes = await axios.post('http://127.0.0.1:8004/check-bias', {
                feedback: { strengths, concerns, detailed_notes }
            }, { timeout: 3000 });
            biasCheck = aiRes.data;
        } catch (err) {
            // Basic bias check
            const biasTerms = ['young', 'old', 'he', 'she', 'culture fit', 'not a good fit'];
            const allText = `${strengths} ${concerns} ${detailed_notes}`.toLowerCase();
            biasCheck.flags = biasTerms.filter(t => allText.includes(t));
            biasCheck.has_bias = biasCheck.flags.length > 0;
        }
        
        const [result] = await db.execute(`
            INSERT INTO interview_scorecards 
            (interview_id, interviewer_id, technical_score, communication_score,
             problem_solving_score, cultural_fit_score, overall_score, strengths,
             concerns, questions_asked, recommendation, detailed_notes, bias_check_result)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [interview_id, interviewer_id, technical_score, communication_score,
            problem_solving_score, cultural_fit_score, overall_score, strengths,
            concerns, questions_asked, recommendation, detailed_notes, JSON.stringify(biasCheck)]);
        
        // Update interview status
        await db.execute(`UPDATE interviews SET status = 'completed' WHERE interview_id = ?`, [interview_id]);
        
        res.json({ 
            success: true, 
            scorecard_id: result.insertId,
            bias_check: biasCheck,
            message: biasCheck.has_bias ? 'Scorecard saved. Please review potential bias flags.' : 'Scorecard submitted'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/recruitment/offer
 * Create offer for candidate
 */
router.post('/offer', authenticateToken, async (req, res) => {
    const { candidate_id, job_id, salary_offered, bonus, equity, start_date,
            benefits_package, offer_details, valid_until, created_by } = req.body;
    
    try {
        const [result] = await db.execute(`
            INSERT INTO offers 
            (candidate_id, job_id, salary_offered, bonus, equity, start_date,
             benefits_package, offer_details, valid_until, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
        `, [candidate_id, job_id, salary_offered, bonus, equity, start_date,
            benefits_package, offer_details, valid_until, created_by]);
        
        res.json({ success: true, offer_id: result.insertId, message: 'Offer created' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/recruitment/offer/:offerId
 * Update offer status (send, accept, decline, negotiate)
 */
router.put('/offer/:offerId', authenticateToken, async (req, res) => {
    const { status, response_notes, negotiation_details } = req.body;
    
    try {
        let updateFields = 'status = ?';
        const values = [status];
        
        if (status === 'sent') {
            updateFields += ', sent_at = NOW()';
        } else if (status === 'accepted') {
            updateFields += ', accepted_at = NOW()';
        } else if (status === 'declined') {
            updateFields += ', declined_at = NOW(), response_notes = ?';
            values.push(response_notes);
        } else if (status === 'negotiating') {
            updateFields += ', negotiation_details = ?';
            values.push(negotiation_details);
        }
        
        values.push(req.params.offerId);
        await db.execute(`UPDATE offers SET ${updateFields} WHERE offer_id = ?`, values);
        
        // If accepted, update candidate and create onboarding
        if (status === 'accepted') {
            const [offers] = await db.execute(
                'SELECT candidate_id, job_id FROM offers WHERE offer_id = ?', 
                [req.params.offerId]
            );
            
            if (offers.length > 0) {
                await db.execute(
                    `UPDATE candidates SET status = 'hired', current_stage = 'hired' WHERE candidate_id = ?`,
                    [offers[0].candidate_id]
                );
            }
        }
        
        res.json({ success: true, message: `Offer ${status}` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/recruitment/hr/dashboard
 * HR Recruitment Dashboard
 */
router.get('/hr/dashboard', authenticateToken, async (req, res) => {
    try {
        // Pipeline summary
        const [pipeline] = await db.execute(`
            SELECT current_stage, COUNT(*) as count
            FROM candidates
            WHERE status = 'active'
            GROUP BY current_stage
        `);
        
        // Open positions
        const [openPositions] = await db.execute(`
            SELECT j.job_id, j.job_title, j.department, j.positions_available,
                   COUNT(c.candidate_id) as applicants,
                   AVG(c.ai_match_score) as avg_match_score
            FROM job_postings j
            LEFT JOIN candidates c ON j.job_id = c.job_id AND c.status = 'active'
            WHERE j.status IN ('published', 'active')
            GROUP BY j.job_id
        `);
        
        // Time to hire metrics
        const [metrics] = await db.execute(`
            SELECT 
                AVG(DATEDIFF(c.updated_at, c.applied_date)) as avg_days_in_pipeline,
                COUNT(CASE WHEN c.status = 'hired' THEN 1 END) as total_hired,
                COUNT(*) as total_candidates
            FROM candidates c
            WHERE c.applied_date >= DATE_SUB(NOW(), INTERVAL 90 DAY)
        `);
        
        // Recent activity
        const [recentActivity] = await db.execute(`
            SELECT 'interview' as type, i.scheduled_date as date, 
                   c.full_name, j.job_title
            FROM interviews i
            JOIN candidates c ON i.candidate_id = c.candidate_id
            JOIN job_postings j ON i.job_id = j.job_id
            WHERE i.scheduled_date >= NOW()
            ORDER BY i.scheduled_date ASC
            LIMIT 10
        `);
        
        res.json({
            success: true,
            dashboard: {
                pipeline,
                open_positions: openPositions,
                metrics: metrics[0],
                recent_activity: recentActivity
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/recruitment/ai/ask
 * Ask recruitment AI questions
 */
router.post('/ai/ask', authenticateToken, async (req, res) => {
    const { question, context } = req.body;
    
    try {
        const aiRes = await axios.post('http://127.0.0.1:8004/ask', {
            question, context
        }, { timeout: 10000 });
        
        res.json({ success: true, answer: aiRes.data.answer });
    } catch (error) {
        res.json({ 
            success: true, 
            answer: "I can help with recruitment questions about job postings, candidate screening, interview processes, and hiring decisions. Please check that the AI recruitment service is running."
        });
    }
});

/**
 * POST /api/recruitment/score
 * AI-powered candidate scoring
 */
router.post('/score', authenticateToken, async (req, res) => {
    const { candidateId, resume } = req.body;
    
    try {
        const aiRes = await axios.post('http://127.0.0.1:8004/score', {
            candidateId, resume
        }, { timeout: 15000 });
        res.json(aiRes.data);
    } catch (error) {
        // Return error to frontend - no simulation
        res.status(503).json({ 
            success: false, 
            error: 'AI service unavailable. Ensure recruitment RAG service is running on port 8004.'
        });
    }
});

/**
 * POST /api/recruitment/questions
 * AI-generated interview questions
 */
router.post('/questions', authenticateToken, async (req, res) => {
    const { role, skills, candidateId } = req.body;
    
    try {
        const aiRes = await axios.post('http://127.0.0.1:8004/questions', {
            role, skills, candidateId
        }, { timeout: 15000 });
        res.json(aiRes.data);
    } catch (error) {
        res.status(503).json({ 
            success: false, 
            error: 'AI service unavailable. Ensure recruitment RAG service is running on port 8004.'
        });
    }
});

/**
 * POST /api/recruitment/salary
 * AI salary recommendation
 */
router.post('/salary', authenticateToken, async (req, res) => {
    const { experience, location, role } = req.body;
    
    try {
        const aiRes = await axios.post('http://127.0.0.1:8004/salary', {
            experience, location, role
        }, { timeout: 15000 });
        res.json(aiRes.data);
    } catch (error) {
        res.status(503).json({ 
            success: false, 
            error: 'AI service unavailable. Ensure recruitment RAG service is running on port 8004.'
        });
    }
});

/**
 * POST /api/recruitment/predict
 * AI success prediction
 */
router.post('/predict', authenticateToken, async (req, res) => {
    const { candidateId } = req.body;
    
    try {
        const aiRes = await axios.post('http://127.0.0.1:8004/predict', {
            candidateId
        }, { timeout: 15000 });
        res.json(aiRes.data);
    } catch (error) {
        res.status(503).json({ 
            success: false, 
            error: 'AI service unavailable. Ensure recruitment RAG service is running on port 8004.'
        });
    }
});

module.exports = router;
