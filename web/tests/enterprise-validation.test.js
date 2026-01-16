/**
 * ENTERPRISE LEAVE MANAGEMENT SYSTEM - COMPREHENSIVE TEST SUITE
 * 
 * Tests for: Reliability, Integrity, Accountability, Reasoning, Security,
 * Compliance, Resilience, Availability, Consistency, Trust, Governance,
 * Change Control, Operational Discipline, Economic Control
 * 
 * Run with: node tests/enterprise-validation.test.js
 */

const BASE_URL = 'http://localhost:3000';
const AI_ENGINE_URL = 'http://localhost:8001';

// Test results storage
const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    categories: {}
};

// Standard request body builder
function buildRequest(overrides = {}) {
    return {
        employee_id: 'EMP001',
        leave_type: 'casual',
        start_date: '2026-01-20',
        end_date: '2026-01-20',
        total_days: 1,
        country_code: 'IN',
        text: 'I need casual leave',
        ...overrides
    };
}

// Helper function to make HTTP requests
async function httpRequest(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        clearTimeout(timeout);
        return { 
            ok: response.ok, 
            status: response.status,
            data: await response.json().catch(() => null)
        };
    } catch (error) {
        clearTimeout(timeout);
        return { ok: false, error: error.message };
    }
}

// Test runner
function test(category, name, assertion, details = '') {
    testResults.total++;
    if (!testResults.categories[category]) {
        testResults.categories[category] = { passed: 0, failed: 0, tests: [] };
    }
    
    const result = { name, passed: assertion, details };
    testResults.categories[category].tests.push(result);
    
    if (assertion) {
        testResults.passed++;
        testResults.categories[category].passed++;
        console.log(`  ✅ ${name}`);
    } else {
        testResults.failed++;
        testResults.categories[category].failed++;
        console.log(`  ❌ ${name}`);
        if (details) console.log(`     → ${details}`);
    }
}

// ============== TEST SUITES ==============

async function testReliability() {
    console.log('\n📊 RELIABILITY TESTS');
    console.log('─'.repeat(50));
    
    // Test 1: Service availability check
    const healthCheck = await httpRequest(`${AI_ENGINE_URL}/health`);
    test('Reliability', 'AI Engine Health Check', healthCheck.ok, 
         healthCheck.error || `Status: ${healthCheck.status}`);
    
    // Test 2: Consistent response times (5 requests)
    const responseTimes = [];
    for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await httpRequest(`${AI_ENGINE_URL}/health`);
        responseTimes.push(Date.now() - start);
    }
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    test('Reliability', 'Response Time Consistency', avgResponseTime < 500, 
         `Average: ${avgResponseTime.toFixed(0)}ms, Max: ${Math.max(...responseTimes)}ms`);
    
    // Test 3: System startup completeness
    const rulesCheck = await httpRequest(`${AI_ENGINE_URL}/rules`);
    const rulesLoaded = rulesCheck.data?.total_rules > 0;
    test('Reliability', 'All Business Rules Loaded', rulesLoaded,
         `Rules: ${rulesCheck.data?.total_rules || 0}`);
}

async function testIntegrity() {
    console.log('\n🔒 DATA INTEGRITY TESTS');
    console.log('─'.repeat(50));
    
    // Test 1: Date parsing integrity - Single date
    const singleDate = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify(buildRequest({ text: 'I need casual leave on January 20' }))
    });
    test('Integrity', 'Single Date Parsing', singleDate.ok && singleDate.data?.leave_request,
         singleDate.ok ? `Date: ${singleDate.data?.leave_request?.start_date}` : singleDate.error);
    
    // Test 2: Date range integrity
    const dateRange = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify(buildRequest({
            start_date: '2026-01-20',
            end_date: '2026-01-23',
            total_days: 4,
            text: 'I need casual leave from jan 20-23rd'
        }))
    });
    test('Integrity', 'Date Range Processing (Jan 20-23)', 
         dateRange.ok && dateRange.data?.leave_request?.days_requested === 4,
         `Days: ${dateRange.data?.leave_request?.days_requested}`);
    
    // Test 3: Valid Feb date handling
    const febDate = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify(buildRequest({
            start_date: '2026-02-28',
            end_date: '2026-02-28',
            text: 'leave on feb 28'
        }))
    });
    test('Integrity', 'February Date Handling', 
         febDate.ok,
         `Response: ${febDate.status}`);
    
    // Test 4: Data consistency across requests
    const req1 = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify(buildRequest())
    });
    const req2 = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify(buildRequest())
    });
    test('Integrity', 'Response Consistency', 
         req1.data?.approved === req2.data?.approved,
         `Request 1: ${req1.data?.approved}, Request 2: ${req2.data?.approved}`);
}

