
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const email = 'fedosa7330@jparksky.com';

    console.log(`Updating role for ${email}...`);

    try {
        const user = await prisma.employee.update({
            where: { email: email },
            data: { role: 'hr' }
        });
        console.log(`Successfully updated ${user.full_name} to role: ${user.role}`);
    } catch (e) {
        console.error("Error updating user:", e);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
