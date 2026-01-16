import psycopg2

DB_CONFIG = {
    "host": "aws-1-ap-south-1.pooler.supabase.com",
    "port": 6543,
    "database": "postgres",
    "user": "postgres.wbjgultqxqjjxzbdaxdt",
    "password": "Kiran@Supabase"
}

conn = psycopg2.connect(**DB_CONFIG)
cur = conn.cursor()

# Check balances for EMP-RD9TTP
cur.execute("SELECT emp_id, leave_type, annual_entitlement, used_days, pending_days, carried_forward FROM leave_balances WHERE emp_id = 'EMP-RD9TTP'")
balances = cur.fetchall()

if not balances:
    print("❌ No balances found for EMP-RD9TTP. Creating them...")
    
    leave_types = [
        ('Sick Leave', 12),
        ('Vacation Leave', 20),
        ('Casual Leave', 7),
        ('Maternity Leave', 180),
        ('Paternity Leave', 15),
        ('Bereavement Leave', 5),
        ('Comp Off', 10)
    ]
    
    for leave_type, entitlement in leave_types:
        cur.execute("""
            INSERT INTO leave_balances (emp_id, leave_type, annual_entitlement, used_days, pending_days, carried_forward)
            VALUES (%s, %s, %s, 0, 0, 0)
            ON CONFLICT (emp_id, leave_type) DO UPDATE
            SET annual_entitlement = EXCLUDED.annual_entitlement
        """, ('EMP-RD9TTP', leave_type, entitlement))
        print(f"✅ Created/Updated {leave_type}: {entitlement} days")
    
    conn.commit()
    print("\n✅ All balances created!")
else:
    print(f"✅ Found {len(balances)} balances for EMP-RD9TTP:")
    for b in balances:
        emp_id, leave_type, entitlement, used, pending, carried = b
        remaining = entitlement + carried - used - pending
        print(f"  {leave_type}: {remaining} remaining ({entitlement} total, {used} used, {pending} pending)")

cur.close()
conn.close()
