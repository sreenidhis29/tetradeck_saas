const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Replace YOUR_CLERK_USER_ID with your actual Clerk user ID
  // You can find it in the Clerk dashboard or by logging in and checking the auth
  const clerkUserId = 'user_REPLACE_WITH_YOUR_ID';
  
  // Create employee
  const employee = await prisma.employees.create({
    data: {
      clerk_id: clerkUserId,
      email: 'admin@tetradeck.com',
      first_name: 'Admin',
      last_name: 'User',
      department: 'Engineering',
      role: 'admin',
      start_date: new Date('2024-01-01'),
      created_at: new Date(),
      updated_at: new Date(),
    }
  });

  console.log('✓ Employee created:', employee);

  // Create leave balances
  const balances = await prisma.leave_balances.createMany({
    data: [
      { employee_id: employee.id, leave_type: 'sick_leave', total_days: 10, used_days: 0 },
      { employee_id: employee.id, leave_type: 'vacation_leave', total_days: 20, used_days: 0 },
      { employee_id: employee.id, leave_type: 'casual_leave', total_days: 12, used_days: 0 },
      { employee_id: employee.id, leave_type: 'maternity_leave', total_days: 180, used_days: 0 },
      { employee_id: employee.id, leave_type: 'paternity_leave', total_days: 15, used_days: 0 },
      { employee_id: employee.id, leave_type: 'bereavement_leave', total_days: 5, used_days: 0 },
      { employee_id: employee.id, leave_type: 'comp_off', total_days: 8, used_days: 0 },
    ]
  });

  console.log('✓ Leave balances created:', balances.count, 'records');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
