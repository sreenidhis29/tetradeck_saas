
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const hrEmail = 'fedosa7330@jparksky.com';
    console.log(`Diagnosing for HR: ${hrEmail}`);

    const hr = await prisma.employee.findUnique({
        where: { email: hrEmail },
        select: { emp_id: true, org_id: true, role: true }
    });

    if (!hr) {
        console.log("HR user not found!");
        return;
    }

    console.log(`HR Found: ID=${hr.emp_id}, Role=${hr.role}, Org=${hr.org_id}`);

    if (!hr.org_id) {
        console.log("HR has no Org ID!");
        return;
    }

    const allInOrg = await prisma.employee.findMany({
        where: { org_id: hr.org_id },
        select: { full_name: true, role: true }
    });

    console.log(`Total in Org: ${allInOrg.length}`);
    allInOrg.forEach(e => console.log(` - ${e.full_name}: ${e.role}`));

    const filtered = await prisma.employee.findMany({
        where: {
            org_id: hr.org_id,
            role: { notIn: ['hr', 'admin'] }
        }
    });

    console.log(`Filtered Count (should not be 0): ${filtered.length}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
