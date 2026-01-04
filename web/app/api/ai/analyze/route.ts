import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma'; // Assumed Prisma client location

// AI Service URL (Internal Docker Network or Localhost)
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001';

export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate with Clerk
        const { userId } = await auth();
        const user = await currentUser();

        if (!userId || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Resolve internal Employee ID
        // Strategy: Look up Employee table using Clerk ID or Email
        const employee = await prisma.employee.findFirst({
            where: {
                OR: [
                    { clerk_id: userId },
                    { email: user.emailAddresses[0].emailAddress }
                ]
            }
        });

        if (!employee) {
            return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
        }

        // 3. Fetch Context needed by AI Agent
        // The Python agent expects: extracted_info, team_state, leave_balance
        // We can either pass frontend data or hydrate it here for security.
        // Hydrating here is safer for "Logic Passthrough".

        const body = await req.json();

        // 4. Construct Payload ensuring "Identity Pass-through"
        const aiPayload = {
            ...body,
            employee_id: employee.emp_id,
            // Inject verified user context so Python doesn't trust just client body
            user_context: {
                role: employee.position,
                department: employee.department
            }
        };

        // 5. Proxy to Python Service
        const aiResponse = await fetch(`${AI_SERVICE_URL}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Internal-Secret': process.env.AI_SECRET_KEY || '' // Optional security
            },
            body: JSON.stringify(aiPayload)
        });

        if (!aiResponse.ok) {
            throw new Error(`AI Service failed: ${aiResponse.statusText}`);
        }

        const aiData = await aiResponse.json();

        return NextResponse.json(aiData);

    } catch (error) {
        console.error('AI Proxy Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
