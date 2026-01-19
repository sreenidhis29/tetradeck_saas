const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();
    try {
        // Check existing logs using only base schema fields
        const logs = await prisma.$queryRaw`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10`;
        console.log('Audit Logs in database:', logs.length);
        console.log(JSON.stringify(logs, null, 2));
    } finally {
        await prisma.$disconnect();
    }
}

main();
