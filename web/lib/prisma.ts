import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
    return new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        // Connection pool settings for serverless
        // datasources: {
        //     db: {
        //         url: process.env.DATABASE_URL,
        //     },
        // },
    });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Log database connection status on startup (helpful for debugging)
if (typeof window === 'undefined') {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        console.error('[Prisma] DATABASE_URL is not set!');
    } else {
        // Mask the password in logs
        const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
        console.log('[Prisma] Database configured:', maskedUrl.substring(0, 50) + '...');
    }
}