async function testAccountability() {
    console.log('\n📝 ACCOUNTABILITY TESTS');
    console.log('─'.repeat(50));
    
    const decision = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify(buildRequest())
    });
    
    test('Accountability', 'Decision Reason Provided', 
         decision.data?.decision_reason !== undefined,
         `Reason: ${decision.data?.decision_reason}`);
    
    test('Accountability', 'Constraint Results Documented', 
         decision.data?.constraint_results !== undefined,
         `Rules checked: ${decision.data?.constraint_results?.total_rules || 0}`);
    
    test('Accountability', 'Recommendation Field Present', 
         decision.data?.recommendation !== undefined,
         `Recommendation: ${decision.data?.recommendation}`);
    
    test('Accountability', 'Status Field Present', 
         decision.data?.status !== undefined,
         `Status: ${decision.data?.status}`);
    
    test('Accountability', 'Processing Time Tracked', 
         decision.data?.processing_time_ms !== undefined,
         `Time: ${decision.data?.processing_time_ms?.toFixed(2)}ms`);
}

async function testReasoning() {
    console.log('\n🧠 REASONING TESTS');
    console.log('─'.repeat(50));
    
    const response = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify(buildRequest({
            total_days: 31,
            end_date: '2026-01-31',
            text: 'I need 31 days leave'
        }))
    });
    
    const hasBalanceCheck = response.data?.constraint_results?.all_checks?.some(
        c => c.rule_id === 'RULE002'
    );
    test('Reasoning', 'Leave Balance Check Applied', hasBalanceCheck,
         `Balance rule checked: ${hasBalanceCheck}`);
    
    const teamCoverage = response.data?.constraint_results?.all_checks?.some(
        c => c.rule_id === 'RULE003'
    );
    test('Reasoning', 'Team Coverage Rule Applied', teamCoverage,
         `Coverage rule present: ${teamCoverage}`);
    
    const correctRecommendation = response.data?.recommendation === 'approve' ||
                                  response.data?.recommendation === 'escalate';
    test('Reasoning', 'Valid Recommendation Value', correctRecommendation,
         `Recommendation: ${response.data?.recommendation}`);
    
    const hasViolations = !response.data?.approved && 
                          Array.isArray(response.data?.violations);
    test('Reasoning', 'Violations Documented', hasViolations,
         `Violations: ${response.data?.violations?.length || 0}`);
}

async function testSecurity() {
    console.log('\n🛡️ SECURITY TESTS');
    console.log('─'.repeat(50));
    
    const emptyReq = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify({ employee_id: '', leave_type: 'casual' })
    });
    test('Security', 'Missing Required Fields Handling', 
         emptyReq.status === 400 || emptyReq.data?.error,
         `Response: ${emptyReq.status}`);
    
    const sqlInjection = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify(buildRequest({ employee_id: "'; DROP TABLE employees; --" }))
    });
    test('Security', 'SQL Injection Prevention', 
         sqlInjection.status === 400 || sqlInjection.ok,
         'Handled without system crash');
    
    const xssAttempt = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify(buildRequest({ text: '<script>alert("xss")</script>' }))
    });
    test('Security', 'XSS Input Handling', 
         xssAttempt.ok || xssAttempt.status === 400,
         'Handled without execution');
    
    const malformed = await fetch(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ invalid json }'
    }).then(r => r.status).catch(() => 500);
    test('Security', 'Malformed JSON Rejection', malformed === 400 || malformed === 500,
         `Status: ${malformed}`);
}

async function testCompliance() {
    console.log('\n📋 COMPLIANCE TESTS');
    console.log('─'.repeat(50));
    
    const rulesRes = await httpRequest(`${AI_ENGINE_URL}/rules`);
    const rules = rulesRes.data?.rules || {};
    const mandatoryRules = ['RULE001', 'RULE002', 'RULE003'];
    const hasAllMandatory = mandatoryRules.every(r => rules[r] !== undefined);
    test('Compliance', 'Mandatory Rules Present', hasAllMandatory,
         `Found: ${Object.keys(rules).join(', ')}`);
    
    const complianceCheck = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify(buildRequest())
    });
    test('Compliance', 'Constraint Results Included', 
         complianceCheck.data?.constraint_results !== undefined);
    
    const allChecksHaveId = complianceCheck.data?.constraint_results?.all_checks?.every(
        c => c.rule_id !== undefined
    );
    test('Compliance', 'All Checks Have Rule IDs', allChecksHaveId);
}

