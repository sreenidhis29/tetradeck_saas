const API_BASE = 'http://localhost:5000/api';

// Main function called from HTML
window.checkLeaveConstraints = async function (requestText) {
    try {
        console.log('🚀 Sending request for constraint analysis...');

        // Get token from localStorage
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        if (!token) {
            throw new Error('Not authenticated. Please login.');
        }

        // Get employee ID from stored user
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const employeeId = user.emp_id || user.employeeId || 'EMP001';

        const response = await fetch(`${API_BASE}/leaves/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                request: requestText,
                employeeId: employeeId
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.message || errData.error || 'Server error');
        }

        const data = await response.json();
        console.log('✅ Result received:', data);

        // Format violations array safely
        let violationsList = [];
        if (data.violations && Array.isArray(data.violations)) {
            violationsList = data.violations;
        } else if (data.constraintResults && data.constraintResults.violations) {
            violationsList = data.constraintResults.violations.map(v => 
                `${v.rule_id}: ${v.rule_name}`
            );
        }

        // Display mapping for the detailed UI
        window.displayResult({
            approved: data.approved,
            message: data.message || (data.approved ? '✅ Leave Approved' : '❌ Leave Escalated'),
            details: data.details || data.decisionReason || '',
            violations: violationsList,
            engine: data.engine || 'Constraint Engine v1.0',
            responseTime: data.responseTime || '0ms',
            constraintsChecked: data.constraintResults ? 
                `${data.constraintResults.passed}/${data.constraintResults.total_rules} passed` : '14+ rules',
            priority: data.approved ? '3.0' : '1.0',
            history: {
                employee: data.employee || 'Unknown',
                department: data.department || 'Unknown',
                team: data.team || 'Unknown',
                balance: data.leaveBalance ? `${data.leaveBalance.remaining} days remaining` : 'Unknown'
            },
            suggestions: data.suggestions || [],
            alternativeDates: data.alternativeDates || []
        });

    } catch (error) {
        console.error('❌ Error:', error);
        window.displayResult({
            approved: false,
            message: '⚠️ Service Error',
            details: error.message,
            violations: ['Failed to reach backend analysis services'],
            engine: 'Frontend Fallback',
            responseTime: '0ms',
            constraintsChecked: '0'
        });
    }
};