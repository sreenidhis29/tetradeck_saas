const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBalances() {
    try {
        const balances = await prisma.leaveBalance.findMany({
            take: 5,
            include: {
                employee: {
                    select: {
                        emp_id: true,
                        full_name: true,
                        clerk_id: true
                    }
                }
            }
        });
        console.log(JSON.stringify(balances, null, 2));
    } finally {
        await prisma.$disconnect();
    }
}

checkBalances();