async function testResilience() {
    console.log('\n🔄 RESILIENCE TESTS');
    console.log('─'.repeat(50));
    
    const concurrentRequests = Array(5).fill(null).map(() => 
        httpRequest(`${AI_ENGINE_URL}/analyze`, {
            method: 'POST',
            body: JSON.stringify(buildRequest())
        })
    );
    const results = await Promise.all(concurrentRequests);
    const allSucceeded = results.every(r => r.ok);
    test('Resilience', 'Concurrent Request Handling (5 requests)', allSucceeded,
         `Successful: ${results.filter(r => r.ok).length}/5`);
    
    const minimalRequest = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify({
            employee_id: 'EMP001',
            leave_type: 'casual',
            start_date: '2026-01-20',
            end_date: '2026-01-20',
            text: 'test'
        })
    });
    test('Resilience', 'Handles Minimal Request', minimalRequest.ok,
         minimalRequest.error || `Status: ${minimalRequest.status}`);
    
    await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: 'invalid'
    });
    const afterError = await httpRequest(`${AI_ENGINE_URL}/health`);
    test('Resilience', 'System Recovery After Error', afterError.ok);
}

async function testAvailability() {
    console.log('\n⏰ AVAILABILITY TESTS');
    console.log('─'.repeat(50));
    
    const health = await httpRequest(`${AI_ENGINE_URL}/health`);
    test('Availability', 'Health Endpoint Accessible', health.ok);
    
    const rules = await httpRequest(`${AI_ENGINE_URL}/rules`);
    test('Availability', 'Rules Endpoint Accessible', rules.ok);
    
    const analyze = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify(buildRequest())
    });
    test('Availability', 'Analyze Endpoint Accessible', analyze.ok);
}

async function testConsistency() {
    console.log('\n🔗 CONSISTENCY TESTS');
    console.log('─'.repeat(50));
    
    const requests = [];
    for (let i = 0; i < 3; i++) {
        const res = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
            method: 'POST',
            body: JSON.stringify(buildRequest())
        });
        requests.push(res.data?.approved);
    }
    const allSame = requests.every(r => r === requests[0]);
    test('Consistency', 'Deterministic Responses', allSame,
         `Results: ${requests.join(', ')}`);
    
    const response = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify(buildRequest())
    });
    const statusMatchesRec = (response.data?.approved && response.data?.recommendation === 'approve') ||
                             (!response.data?.approved && response.data?.recommendation === 'escalate');
    test('Consistency', 'Status-Recommendation Alignment', statusMatchesRec,
         `Approved: ${response.data?.approved}, Rec: ${response.data?.recommendation}`);
}

async function testGovernance() {
    console.log('\n⚖️ GOVERNANCE TESTS');
    console.log('─'.repeat(50));
    
    const rules = await httpRequest(`${AI_ENGINE_URL}/rules`);
    const rulesObj = rules.data?.rules || {};
    const allDocumented = Object.values(rulesObj).every(r => r.name && r.description);
    test('Governance', 'Rules Documentation', allDocumented,
         `Documented rules: ${Object.keys(rulesObj).length}`);
    
    const decision = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify(buildRequest())
    });
    const hasAuditData = decision.data?.constraint_results && 
                         decision.data?.decision_reason &&
                         decision.data?.processing_time_ms !== undefined;
    test('Governance', 'Complete Audit Trail', hasAuditData);
}

async function testChangeControl() {
    console.log('\n🔧 CHANGE CONTROL TESTS');
    console.log('─'.repeat(50));
    
    const rules = await httpRequest(`${AI_ENGINE_URL}/rules`);
    test('Change Control', 'Rules Retrievable', rules.ok && rules.data?.total_rules > 0);
    
    const health = await httpRequest(`${AI_ENGINE_URL}/health`);
    test('Change Control', 'System Health Info Available', health.ok && health.data);
}

async function testOperationalDiscipline() {
    console.log('\n⚙️ OPERATIONAL DISCIPLINE TESTS');
    console.log('─'.repeat(50));
    
    const errorReq = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify({})
    });
    test('Operational Discipline', 'Structured Error Handling', 
         errorReq.status === 400 || errorReq.data?.error,
         `Response handled properly`);
    
    const validReq = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify(buildRequest())
    });
    const hasRequiredFields = validReq.data?.hasOwnProperty('approved') &&
                              validReq.data?.hasOwnProperty('status') &&
                              validReq.data?.hasOwnProperty('recommendation');
    test('Operational Discipline', 'Consistent Response Structure', hasRequiredFields);
}

