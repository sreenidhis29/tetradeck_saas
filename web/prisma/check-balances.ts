import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const balances = await prisma.leave_balances.findMany({
    where: { emp_id: 'EMP-RD9TTP' }
  });
  
  if (balances.length === 0) {
    console.log('❌ No balances found for EMP-RD9TTP');
    console.log('Creating default balances...');
    
    const leaveTypes = [
      { type: 'Sick Leave', entitlement: 12 },
      { type: 'Vacation Leave', entitlement: 20 },
      { type: 'Casual Leave', entitlement: 7 },
      { type: 'Maternity Leave', entitlement: 180 },
      { type: 'Paternity Leave', entitlement: 15 },
      { type: 'Bereavement Leave', entitlement: 5 },
      { type: 'Comp Off', entitlement: 10 }
    ];
    
    for (const leave of leaveTypes) {
      await prisma.leave_balances.create({
        data: {
          emp_id: 'EMP-RD9TTP',
          leave_type: leave.type,
          annual_entitlement: leave.entitlement,
          used_days: 0,
          pending_days: 0,
          carried_forward: 0
        }
      });
      console.log(`✅ Created ${leave.type}: ${leave.entitlement} days`);
    }
  } else {
    console.log('✅ Found balances for EMP-RD9TTP:');
    balances.forEach(b => {
      const remaining = b.annual_entitlement + b.carried_forward - b.used_days - b.pending_days;
      console.log(`  ${b.leave_type}: ${remaining} remaining (${b.annual_entitlement} total, ${b.used_days} used, ${b.pending_days} pending)`);
    });
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
