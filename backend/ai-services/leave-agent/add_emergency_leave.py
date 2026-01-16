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

# Add Emergency Leave and Personal Leave for EMP-RD9TTP
new_leave_types = [
    ('Emergency Leave', 5),
    ('Personal Leave', 5)
]

for leave_type, entitlement in new_leave_types:
    # Check if record exists first
    cur.execute("""
        SELECT emp_id FROM leave_balances 
        WHERE emp_id = 'EMP-RD9TTP' AND leave_type = %s
    """, (leave_type,))
    
    if cur.fetchone():
        # Update existing
        cur.execute("""
            UPDATE leave_balances 
            SET annual_entitlement = %s
            WHERE emp_id = 'EMP-RD9TTP' AND leave_type = %s
        """, (entitlement, leave_type))
        print(f"✅ Updated {leave_type}: {entitlement} days")
    else:
        # Insert new
        cur.execute("""
            INSERT INTO leave_balances (emp_id, leave_type, country_code, year, annual_entitlement, used_days, pending_days, carried_forward)
            VALUES ('EMP-RD9TTP', %s, 'IN', 2026, %s, 0, 0, 0)
        """, (leave_type, entitlement))
        print(f"✅ Added {leave_type}: {entitlement} days")

conn.commit()

# Verify all balances
cur.execute("SELECT leave_type, annual_entitlement FROM leave_balances WHERE emp_id = 'EMP-RD9TTP' ORDER BY leave_type")
balances = cur.fetchall()

print("\n📊 All leave balances for EMP-RD9TTP:")
for leave_type, entitlement in balances:
    print(f"  {leave_type}: {entitlement} days")

cur.close()
conn.close()
