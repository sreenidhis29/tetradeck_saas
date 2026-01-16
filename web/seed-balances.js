const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedBalances() {
    try {
        // Get logged in user - use the clerk_id from the screenshot
        const employees = await prisma.employee.findMany({
            take: 1,
            orderBy: { emp_id: 'desc' }
        });
        
        if (employees.length === 0) {
            console.log('No employees found');
            return;
        }
        
        const employee = employees[0];
        console.log(`Seeding balances for: ${employee.full_name} (${employee.emp_id})`);
        
        const currentYear = new Date().getFullYear();
        
        // Delete existing balances for this employee
        await prisma.leaveBalance.deleteMany({
            where: { emp_id: employee.emp_id }
        });
        
        // Create proper leave balances
        const balances = [
            { leave_type: 'Paternity Leave', annual_entitlement: 15, used_days: 0 },
            { leave_type: 'Sick Leave', annual_entitlement: 12, used_days: 0 },
            { leave_type: 'Vacation Leave', annual_entitlement: 20, used_days: 0 },
            { leave_type: 'Casual Leave', annual_entitlement: 7, used_days: 0 },
            { leave_type: 'Maternity Leave', annual_entitlement: 180, used_days: 0 },
            { leave_type: 'Bereavement Leave', annual_entitlement: 5, used_days: 0 },
            { leave_type: 'Comp Off', annual_entitlement: 10, used_days: 0 },
        ];
        
        for (const balance of balances) {
            await prisma.leaveBalance.create({
                data: {
                    emp_id: employee.emp_id,
                    country_code: employee.country_code || 'IN',
                    leave_type: balance.leave_type,
                    year: currentYear,
                    annual_entitlement: balance.annual_entitlement,
                    carried_forward: 0,
                    used_days: balance.used_days,
                    pending_days: 0
                }
            });
        }
        
        console.log('✓ Leave balances seeded successfully!');
        
        // Verify
        const created = await prisma.leaveBalance.findMany({
            where: { emp_id: employee.emp_id }
        });
        console.log('\nCreated balances:');
        created.forEach(b => {
            const available = Number(b.annual_entitlement) - Number(b.used_days);
            console.log(`  ${b.leave_type}: ${available}/${b.annual_entitlement}`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

seedBalances();
