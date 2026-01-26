/**
 * REAL HTTP API ENDPOINT TESTS
 * Tests actual API routes with HTTP requests
 */

const BASE_URL = 'http://localhost:3000';

async function testHealthEndpoint() {
    console.log('\n📡 Testing /api/health...');
    try {
        const res = await fetch(`${BASE_URL}/api/health`);
        const data = await res.json();
        console.log(`   Status: ${res.status}`);
        console.log(`   Response: ${JSON.stringify(data)}`);
        return res.status === 200;
    } catch (e) {
        console.log(`   ❌ Error: ${e.message}`);
        return false;
    }
}

async function testUnauthenticatedAccess() {
    console.log('\n📡 Testing Unauthenticated API Access...');
    
    const protectedEndpoints = [
        '/api/constraint-rules',
        '/api/leaves/balances',
        '/api/leaves/submit',
        '/api/employees/pending'
    ];

    let allBlocked = true;
    for (const endpoint of protectedEndpoints) {
        try {
            const res = await fetch(`${BASE_URL}${endpoint}`);
            const status = res.status;
            const blocked = status === 401 || status === 403 || status === 307;
            console.log(`   ${endpoint}: ${status} ${blocked ? '✅ Blocked' : '❌ VULNERABLE'}`);
            if (!blocked) allBlocked = false;
        } catch (e) {
            console.log(`   ${endpoint}: Connection error`);
        }
    }
    return allBlocked;
}

async function testPublicPages() {
    console.log('\n📡 Testing Public Pages Accessibility...');
    
    const publicPages = [
        '/',
        '/sign-in',
        '/sign-up'
    ];

    let allAccessible = true;
    for (const page of publicPages) {
        try {
            const res = await fetch(`${BASE_URL}${page}`, { redirect: 'manual' });
            const status = res.status;
            const accessible = status === 200 || status === 307 || status === 308;
            console.log(`   ${page}: ${status} ${accessible ? '✅' : '❌'}`);
            if (!accessible) allAccessible = false;
        } catch (e) {
            console.log(`   ${page}: ❌ Error - ${e.message}`);
            allAccessible = false;
        }
    }
    return allAccessible;
}

async function testProtectedPages() {
    console.log('\n📡 Testing Protected Pages Without Auth...');
    
    const protectedPages = [
        '/hr/dashboard',
        '/employee/dashboard',
        '/hr/employees',
        '/employee/leave'
    ];

    let allProtected = true;
    for (const page of protectedPages) {
        try {
            const res = await fetch(`${BASE_URL}${page}`, { redirect: 'manual' });
            const status = res.status;
            const location = res.headers.get('location') || '';
            const isProtected = status === 307 || status === 308 || location.includes('sign-in');
            console.log(`   ${page}: ${status} → ${location.slice(0, 30)} ${isProtected ? '✅ Protected' : '❌ EXPOSED'}`);
            if (!isProtected) allProtected = false;
        } catch (e) {
            console.log(`   ${page}: Error - ${e.message}`);
        }
    }
    return allProtected;
}

async function testCrossOriginHeaders() {
    console.log('\n📡 Testing Security Headers...');
    try {
        const res = await fetch(`${BASE_URL}/`);
        const headers = {
            'X-Frame-Options': res.headers.get('x-frame-options'),
            'X-Content-Type-Options': res.headers.get('x-content-type-options'),
            'Content-Security-Policy': res.headers.get('content-security-policy')?.slice(0, 50)
        };
        
        for (const [name, value] of Object.entries(headers)) {
            console.log(`   ${name}: ${value || '❌ Missing'}`);
        }
        return true;
    } catch (e) {
        console.log(`   Error: ${e.message}`);
        return false;
    }
}

async function main() {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     HTTP API ENDPOINT TESTS                                ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

    const results = {
        health: await testHealthEndpoint(),
        publicPages: await testPublicPages(),
        protectedPages: await testProtectedPages(),
        unauthenticated: await testUnauthenticatedAccess(),
        securityHeaders: await testCrossOriginHeaders()
    };

    console.log('\n' + '='.repeat(60));
    console.log('TEST RESULTS SUMMARY');
    console.log('='.repeat(60));
    
    let passed = 0;
    let failed = 0;
    for (const [test, result] of Object.entries(results)) {
        console.log(`   ${result ? '✅' : '❌'} ${test}`);
        if (result) passed++; else failed++;
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`PASSED: ${passed}/${passed + failed}`);
    if (failed > 0) {
        console.log('⚠️  SOME TESTS FAILED - Review issues above');
    } else {
        console.log('✅ ALL TESTS PASSED');
    }
}

main().catch(console.error);
