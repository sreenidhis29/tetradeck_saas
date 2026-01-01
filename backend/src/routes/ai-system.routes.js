const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');
const axios = require('axios');

/**
 * GET /api/ai-system/status
 * Get real-time AI agent status with actual health checks
 */
router.get('/status', authenticateToken, authorize('admin'), async (req, res) => {
    try {
        // Get current modes from ai_system_config table (config_key/config_value format)
        const configs = await db.query(
            "SELECT config_key, config_value FROM ai_system_config WHERE config_key LIKE '%_mode'"
        );
        
        const modeMap = {};
        if (Array.isArray(configs)) {
            configs.forEach(c => {
                modeMap[c.config_key] = c.config_value;
            });
        }

        // AI Service endpoints to check
        const services = [
            { type: 'leave', port: 8001, url: 'http://localhost:8001' },
            { type: 'onboarding', port: 8002, url: 'http://localhost:8002' },
            { type: 'performance', port: 8003, url: 'http://localhost:8003' },
            { type: 'recruitment', port: 8004, url: 'http://localhost:8004' }
        ];

        const agents = [];

        for (const svc of services) {
            const startTime = Date.now();
            let status = 'offline';
            let health = 'Not Running';
            let responseTime = null;

            try {
                const response = await axios.get(`${svc.url}/health`, { timeout: 2000 });
                status = 'online';
                health = response.data?.status || 'Healthy';
                responseTime = Date.now() - startTime;
            } catch (error) {
                status = 'offline';
                health = error.code === 'ECONNREFUSED' ? 'Service Not Running' : error.message;
            }

            agents.push({
                type: svc.type,
                port: svc.port,
                status: status,
                health: health,
                mode: modeMap[`${svc.type}_mode`] || 'manual',
                response_time: responseTime
            });
        }

        res.json({
            success: true,
            agents: agents,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('AI Status Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/ai-system/toggle-mode
 * Toggle AI agent between auto/manual mode
 */
router.post('/toggle-mode', authenticateToken, authorize('admin'), async (req, res) => {
    try {
        const { agent_type, mode } = req.body;

        // Validate input
        if (!['leave', 'onboarding', 'recruitment', 'performance'].includes(agent_type)) {
            return res.status(400).json({ success: false, error: 'Invalid agent type' });
        }

        if (!['auto', 'manual'].includes(mode)) {
            return res.status(400).json({ success: false, error: 'Mode must be auto or manual' });
        }

        const configKey = `${agent_type}_mode`;

        // Check if config exists
        const existing = await db.query(
            'SELECT id FROM ai_system_config WHERE config_key = ?',
            [configKey]
        );

        if (existing && existing.length > 0) {
            // Update existing config
            await db.execute(
                'UPDATE ai_system_config SET config_value = ?, updated_by = ?, updated_at = NOW() WHERE config_key = ?',
                [mode, req.user.id, configKey]
            );
        } else {
            // Insert new config
            await db.execute(
                'INSERT INTO ai_system_config (config_key, config_value, description, updated_by) VALUES (?, ?, ?, ?)',
                [configKey, mode, `${agent_type} AI agent operation mode`, req.user.id]
            );
        }

        // Log the mode change (using correct column names: level not log_level)
        await db.execute(
            'INSERT INTO ai_agent_logs (agent_type, level, message, metadata) VALUES (?, ?, ?, ?)',
            [agent_type, 'info', `Mode changed to ${mode.toUpperCase()} by admin`, JSON.stringify({ user_id: req.user.id, new_mode: mode })]
        );

        res.json({
            success: true,
            message: `${agent_type} agent set to ${mode} mode`,
            agent_type: agent_type,
            mode: mode
        });
    } catch (error) {
        console.error('Toggle Mode Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/ai-system/logs
 * Get real AI agent logs from database
 */
router.get('/logs', authenticateToken, authorize('admin'), async (req, res) => {
    try {
        const { agent_type, level, limit = 50 } = req.query;

        // Build query using correct column names
        let query = 'SELECT id, agent_type, level, message, metadata, created_at FROM ai_agent_logs WHERE 1=1';
        const params = [];

        if (agent_type) {
            query += ' AND agent_type = ?';
            params.push(agent_type);
        }

        if (level) {
            query += ' AND level = ?';
            params.push(level);
        }

        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const logs = await db.query(query, params);

        // Return array directly for easier frontend consumption
        res.json(logs || []);
    } catch (error) {
        console.error('Logs Error:', error);
        res.status(500).json([]);
    }
});

/**
 * GET /api/ai-system/decisions
 * Get AI leave decisions with employee info
 */
router.get('/decisions', authenticateToken, authorize('admin'), async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        // Using actual table structure: employee_id, decision, confidence, reasoning, created_at
        const decisions = await db.query(`
            SELECT 
                ld.id,
                ld.leave_request_id,
                ld.decision,
                ld.confidence,
                ld.reasoning,
                ld.created_at,
                CONCAT(e.first_name, ' ', e.last_name) as employee_name
            FROM leave_decisions ld
            LEFT JOIN employees e ON ld.employee_id = e.id
            ORDER BY ld.created_at DESC
            LIMIT ?
        `, [parseInt(limit)]);

        // Return array directly
        res.json(decisions || []);
    } catch (error) {
        console.error('Decisions Error:', error);
        res.status(500).json([]);
    }
});

/**
 * GET /api/ai-system/metrics
 * Get system metrics from database
 */
router.get('/metrics', authenticateToken, authorize('admin'), async (req, res) => {
    try {
        // Get database stats
        const dbStats = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM leave_decisions) as total_decisions,
                (SELECT COUNT(*) FROM ai_agent_logs) as total_logs,
                (SELECT COUNT(*) FROM ai_agent_logs WHERE level = 'error') as error_count,
                (SELECT COUNT(*) FROM leave_decisions WHERE decision = 'approved') as approved_count,
                (SELECT COUNT(*) FROM leave_decisions WHERE decision = 'rejected') as rejected_count
        `);

        res.json({
            success: true,
            metrics: dbStats && dbStats[0] ? dbStats[0] : {},
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Metrics Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * POST /api/ai-system/log
 * Create a new log entry (used by AI agents - no auth required for internal calls)
 */
router.post('/log', async (req, res) => {
    try {
        const { agent_type, level, message, metadata } = req.body;

        await db.execute(
            'INSERT INTO ai_agent_logs (agent_type, level, message, metadata) VALUES (?, ?, ?, ?)',
            [agent_type, level || 'info', message, metadata ? JSON.stringify(metadata) : null]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Log Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
