
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const allEmployees = await prisma.employee.findMany({
        select: {
            full_name: true,
            email: true,
            role: true,
            org_id: true,
            company: { select: { name: true } }
        }
    });

    console.log(JSON.stringify(allEmployees, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
