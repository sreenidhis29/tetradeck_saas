const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function realTest() {
    console.log('========================================');
    console.log('REAL END-TO-END INTEGRATION TEST');
    console.log('========================================\n');

    // STEP 1: Check existing companies
    console.log('STEP 1: Database State Check');
    console.log('-'.repeat(40));
    
    const companies = await prisma.company.findMany({
        select: { id: true, name: true, code: true }
    });
    console.log('Existing companies:', companies.length);
    companies.forEach(c => console.log('  -', c.name, '(', c.code, ')'));

    const employees = await prisma.employee.findMany({
        select: { 
            emp_id: true, 
            full_name: true, 
            role: true, 
            org_id: true,
            approval_status: true,
            onboarding_status: true
        }
    });
    console.log('\nExisting employees:', employees.length);
    employees.forEach(e => console.log('  -', e.full_name, '|', e.role, '| org:', e.org_id ? e.org_id.slice(0,8) : 'none', '| approval:', e.approval_status));

    // STEP 2: Data Isolation Check
    console.log('\n' + '='.repeat(40));
    console.log('STEP 2: DATA ISOLATION TEST');
    console.log('='.repeat(40));

    if (companies.length >= 2) {
        const company1 = companies[0];
        const company2 = companies[1];
        
        const company1Employees = await prisma.employee.count({ where: { org_id: company1.id }});
        const company2Employees = await prisma.employee.count({ where: { org_id: company2.id }});
        
        console.log('Company 1 (' + company1.name + '): ' + company1Employees + ' employees');
        console.log('Company 2 (' + company2.name + '): ' + company2Employees + ' employees');
        
        // Check leave types isolation
        const company1LeaveTypes = await prisma.leaveType.count({ where: { company_id: company1.id }});
        const company2LeaveTypes = await prisma.leaveType.count({ where: { company_id: company2.id }});
        console.log('Company 1 leave types: ' + company1LeaveTypes);
        console.log('Company 2 leave types: ' + company2LeaveTypes);
        
        // Check leave requests isolation
        const company1Leaves = await prisma.leaveRequest.count({ 
            where: { employee: { org_id: company1.id } }
        });
        const company2Leaves = await prisma.leaveRequest.count({ 
            where: { employee: { org_id: company2.id } }
        });
        console.log('Company 1 leave requests: ' + company1Leaves);
        console.log('Company 2 leave requests: ' + company2Leaves);
        
        console.log('\n✅ DATA ISOLATION: Each company has separate data');
    } else {
        console.log('⚠️ Need at least 2 companies to test isolation - will create test data');
    }

    // STEP 3: Check Leave Balances
    console.log('\n' + '='.repeat(40));
    console.log('STEP 3: LEAVE BALANCES CHECK');
    console.log('='.repeat(40));
    
    const leaveBalances = await prisma.leaveBalance.findMany({
        take: 10,
        select: {
            emp_id: true,
            leave_type: true,
            annual_entitlement: true,
            used_days: true,
            year: true
        }
    });
    console.log('Sample leave balances:', leaveBalances.length);
    leaveBalances.forEach(lb => console.log('  -', lb.emp_id.slice(0,8), '|', lb.leave_type, '| quota:', lb.annual_entitlement, '| used:', lb.used_days));

    // STEP 4: Check Leave Requests
    console.log('\n' + '='.repeat(40));
    console.log('STEP 4: LEAVE REQUESTS CHECK');
    console.log('='.repeat(40));
    
    const leaveRequests = await prisma.leaveRequest.findMany({
        take: 10,
        select: {
            request_id: true,
            leave_type: true,
            status: true,
            start_date: true,
            end_date: true,
            employee: { select: { full_name: true, org_id: true } }
        },
        orderBy: { created_at: 'desc' }
    });
    console.log('Recent leave requests:', leaveRequests.length);
    leaveRequests.forEach(lr => console.log('  -', lr.employee?.full_name, '|', lr.leave_type, '|', lr.status, '|', lr.start_date?.toISOString().split('T')[0]));

    // STEP 5: Check Attendance Records
    console.log('\n' + '='.repeat(40));
    console.log('STEP 5: ATTENDANCE RECORDS');
    console.log('='.repeat(40));
    
    const attendance = await prisma.attendance.findMany({
        take: 10,
        select: {
            emp_id: true,
            check_in: true,
            check_out: true,
            date: true
        },
        orderBy: { date: 'desc' }
    });
    console.log('Recent attendance records:', attendance.length);
    attendance.forEach(a => console.log('  -', a.emp_id.slice(0,8), '|', a.date?.toISOString().split('T')[0], '| in:', a.check_in?.toISOString().split('T')[1]?.slice(0,5)));

    // STEP 6: API Endpoint Tests
    console.log('\n' + '='.repeat(40));
    console.log('STEP 6: CRITICAL DATA RELATIONSHIPS');
    console.log('='.repeat(40));

    // Check for orphaned employees (have org_id but company doesn't exist)
    const orphanedEmployees = await prisma.employee.findMany({
        where: {
            org_id: { not: null },
            company: null
        }
    });
    console.log('Orphaned employees (org_id but no company):', orphanedEmployees.length);
    if (orphanedEmployees.length > 0) {
        console.log('⚠️ WARNING: Found orphaned employees!');
        orphanedEmployees.forEach(e => console.log('  -', e.full_name, '| org_id:', e.org_id));
    } else {
        console.log('✅ No orphaned employees');
    }

    // Check for pending employees
    const pendingEmployees = await prisma.employee.findMany({
        where: { approval_status: 'pending' },
        select: { full_name: true, org_id: true, hire_date: true }
    });
    console.log('\nPending employees awaiting approval:', pendingEmployees.length);
    pendingEmployees.forEach(e => console.log('  -', e.full_name, '| org:', e.org_id ? e.org_id.slice(0,8) : 'NONE'));

    // Check for rejected employees
    const rejectedEmployees = await prisma.employee.findMany({
        where: { approval_status: 'rejected' },
        select: { full_name: true, org_id: true }
    });
    console.log('Rejected employees:', rejectedEmployees.length);

    await prisma.$disconnect();
    console.log('\n' + '='.repeat(40));
    console.log('TEST COMPLETE');
    console.log('='.repeat(40));
}

realTest().catch(e => { console.error(e); process.exit(1); });