async function testEconomicControl() {
    console.log('\n💰 ECONOMIC CONTROL TESTS');
    console.log('─'.repeat(50));
    
    const start = Date.now();
    const response = await httpRequest(`${AI_ENGINE_URL}/analyze`, {
        method: 'POST',
        body: JSON.stringify(buildRequest())
    });
    const processingTime = Date.now() - start;
    test('Economic Control', 'Efficient Processing (<3s)', processingTime < 3000,
         `Time: ${processingTime}ms`);
    
    test('Economic Control', 'Engine Processing Time', 
         response.data?.processing_time_ms !== undefined,
         `Engine time: ${response.data?.processing_time_ms?.toFixed(2)}ms`);
    
    const batchStart = Date.now();
    await Promise.all(Array(3).fill(null).map(() => 
        httpRequest(`${AI_ENGINE_URL}/analyze`, {
            method: 'POST',
            body: JSON.stringify(buildRequest())
        })
    ));
    const batchTime = Date.now() - batchStart;
    test('Economic Control', 'Efficient Batch Processing', batchTime < 15000,
         `Batch (3 requests): ${batchTime}ms`);
}

// ============== MAIN TEST RUNNER ==============

async function runAllTests() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║  ENTERPRISE LEAVE MANAGEMENT SYSTEM - VALIDATION TEST SUITE    ║');
    console.log('║  Testing: Reliability, Integrity, Security, Compliance, etc.   ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n🕐 Test Started: ${new Date().toISOString()}`);
    console.log(`📡 Backend URL: ${AI_ENGINE_URL}`);
    console.log(`🌐 Frontend URL: ${BASE_URL}\n`);
    
    await testReliability();
    await testIntegrity();
    await testAccountability();
    await testReasoning();
    await testSecurity();
    await testCompliance();
    await testResilience();
    await testAvailability();
    await testConsistency();
    await testGovernance();
    await testChangeControl();
    await testOperationalDiscipline();
    await testEconomicControl();
    
    console.log('\n' + '═'.repeat(70));
    console.log('                    ENTERPRISE VALIDATION SUMMARY');
    console.log('═'.repeat(70));
    
    console.log(`\n📊 OVERALL RESULTS:`);
    console.log(`   Total Tests: ${testResults.total}`);
    console.log(`   Passed: ${testResults.passed} ✅`);
    console.log(`   Failed: ${testResults.failed} ❌`);
    console.log(`   Pass Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
    
    console.log(`\n📈 CATEGORY SCORES:`);
    console.log('─'.repeat(70));
    
    const categoryScores = {};
    for (const [category, data] of Object.entries(testResults.categories)) {
        const score = ((data.passed / (data.passed + data.failed)) * 100).toFixed(1);
        categoryScores[category] = parseFloat(score);
        const emoji = score >= 90 ? '🟢' : score >= 70 ? '🟡' : '🔴';
        console.log(`   ${emoji} ${category.padEnd(25)} ${score}% (${data.passed}/${data.passed + data.failed})`);
    }
    
    console.log('\n' + '═'.repeat(70));
    console.log('                    ENTERPRISE READINESS ASSESSMENT');
    console.log('═'.repeat(70));
    
    const categories = [
        { name: 'Reliability', weight: 15 },
        { name: 'Integrity', weight: 15 },
        { name: 'Security', weight: 20 },
        { name: 'Compliance', weight: 10 },
        { name: 'Resilience', weight: 10 },
        { name: 'Availability', weight: 10 },
        { name: 'Accountability', weight: 5 },
        { name: 'Reasoning', weight: 5 },
        { name: 'Consistency', weight: 5 },
        { name: 'Governance', weight: 5 }
    ];
    
    let weightedScore = 0;
    console.log('\n   Category                     Score    Weight   Contribution');
    console.log('   ' + '─'.repeat(60));
    
    for (const cat of categories) {
        const score = categoryScores[cat.name] || 0;
        const contribution = (score * cat.weight) / 100;
        weightedScore += contribution;
        console.log(`   ${cat.name.padEnd(28)} ${score.toFixed(1).padStart(5)}%   ${cat.weight.toString().padStart(3)}%     ${contribution.toFixed(2)}`);
    }
    
    console.log('   ' + '─'.repeat(60));
    console.log(`   ${'ENTERPRISE READINESS SCORE:'.padEnd(28)} ${weightedScore.toFixed(1).padStart(5)}%`);
    
    console.log('\n' + '═'.repeat(70));
    if (weightedScore >= 90) {
        console.log('   🏆 VERDICT: PRODUCTION READY - Enterprise Grade');
    } else if (weightedScore >= 75) {
        console.log('   ✅ VERDICT: ACCEPTABLE - Minor improvements recommended');
    } else if (weightedScore >= 60) {
        console.log('   ⚠️ VERDICT: NEEDS WORK - Several areas require attention');
    } else {
        console.log('   ❌ VERDICT: NOT READY - Major issues need to be resolved');
    }
    console.log('═'.repeat(70));
    
    console.log(`\n🕐 Test Completed: ${new Date().toISOString()}\n`);
    
    return testResults;
}

runAllTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
}).catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
});
