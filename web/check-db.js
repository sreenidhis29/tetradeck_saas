const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDB() {
    try {
        await prisma.$connect();
        console.log('✓ Database connected');
        
        const empCount = await prisma.employee.count();
        console.log(`Employees in DB: ${empCount}`);
        
        if (empCount > 0) {
            const emp = await prisma.employee.findFirst({
                include: { leave_balances: true }
            });
            console.log('\nFirst employee:');
            console.log(`  ID: ${emp.emp_id}`);
            console.log(`  Name: ${emp.name}`);
            console.log(`  Clerk ID: ${emp.clerk_id || 'NOT SET'}`);
            console.log(`  Leave balances: ${emp.leave_balances?.length || 0}`);
        }
        
        await prisma.$disconnect();
    } catch(e) {
        console.error('✗ Database Error:', e.message);
        process.exit(1);
    }
}

checkDB();
