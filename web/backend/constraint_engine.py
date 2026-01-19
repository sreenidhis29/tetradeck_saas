"""
PURE CONSTRAINT SATISFACTION ENGINE FOR LEAVE MANAGEMENT
No RAG, No Mock Data - Real Business Rules Only

Port: 8001
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import re
import json
import uuid
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dotenv import load_dotenv

# Load env variables including DATABASE_URL
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

app = Flask(__name__)
CORS(app)

# Database Configuration
# Uses explicit variables if available, falling back to DATABASE_URL
# Database Configuration
# Uses explicit variables if available, falling back to defaults if env is broken
# Database Configuration
# Uses explicit variables if available, falling back to defaults if env is broken
DB_HOST = os.environ.get("DB_HOST") or "db.ajuedxrborerfeklgdel.supabase.co"
DB_USER = os.environ.get("DB_USER") or "postgres"
DB_PASSWORD = os.environ.get("DB_PASSWORD") or "Sree@tetradeck29"
DB_PORT = os.environ.get("DB_PORT") or "5432"
DB_NAME = os.environ.get("DB_NAME") or "postgres"
DB_SSL = os.environ.get("DB_SSL") or "require"

DB_URL = os.environ.get("DATABASE_URL")
if DB_URL:
    DB_URL = DB_URL.strip('"').strip("'")

# ============================================================
# CONSTRAINT RULES DEFINITION
# ============================================================
CONSTRAINT_RULES = {
    "RULE001": {
        "name": "Maximum Leave Duration",
        "description": "Check if requested days exceed maximum allowed",
        "limits": {
            "Annual Leave": 20,
            "Sick Leave": 15,
            "Emergency Leave": 5,
            "Personal Leave": 5,
            "Maternity Leave": 18,
            "Paternity Leave": 15,
            "Bereavement Leave": 5,
            "Study Leave": 10
        }
    },
    "RULE002": {
        "name": "Leave Balance Check",
        "description": "Verify sufficient leave balance available"
    },
    "RULE003": {
        "name": "Minimum Team Coverage",
        "description": "Ensure minimum team members present",
        "min_coverage_percent": 60  # At least 60% of team must be present
    },
    "RULE004": {
        "name": "Maximum Concurrent Leave",
        "description": "Limit simultaneous leaves in a team",
        "max_concurrent": 2  # Max 2 people on leave at same time per team
    },
    "RULE005": {
        "name": "Blackout Period Check",
        "description": "No leaves during blackout dates"
    },
    "RULE006": {
        "name": "Advance Notice Requirement",
        "description": "Minimum notice period for leave requests",
        "notice_days": {
            "Annual Leave": 7,
            "Sick Leave": 0,
            "Emergency Leave": 0,
            "Personal Leave": 3,
            "Maternity Leave": 30,
            "Paternity Leave": 14,
            "Bereavement Leave": 0,
            "Study Leave": 14
        }
    },
    "RULE007": {
        "name": "Consecutive Leave Limit",
        "description": "Maximum consecutive days allowed at once",
        "max_consecutive": {
            "Annual Leave": 10,
            "Sick Leave": 5,
            "Emergency Leave": 3,
            "Personal Leave": 3
        }
    },
    "RULE013": {
        "name": "Monthly Leave Quota",
        "description": "Maximum leaves per month per employee",
        "max_per_month": 5
    },
    "RULE014": {
        "name": "Half-Day Leave Escalation",
        "description": "Half-day leaves require HR approval - never auto-approved",
        "always_escalate": True,
        "priority": "HIGH"
    }
}


from urllib.parse import urlparse, unquote

from urllib.parse import quote_plus

# ============================================================
# CONNECTION POOL MANAGEMENT
# Single persistent connection for performance
# ============================================================
_connection_pool = None

class PooledConnection:
    """Wrapper around psycopg2 connection that ignores close() calls"""
    def __init__(self, conn):
        self._conn = conn
        
    def cursor(self, *args, **kwargs):
        return self._conn.cursor(*args, **kwargs)
    
    def commit(self):
        return self._conn.commit()
    
    def rollback(self):
        return self._conn.rollback()
    
    def close(self):
        # NO-OP: Don't actually close the pooled connection
        pass
    
    @property
    def closed(self):
        return self._conn.closed
    
    @property
    def autocommit(self):
        return self._conn.autocommit
    
    @autocommit.setter
    def autocommit(self, value):
        self._conn.autocommit = value

def _create_connection():
    """Create a new database connection"""
    print(f"🔌 Creating new DB connection...", file=sys.stderr)
    
    # Priority 1: DATABASE_URL (Recommended for poolers/Supabase)
    if DB_URL:
        url_to_use = DB_URL
        if 'sslmode' not in url_to_use:
            sep = '&' if '?' in url_to_use else '?'
            url_to_use += f"{sep}sslmode=require"
        conn = psycopg2.connect(url_to_use)
        conn.autocommit = True
        return conn

    # Priority 2: Explicit Variables Fallback
    if DB_HOST and DB_USER and DB_PASSWORD:
        conn = psycopg2.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT,
            dbname=DB_NAME,
            sslmode=DB_SSL
        )
        conn.autocommit = True
        return conn
        
    print("❌ Database configuration missing (DATABASE_URL or DB_HOST/USER/PASS)", file=sys.stderr)
    return None

def get_db_connection():
    """Get database connection from pool (creates if needed, reconnects if stale)"""
    global _connection_pool
    
    try:
        # Check if existing connection is valid
        if _connection_pool and not _connection_pool.closed:
            try:
                # Quick health check - ensure connection is still alive
                cur = _connection_pool._conn.cursor()
                cur.execute("SELECT 1")
                cur.close()
                return _connection_pool
            except Exception:
                # Connection is dead, need to reconnect
                print("⚠️ Connection stale, reconnecting...", file=sys.stderr)
                _connection_pool = None
        
        # Create new connection
        raw_conn = _create_connection()
        if raw_conn:
            _connection_pool = PooledConnection(raw_conn)
            print("✅ DB connection pool initialized", file=sys.stderr)
            return _connection_pool
        return None

    except Exception as e:
        print(f"❌ Database connection error: {e}", file=sys.stderr)
        _connection_pool = None
        return None

def test_db_connection():
    """Test connection on startup and print status"""
    conn = get_db_connection()
    if conn:
        try:
            print("\n" + "="*60)
            print("✅ DATABASE CONNECTED SUCCESSFULLY")
            print("="*60 + "\n")
            # Don't close - connection pool handles this
            return True
        except Exception:
            pass
    
    print("\n" + "="*60)
    print("❌ DATABASE CONNECTION FAILED")
    print("="*60 + "\n")
    return False

# Test DB connection on startup
test_db_connection()


def calculate_business_days(start_date: str, end_date: str) -> int:
    """Calculate business days between two dates (excluding weekends)"""
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    
    business_days = 0
    current = start
    while current <= end:
        if current.weekday() < 5:  # Monday = 0, Friday = 4
            business_days += 1
        current += timedelta(days=1)
    
    return business_days


def get_leave_balance(emp_id: str, leave_type: str) -> int:
    """Get leave balance for specific type"""
    conn = get_db_connection()
    if not conn:
        # Fallback to default limit if DB down
        return CONSTRAINT_RULES["RULE001"]["limits"].get(leave_type, 0)
    
    # Map leave types to database values
    leave_type_map = {
        "Annual Leave": "vacation",
        "Sick Leave": "sick",
        "Emergency Leave": "emergency",
        "Personal Leave": "personal",
        "Maternity Leave": "maternity",
        "Paternity Leave": "paternity",
        "Bereavement Leave": "bereavement",
        "Study Leave": "study"
    }
    db_leave_type = leave_type_map.get(leave_type, leave_type.lower().replace(" leave", ""))
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT annual_entitlement, carried_forward, used_days, pending_days 
            FROM leave_balances 
            WHERE emp_id = %s AND leave_type = %s
        """, (emp_id, db_leave_type))
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if result:
            entitlement = float(result['annual_entitlement'] or 0)
            carried = float(result['carried_forward'] or 0)
            used = float(result['used_days'] or 0)
            pending = float(result['pending_days'] or 0)
            remaining = entitlement + carried - used - pending
            return remaining
        else:
            # If no record, assume full entitlement (default)
            print(f"⚠️ No balance record for {leave_type}, assuming default entitlement.")
            return CONSTRAINT_RULES["RULE001"]["limits"].get(leave_type, 0)
            
    except Exception as e:
        print(f"❌ Error getting balance: {e}")
        if conn:
            conn.close()
        return 0


def extract_leave_info(text: str) -> Dict:
    """Extract leave information from natural language text"""
    text_lower = text.lower()
    today = datetime.now()
    
    # Extract number of days - default to 1 day
    days_requested = 1
    
    # Pattern: "X days" or "X day" (including "1 day")
    days_match = re.search(r'(\d+)\s*days?', text_lower)
    if days_match:
        days_requested = max(1, int(days_match.group(1)))
    
    # Check for "half day" -> 1 day
    if "half day" in text_lower or "half-day" in text_lower:
        days_requested = 1
    
    # Pattern: "a day" or "one day" or "1 day"
    if re.search(r'\b(a|one|1)\s*day\b', text_lower):
        days_requested = 1
    
    # Pattern: "a week" = 5 business days
    if "a week" in text_lower or "one week" in text_lower or "1 week" in text_lower:
        days_requested = 5
    elif "two weeks" in text_lower or "2 weeks" in text_lower:
        days_requested = 10
    elif "a month" in text_lower or "one month" in text_lower or "1 month" in text_lower:
        days_requested = 22  # ~22 business days in a month
    
    # Detect leave type - check for sick/unwell indicators first
    leave_type = "Annual Leave"
    if any(kw in text_lower for kw in ["sick", "ill", "fever", "cold", "flu", "doctor", "medical", "hospital", "health", "unwell", "not feeling well", "feeling unwell", "not well"]):
        leave_type = "Sick Leave"
    elif any(kw in text_lower for kw in ["emergency", "urgent", "crisis", "family emergency"]):
        leave_type = "Emergency Leave"
    elif any(kw in text_lower for kw in ["vacation", "holiday", "trip", "travel", "casual", "leave"]):
        leave_type = "Annual Leave"
    elif any(kw in text_lower for kw in ["personal", "private"]):
        leave_type = "Personal Leave"
    elif any(kw in text_lower for kw in ["maternity", "pregnancy"]):
        leave_type = "Maternity Leave"
    elif any(kw in text_lower for kw in ["paternity", "father", "newborn"]):
        leave_type = "Paternity Leave"
    elif any(kw in text_lower for kw in ["funeral", "bereavement", "death", "passed away"]):
        leave_type = "Bereavement Leave"
    elif any(kw in text_lower for kw in ["study", "exam", "course", "training"]):
        leave_type = "Study Leave"
    
    # Extract dates
    start_date = None
    end_date = None
    
    # Weekday parsing
    weekdays = {
        'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3, 'friday': 4, 'saturday': 5, 'sunday': 6,
        'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6
    }
    
    # Check for specific weekdays (e.g., "on Wednesday", "next Friday")
    weekday_found = False
    for day_name, day_num in weekdays.items():
        if f"next {day_name}" in text_lower:
            days_ahead = (day_num - today.weekday() + 7) % 7
            if days_ahead == 0: days_ahead = 7
            start_date = (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
            weekday_found = True
            break
        elif f"on {day_name}" in text_lower or f"this {day_name}" in text_lower or re.search(rf"\b{day_name}\b", text_lower):
            # Calculate days ahead for the coming occurrence
            days_ahead = (day_num - today.weekday()) % 7
            if days_ahead <= 0: # If today or past, assume next week unless specified
                 if days_ahead == 0 and "today" not in text_lower:
                     days_ahead = 7
                 elif days_ahead < 0:
                     days_ahead += 7
            
            # If "this" usually implies current week, but simple collision handling:
            # If user says "Wednesday" on Sunday, it's +3 days.
            if today.weekday() > day_num: # e.g. Sunday(6) asking for Wednesday(2) -> Next Wed
                 # Logic: (2 - 6) % 7 = -4 % 7 = 3. Correct.
                 pass
            
            start_date = (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
            weekday_found = True
            break

    if weekday_found:
        pass # Date set above
    elif "tomorrow" in text_lower:
        start_date = (today + timedelta(days=1)).strftime("%Y-%m-%d")
    elif "today" in text_lower:
        start_date = today.strftime("%Y-%m-%d")
    elif "next monday" in text_lower: # Keep legal fallback
        days_ahead = (0 - today.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        start_date = (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
    elif "next week" in text_lower:
        days_ahead = 7 - today.weekday()
        start_date = (today + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
    
    # Check for month day patterns - handle date ranges with different months
    month_names = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
        'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'jun': 6, 'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }
    
    # Build month pattern regex
    month_pattern = '|'.join(month_names.keys())
    
    # Pattern: "month day" - find all occurrences
    date_matches = re.findall(rf'({month_pattern})\s*(\d{{1,2}})(?:st|nd|rd|th)?', text_lower)
    
    if len(date_matches) >= 2:
        # We have at least two dates - treat as date range
        start_month_name, start_day = date_matches[0]
        end_month_name, end_day = date_matches[1]
        
        start_month = month_names[start_month_name]
        end_month = month_names[end_month_name]
        start_day = int(start_day)
        end_day = int(end_day)
        
        # Determine year
        start_year = today.year if start_month >= today.month else today.year + 1
        # End year - if end month < start month, it's next year
        if end_month < start_month:
            end_year = start_year + 1
        else:
            end_year = start_year
        
        try:
            start_date = datetime(start_year, start_month, start_day).strftime("%Y-%m-%d")
            end_date = datetime(end_year, end_month, end_day).strftime("%Y-%m-%d")
        except ValueError as e:
            print(f"Date parsing error: {e}")
            
    elif len(date_matches) == 1:
        # Single date found
        month_name, day = date_matches[0]
        month_num = month_names[month_name]
        day = int(day)
        year = today.year if month_num >= today.month else today.year + 1
        try:
            start_date = datetime(year, month_num, day).strftime("%Y-%m-%d")
        except ValueError:
            pass
    
    # If no start date found, default to tomorrow
    if not start_date:
        start_date = (today + timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Calculate end date based on days requested
    if not end_date:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        # Add business days
        end_dt = start_dt
        days_added = 1
        while days_added < days_requested:
            end_dt += timedelta(days=1)
            if end_dt.weekday() < 5:
                days_added += 1
        end_date = end_dt.strftime("%Y-%m-%d")
    
    # Recalculate actual days if we have both dates
    actual_days = calculate_business_days(start_date, end_date)
    
    return {
        "leave_type": leave_type,
        "start_date": start_date,
        "end_date": end_date,
        "days_requested": actual_days,
        "original_text": text
    }


def get_employee_info(emp_id: str) -> Optional[Dict]:
    """Get employee information from database"""
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Simplify query: just get employee info. Team info inferred from department later.
        cur.execute("""
            SELECT e.*, e.department as team_name
            FROM employees e
            WHERE e.emp_id = %s
        """, (emp_id,))
        employee = cur.fetchone()
        cur.close()
        conn.close()
        return employee
    except Exception as e:
        print(f"❌ Error getting employee: {e}")
        if conn:
            conn.close()
        return None


def ensure_leave_balance(emp_id: str, leave_type: str, cursor) -> None:
    """Ensure leave balance record exists for the employee"""
    # 1. Check if exists
    cursor.execute("""
        SELECT 1 FROM leave_balances 
        WHERE emp_id = %s AND leave_type = %s
    """, (emp_id, leave_type))
    
    if cursor.fetchone():
        return

    # 2. Get Default Entitlement
    # Find readable name to rule key map
    # Reverse map for safety
    entitlements = CONSTRAINT_RULES["RULE001"]["limits"]
    # We need to find the Key (e.g. "Annual Leave") based on database value (e.g. "vacation")
    # For now, simplistic mapping or default 0
    
    # Map db_type back to readable for rule lookup
    # This is rough, but effective for defaults
    db_to_readable = {
        "vacation": "Annual Leave",
        "sick": "Sick Leave",
        "emergency": "Emergency Leave",
        "personal": "Personal Leave",
        "maternity": "Maternity Leave",
        "paternity": "Paternity Leave",
        "bereavement": "Bereavement Leave",
        "study": "Study Leave"
    }
    
    readable_name = db_to_readable.get(leave_type, "Annual Leave")
    default_days = entitlements.get(readable_name, 0)
    
    # 3. Create Record
    current_year = datetime.now().year
    
    # Use country code from employee or default 'IN'
    cursor.execute("SELECT country_code FROM employees WHERE emp_id = %s", (emp_id,))
    res = cursor.fetchone()
    country = res['country_code'] if res else 'IN'
    
    print(f"✨ Initializing {readable_name} balance for {emp_id}: {default_days} days")
    
    cursor.execute("""
        INSERT INTO leave_balances (
            emp_id, country_code, leave_type, year, 
            annual_entitlement, carried_forward, used_days, pending_days
        ) VALUES (%s, %s, %s, %s, %s, 0, 0, 0)
    """, (emp_id, country, leave_type, current_year, default_days))


def get_leave_balance(emp_id: str, leave_type: str) -> int:
    """Get leave balance for specific type (Calculated from entitlement - used)"""
    conn = get_db_connection()
    if not conn:
        # Fallback to default limit if DB down
        return CONSTRAINT_RULES["RULE001"]["limits"].get(leave_type, 0)
    
    # Map leave types to database values
    leave_type_map = {
        "Annual Leave": "vacation",
        "Sick Leave": "sick",
        "Emergency Leave": "emergency",
        "Personal Leave": "personal",
        "Maternity Leave": "maternity",
        "Paternity Leave": "paternity",
        "Bereavement Leave": "bereavement",
        "Study Leave": "study"
    }
    db_leave_type = leave_type_map.get(leave_type, leave_type.lower().replace(" leave", ""))
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # LAZY INIT: Ensure record exists before querying
        ensure_leave_balance(emp_id, db_leave_type, cur)
        conn.commit() # Commit creation
        
        # Query again
        cur.execute("""
            SELECT annual_entitlement, carried_forward, used_days, pending_days 
            FROM leave_balances 
            WHERE emp_id = %s AND leave_type = %s
        """, (emp_id, db_leave_type))
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if result:
            entitlement = float(result['annual_entitlement'] or 0)
            carried = float(result['carried_forward'] or 0)
            used = float(result['used_days'] or 0)
            pending = float(result['pending_days'] or 0)
            
            # Logic: Total Available = (Entitlement + Carried) - (Used + Pending)
            return (entitlement + carried) - (used + pending)
        else:
            return 0 # Should not happen after ensure
            
    except Exception as e:
        print(f"❌ Error getting balance: {e}")
        if conn:
            conn.close()
        return 0


def get_team_status(emp_id: str, start_date: str, end_date: str) -> Dict:
    """Get team status including who's on leave (Using Department as Team)"""
    # Default response for employees not found or error
    default_response = {
        "team_id": None,
        "team_name": "Unknown Department",
        "team_size": 1,
        "on_leave": 0,
        "would_be_on_leave": 1,
        "available": 0,
        "min_coverage": 0,
        "members_on_leave": []
    }
    
    conn = get_db_connection()
    if not conn:
        return default_response
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1. Get Employee's Department
        cur.execute("SELECT department FROM employees WHERE emp_id = %s", (emp_id,))
        emp_data = cur.fetchone()
        
        if not emp_data or not emp_data['department']:
            cur.close()
            conn.close()
            return default_response
            
        department = emp_data['department']
        
        # 2. Get Team Size (Count employees in same department)
        cur.execute("SELECT COUNT(*) as size FROM employees WHERE department = %s AND is_active = true", (department,))
        size_res = cur.fetchone()
        team_size = size_res['size'] if size_res else 1
        
        # 3. Get Colleagues on Leave
        # Find approved/pending leaves for OTHER employees in SAME department overlapping dates
        cur.execute("""
            SELECT COUNT(DISTINCT lr.emp_id) as on_leave
            FROM leave_requests lr
            JOIN employees e ON lr.emp_id = e.emp_id
            WHERE e.department = %s
            AND lr.emp_id != %s
            AND lr.status IN ('approved', 'pending')
            AND NOT (lr.end_date < %s OR lr.start_date > %s)
        """, (department, emp_id, start_date, end_date))
        leave_result = cur.fetchone()
        on_leave = leave_result['on_leave'] if leave_result else 0
        
        # 4. Get Names of Colleagues on Leave
        cur.execute("""
            SELECT e.full_name, lr.leave_type, lr.start_date, lr.end_date
            FROM leave_requests lr
            JOIN employees e ON lr.emp_id = e.emp_id
            WHERE e.department = %s
            AND lr.emp_id != %s
            AND lr.status IN ('approved', 'pending')
            AND NOT (lr.end_date < %s OR lr.start_date > %s)
        """, (department, emp_id, start_date, end_date))
        members_on_leave = cur.fetchall()
        
        cur.close()
        conn.close()
        
        # 5. Calculate Status
        # Default policy: 50% coverage required for departments
        min_coverage = max(1, round(team_size * 0.5)) 
        
        return {
            "team_id": department, # Use department name as ID
            "team_name": department,
            "team_size": team_size,
            "on_leave": on_leave,
            "would_be_on_leave": on_leave + 1,  # Including this request
            "available": team_size - on_leave - 1, # -1 for current requester
            "min_coverage": min_coverage,
            "members_on_leave": members_on_leave
        }
    except Exception as e:
        print(f"❌ Error getting team status: {e}")
        if conn:
            conn.close()
        return default_response


def get_blackout_dates(start_date: str, end_date: str) -> List[Dict]:
    """Check if dates fall in blackout period"""
    conn = get_db_connection()
    if not conn:
        return []
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Check table structure - some tables might not have is_active column
        cur.execute("""
            SELECT * FROM blackout_dates
            WHERE NOT (end_date < %s OR start_date > %s)
        """, (start_date, end_date))
        blackouts = cur.fetchall()
        cur.close()
        conn.close()
        return blackouts
    except Exception as e:
        print(f"❌ Error checking blackouts: {e}")
        if conn:
            conn.close()
        return []


def get_monthly_leave_count(emp_id: str, month: int, year: int) -> int:
    """Get number of leave days taken in a specific month"""
    conn = get_db_connection()
    if not conn:
        return 0
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("""
            SELECT COALESCE(SUM(total_days), 0) as total
            FROM leave_requests
            WHERE emp_id = %s
            AND EXTRACT(MONTH FROM start_date) = %s
            AND EXTRACT(YEAR FROM start_date) = %s
            AND status IN ('approved', 'pending')
        """, (emp_id, month, year))
        result = cur.fetchone()
        cur.close()
        conn.close()
        return result['total'] if result else 0
    except Exception as e:
        print(f"❌ Error getting monthly count: {e}")
        if conn:
            conn.close()
        return 0


# ============================================================
# CONSTRAINT EVALUATION FUNCTIONS
# ============================================================

def check_rule001_max_duration(leave_info: Dict) -> Dict:
    """RULE001: Check maximum leave duration"""
    leave_type = leave_info['leave_type']
    days = leave_info['days_requested']
    max_allowed = CONSTRAINT_RULES["RULE001"]["limits"].get(leave_type, 20)
    
    passed = days <= max_allowed
    
    return {
        "rule_id": "RULE001",
        "rule_name": "Maximum Leave Duration",
        "passed": passed,
        "details": {
            "requested_days": days,
            "max_allowed": max_allowed,
            "leave_type": leave_type
        },
        "message": f"✅ Duration OK ({days} days ≤ {max_allowed} max)" if passed 
                   else f"❌ Exceeds maximum! Requested {days} days, max allowed is {max_allowed} days for {leave_type}"
    }


def check_rule002_balance(emp_id: str, leave_info: Dict) -> Dict:
    """RULE002: Check leave balance"""
    leave_type = leave_info['leave_type']
    days = leave_info['days_requested']
    balance = get_leave_balance(emp_id, leave_type)
    
    passed = balance >= days
    
    return {
        "rule_id": "RULE002",
        "rule_name": "Leave Balance Check",
        "passed": passed,
        "details": {
            "current_balance": balance,
            "requested_days": days,
            "remaining_after": balance - days if passed else 0
        },
        "message": f"✅ Sufficient balance ({balance} available, {days} requested)" if passed
                   else f"❌ Insufficient balance! Only {balance} days available, need {days}"
    }


def check_rule003_team_coverage(emp_id: str, leave_info: Dict) -> Dict:
    """RULE003: Check minimum team coverage"""
    team_status = get_team_status(emp_id, leave_info['start_date'], leave_info['end_date'])
    
    team_size = team_status['team_size']
    would_be_available = team_status['available']
    min_required = team_status['min_coverage']
    
    passed = would_be_available >= min_required
    coverage_percent = round((would_be_available / team_size) * 100) if team_size > 0 else 0
    
    return {
        "rule_id": "RULE003",
        "rule_name": "Minimum Team Coverage",
        "passed": passed,
        "details": {
            "team_name": team_status.get('team_name', 'Unknown'),
            "team_size": team_size,
            "currently_on_leave": team_status['on_leave'],
            "would_be_available": would_be_available,
            "min_required": min_required,
            "coverage_percent": coverage_percent,
            "members_on_leave": team_status.get('members_on_leave', [])
        },
        "message": f"✅ Team coverage OK ({would_be_available}/{team_size} present, {coverage_percent}%)" if passed
                   else f"❌ Team understaffed! Only {would_be_available}/{team_size} would remain (need {min_required})"
    }


def check_rule004_concurrent_leave(emp_id: str, leave_info: Dict) -> Dict:
    """RULE004: Check maximum concurrent leaves"""
    team_status = get_team_status(emp_id, leave_info['start_date'], leave_info['end_date'])
    
    would_be_on_leave = team_status['would_be_on_leave']
    max_concurrent = CONSTRAINT_RULES["RULE004"]["max_concurrent"]
    
    passed = would_be_on_leave <= max_concurrent
    
    return {
        "rule_id": "RULE004",
        "rule_name": "Maximum Concurrent Leave",
        "passed": passed,
        "details": {
            "current_on_leave": team_status['on_leave'],
            "would_be_on_leave": would_be_on_leave,
            "max_allowed": max_concurrent
        },
        "message": f"✅ Concurrent leave OK ({would_be_on_leave} ≤ {max_concurrent} max)" if passed
                   else f"❌ Too many on leave! {would_be_on_leave} would be on leave (max {max_concurrent})"
    }


def check_rule005_blackout(leave_info: Dict) -> Dict:
    """RULE005: Check blackout dates"""
    blackouts = get_blackout_dates(leave_info['start_date'], leave_info['end_date'])
    
    passed = len(blackouts) == 0
    
    blackout_names = [b['blackout_name'] for b in blackouts]
    
    return {
        "rule_id": "RULE005",
        "rule_name": "Blackout Period Check",
        "passed": passed,
        "details": {
            "blackout_dates": blackouts,
            "conflicts": blackout_names
        },
        "message": f"✅ No blackout conflicts" if passed
                   else f"❌ Blackout period! Conflicts with: {', '.join(blackout_names)}"
    }


def check_rule006_notice(leave_info: Dict) -> Dict:
    """RULE006: Check advance notice requirement"""
    leave_type = leave_info['leave_type']
    start_date = datetime.strptime(leave_info['start_date'], "%Y-%m-%d")
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    days_notice = (start_date - today).days
    required_notice = CONSTRAINT_RULES["RULE006"]["notice_days"].get(leave_type, 3)
    
    # If no notice required (0), always pass. Otherwise check days_notice >= required
    passed = (required_notice == 0) or (days_notice >= required_notice)
    
    return {
        "rule_id": "RULE006",
        "rule_name": "Advance Notice Requirement",
        "passed": passed,
        "details": {
            "days_notice_given": days_notice,
            "days_required": required_notice,
            "leave_type": leave_type
        },
        "message": f"✅ Notice OK ({days_notice} days given, {required_notice} required)" if passed
                   else f"❌ Insufficient notice! {leave_type} requires {required_notice} days notice, only {days_notice} given"
    }


def check_rule007_consecutive(leave_info: Dict) -> Dict:
    """RULE007: Check consecutive leave limit"""
    leave_type = leave_info['leave_type']
    days = leave_info['days_requested']
    max_consecutive = CONSTRAINT_RULES["RULE007"]["max_consecutive"].get(leave_type, 10)
    
    passed = days <= max_consecutive
    
    return {
        "rule_id": "RULE007",
        "rule_name": "Consecutive Leave Limit",
        "passed": passed,
        "details": {
            "requested_consecutive": days,
            "max_consecutive": max_consecutive
        },
        "message": f"✅ Consecutive days OK ({days} ≤ {max_consecutive} max)" if passed
                   else f"❌ Too many consecutive days! Max {max_consecutive} allowed at once, requested {days}"
    }


def check_rule013_monthly_quota(emp_id: str, leave_info: Dict) -> Dict:
    """RULE013: Check monthly leave quota"""
    start_date = datetime.strptime(leave_info['start_date'], "%Y-%m-%d")
    month = start_date.month
    year = start_date.year
    
    current_monthly = get_monthly_leave_count(emp_id, month, year)
    new_total = current_monthly + leave_info['days_requested']
    max_monthly = CONSTRAINT_RULES["RULE013"]["max_per_month"]
    
    passed = new_total <= max_monthly
    
    return {
        "rule_id": "RULE013",
        "rule_name": "Monthly Leave Quota",
        "passed": passed,
        "details": {
            "already_taken_this_month": current_monthly,
            "requesting": leave_info['days_requested'],
            "would_be_total": new_total,
            "max_per_month": max_monthly
        },
        "message": f"✅ Monthly quota OK ({new_total}/{max_monthly} days this month)" if passed
                   else f"❌ Exceeds monthly quota! Already taken {current_monthly} days, requesting {leave_info['days_requested']} more (max {max_monthly}/month)"
    }


def check_rule014_half_day(leave_info: Dict) -> Dict:
    """RULE014: Half-day leaves ALWAYS require HR approval - never auto-approved"""
    is_half_day = leave_info.get('is_half_day', False)
    
    # Also detect from leave_type name
    leave_type_lower = leave_info.get('leave_type', '').lower()
    if 'half' in leave_type_lower or 'half-day' in leave_type_lower:
        is_half_day = True
    
    # Also detect from days_requested being 0.5
    if leave_info.get('days_requested') == 0.5:
        is_half_day = True
    
    # Half-day requests ALWAYS fail this rule to force escalation
    passed = not is_half_day
    
    return {
        "rule_id": "RULE014",
        "rule_name": "Half-Day Leave Escalation",
        "passed": passed,
        "details": {
            "is_half_day": is_half_day,
            "priority": "HIGH" if is_half_day else "NORMAL",
            "requires_hr_approval": is_half_day
        },
        "message": f"✅ Standard leave request" if passed
                   else f"⚠️ HALF-DAY LEAVE: Requires HR approval (Priority: HIGH)"
    }


# ============================================================
# MAIN CONSTRAINT ENGINE
# ============================================================

def evaluate_all_constraints(emp_id: str, leave_info: Dict, custom_rules: Dict = None) -> Dict:
    start_time = datetime.now()
    results = []
    violations = []
    passed_rules = []
    
    # Merge custom rules with defaults if needed
    # Note: Current implementation uses global CONSTRAINT_RULES. 
    # If custom_rules are needed, we'd need to update the check functions.
    # For now, we proceed with global rules to avoid breaking function signatures.

    # Ensure leave_info has all necessary fields
    if 'days_requested' not in leave_info:
        # Calculate if missing
        start = datetime.strptime(leave_info['start_date'], "%Y-%m-%d")
        end = datetime.strptime(leave_info['end_date'], "%Y-%m-%d")
        leave_info['days_requested'] = (end - start).days + 1

    # Checks
    checks = [
        check_rule001_max_duration(leave_info),
        check_rule002_balance(emp_id, leave_info),
        check_rule003_team_coverage(emp_id, leave_info),
        check_rule004_concurrent_leave(emp_id, leave_info),
        check_rule005_blackout(leave_info),
        check_rule006_notice(leave_info),
        check_rule007_consecutive(leave_info),
        check_rule013_monthly_quota(emp_id, leave_info),
        check_rule014_half_day(leave_info),  # Half-day always escalates
    ]
    
    for check in checks:
        results.append(check)
        if not check['passed']:
            violations.append(check)
        else:
            passed_rules.append(check['rule_id'])
            
    processing_time = (datetime.now() - start_time).total_seconds() * 1000
    all_passed = len(violations) == 0
    
    # Get employee info for response
    employee = get_employee_info(emp_id)
    team_status = get_team_status(emp_id, leave_info['start_date'], leave_info['end_date'])
    balance = get_leave_balance(emp_id, leave_info['leave_type'])
    
    return {
        "approved": all_passed,
        "status": "APPROVED" if all_passed else "ESCALATE_TO_HR",
        "recommendation": "approve" if all_passed else "escalate",
        "employee": {
            "emp_id": emp_id,
            "name": employee['full_name'] if employee else "Unknown",
            "department": employee['department'] if employee else "Unknown",
            "team": team_status.get('team_name', 'Unknown')
        },
        "leave_request": {
            "type": leave_info['leave_type'],
            "start_date": leave_info['start_date'],
            "end_date": leave_info['end_date'],
            "days_requested": leave_info['days_requested'],
            # "original_text": leave_info.get('original_text', '') # Optional if not present
        },
        "balance": {
            "current": balance,
            "after_approval": balance - leave_info['days_requested'] if all_passed else balance
        },
        "team_status": {
            "team_name": team_status.get('team_name'),
            "team_size": team_status.get('team_size'),
            "currently_on_leave": team_status.get('on_leave'),
            "would_be_available": team_status.get('available'),
            "coverage_percent": round((team_status.get('available', 0) / team_status.get('team_size', 1)) * 100) if team_status.get('team_size') else 0
        },
        "constraint_results": {
            "total_rules": len(results),
            "passed": len(passed_rules),
            "failed": len(violations),
            "passed_rules": passed_rules,
            "violations": violations,
            "all_checks": results
        },
        "violations": violations,
        "processing_time_ms": round(processing_time, 2),
        "decision_reason": "All constraints satisfied" if all_passed else f"{len(violations)} constraint(s) violated",
        "suggestions": generate_suggestions(violations, leave_info) if not all_passed else []
    }


def generate_suggestions(violations: List[Dict], leave_info: Dict) -> List[str]:
    """Generate helpful suggestions based on violations"""
    suggestions = []
    
    for v in violations:
        rule_id = v['rule_id']
        
        if rule_id == "RULE001":
            max_days = v['details'].get('max_allowed', 10)
            suggestions.append(f"💡 Try requesting {max_days} days or less")
            suggestions.append("💡 Consider splitting into multiple shorter leaves")
        
        elif rule_id == "RULE002":
            balance = v['details'].get('current_balance', 0)
            suggestions.append(f"💡 You have {balance} days available - try requesting fewer days")
            suggestions.append("💡 Consider using a different leave type if available")
        
        elif rule_id == "RULE003":
            suggestions.append("💡 Try different dates when more team members are available")
            suggestions.append("💡 Coordinate with team members to ensure coverage")
            suggestions.append("💡 Consider work-from-home option for some days")
        
        elif rule_id == "RULE004":
            suggestions.append("💡 Wait for current leaves to end before requesting")
            suggestions.append("💡 Try dates when fewer team members are on leave")
        
        elif rule_id == "RULE005":
            suggestions.append("💡 Choose dates outside the blackout period")
            suggestions.append("💡 Contact HR for emergency exceptions")
        
        elif rule_id == "RULE006":
            required = v['details'].get('days_required', 7)
            suggestions.append(f"💡 Plan {required}+ days in advance for this leave type")
            suggestions.append("💡 For emergencies, use Emergency Leave type")
        
        elif rule_id == "RULE007":
            max_consec = v['details'].get('max_consecutive', 10)
            suggestions.append(f"💡 Maximum {max_consec} consecutive days allowed - split your leave")
            suggestions.append("💡 Take a break between leave periods")
        
        elif rule_id == "RULE013":
            suggestions.append("💡 Wait until next month when quota resets")
            suggestions.append("💡 Contact HR for special circumstances")
    
    return list(set(suggestions))[:5]  # Return max 5 unique suggestions


# ============================================================
# API ENDPOINTS
# ============================================================

def save_leave_request(emp_id: str, leave_info: Dict, result: Dict) -> Optional[str]:
    """Save the analyzed leave request to the database"""
    conn = get_db_connection()
    if not conn:
        return None
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1. Get Employee Details (Country Code)
        cur.execute("SELECT country_code FROM employees WHERE emp_id = %s", (emp_id,))
        emp = cur.fetchone()
        country_code = emp['country_code'] if emp else 'IN'
        
        # 2. Prepare Data
        # Ensure we have valid leave info
        leave_type = leave_info.get('leave_type', 'Annual Leave')
        start = leave_info.get('start_date')
        end = leave_info.get('end_date')
        days = leave_info.get('days_requested', 1)
        
        if not (start and end):
            print("❌ Cannot save request: Missing dates")
            return None
            
        request_id = str(uuid.uuid4())
        # Map boolean approved to enum status
        status = "approved" if result['approved'] else "escalated"
        # Map boolean approved to enum recommendation
        ai_rec = "approve" if result['approved'] else "escalate"
        
        # 3. Insert Leave Request
        # Note: Using NOW() for dates if python datetime causes issues,        # 3. Insert Leave Request
        query = """
            INSERT INTO leave_requests (
                request_id, emp_id, country_code, leave_type, 
                start_date, end_date, total_days, working_days,
                is_half_day, reason, status,
                ai_recommendation, ai_confidence, ai_analysis_json,
                updated_at
            ) VALUES (
                %s, %s, %s, %s, 
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                NOW()
            )
        """
        
        # Map readable leave type to db key for balance update
        leave_type_map = {
            "Annual Leave": "vacation",
            "Sick Leave": "sick",
            "Emergency Leave": "emergency",
            "Personal Leave": "personal",
            "Maternity Leave": "maternity",
            "Paternity Leave": "paternity",
            "Bereavement Leave": "bereavement",
            "Study Leave": "study"
        }
        db_leave_type = leave_type_map.get(leave_type, "vacation")
        
        cur.execute(query, (
            request_id,
            emp_id,
            country_code,
            leave_info['leave_type'],
            leave_info['start_date'],
            leave_info['end_date'],
            leave_info['days_requested'],
            leave_info['days_requested'], # Assuming working days = total days for now
            False, # is_half_day
            leave_info.get('original_text', 'AI Request'), # Reason
            status,
            ai_rec,
            1.0 if result['approved'] else 0.8, # Confidence
            json.dumps(result), # Store full analysis
        ))
        
        # 4. Update Balance (Atomic Update)
        # If Approved -> Increment Used
        # If Escalated -> Increment Pending
        # We assume ensure_leave_balance was called during analysis, so record exists.
        
        if status == 'approved':
            cur.execute("""
                UPDATE leave_balances 
                SET used_days = used_days + %s 
                WHERE emp_id = %s AND leave_type = %s
            """, (days, emp_id, db_leave_type))
            if cur.rowcount == 0:
                print(f"⚠️ WARNING: No balance updated! Check if leave_type='{db_leave_type}' exists for employee.")
            else:
                print(f"📉 Deducted {days} days from {db_leave_type} (Auto-Approved). Rows updated: {cur.rowcount}")
            
        elif status == 'escalated':
            cur.execute("""
                UPDATE leave_balances 
                SET pending_days = COALESCE(pending_days, 0) + %s 
                WHERE emp_id = %s AND leave_type = %s
            """, (days, emp_id, db_leave_type))
            if cur.rowcount == 0:
                print(f"⚠️ WARNING: No pending balance updated! Check if leave_type='{db_leave_type}' exists.")
            else:
                print(f"⏳ Reserved {days} days from {db_leave_type} (Escalated). Rows updated: {cur.rowcount}")
        
        conn.commit()
        cur.close()
        # Don't close pooled connection
        print(f"✅ Leave Request Saved: {request_id} ({status})")
        return request_id
        
    except Exception as e:
        print(f"❌ Error saving leave request: {e}")
        # Connection will be reused, don't close
        return None


# ============================================================
# API ENDPOINTS
# ============================================================

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    conn = get_db_connection()
    db_ok = conn is not None
    # Don't close pooled connection
    
    return jsonify({
        "status": "healthy" if db_ok else "degraded",
        "service": "Constraint Satisfaction Engine",
        "version": "1.0",
        "database": "connected" if db_ok else "disconnected",
        "total_rules": len(CONSTRAINT_RULES)
    })


# REPLACED: Redundant duplicate code block removed.
# The correct implementations of get_db_connection, save_leave_request, etc., are already defined above.
@app.route('/analyze', methods=['POST'])
def analyze():
    """Main constraint analysis endpoint"""
    data = request.json or {}
    text = data.get('text', '').strip()
    emp_id = data.get('employee_id')
    
    if not emp_id:
        return jsonify({"error": "employee_id is required"}), 400
    
    if not text:
        return jsonify({"error": "text is required"}), 400
    
    print(f"\n{'='*60}")
    print(f"🔍 CONSTRAINT ENGINE - Analyzing Request")
    print(f"{'='*60}")
    print(f"Employee: {emp_id}")
    print(f"Request: {text}")
    
    # Extract leave information from text
    leave_info = extract_leave_info(text)
    leave_info['original_text'] = text
    
    # Check for half-day flag from request
    is_half_day = data.get('is_half_day', False) or data.get('extracted_info', {}).get('is_half_day', False)
    if is_half_day:
        leave_info['is_half_day'] = True
        leave_info['days_requested'] = 0.5
        print(f"⚠️ HALF-DAY LEAVE DETECTED - Will require HR approval")
    
    # OVERRIDE with explicit values from request if provided (for integrity)
    if data.get('start_date'):
        leave_info['start_date'] = data.get('start_date')
    if data.get('end_date'):
        leave_info['end_date'] = data.get('end_date')
    if data.get('total_days'):
        leave_info['days_requested'] = int(data.get('total_days')) if not is_half_day else 0.5
    if data.get('leave_type'):
        # Map common types to our internal format
        lt = data.get('leave_type', '').lower()
        if 'casual' in lt or 'annual' in lt:
            leave_info['leave_type'] = 'Annual Leave'
        elif 'sick' in lt:
            leave_info['leave_type'] = 'Sick Leave'
        elif 'emergency' in lt:
            leave_info['leave_type'] = 'Emergency Leave'
        elif 'personal' in lt:
            leave_info['leave_type'] = 'Personal Leave'
    
    print(f"Extracted: {leave_info['days_requested']} days of {leave_info['leave_type']}")
    print(f"Dates: {leave_info['start_date']} to {leave_info['end_date']}")
    
    # Evaluate all constraints
    result = evaluate_all_constraints(emp_id, leave_info)
    
    # Add half-day priority flag to result
    if is_half_day:
        result['is_half_day'] = True
        result['priority'] = 'HIGH'
    
    # SAVE TO DATABASE
    request_id = save_leave_request(emp_id, leave_info, result)
    result['request_id'] = request_id
    
    print(f"\n📊 Result: {'✅ APPROVED' if result['approved'] else '❌ ESCALATED'}")
    print(f"Rules: {result['constraint_results']['passed']}/{result['constraint_results']['total_rules']} passed")
    print(f"Time: {result['processing_time_ms']}ms")
    print(f"{'='*60}\n")
    
    return jsonify(result)


@app.route('/', methods=['GET'])
def home():
    """Service health check"""
    return jsonify({
        "status": "online",
        "service": "Constraint Satisfaction Engine",
        "version": "1.0.0",
        "endpoints": ["/rules", "/validate", "/analyze", "/evaluate"]
    })


@app.route('/rules', methods=['GET'])
def get_rules():
    """Get all constraint rules"""
    return jsonify({
        "total_rules": len(CONSTRAINT_RULES),
        "rules": CONSTRAINT_RULES
    })


@app.route('/validate', methods=['POST'])
def validate_quick():
    """Quick validation without full analysis"""
    data = request.json or {}
    leave_type = data.get('leave_type', 'Annual Leave')
    days = data.get('days', 1)
    
    max_allowed = CONSTRAINT_RULES["RULE001"]["limits"].get(leave_type, 20)
    max_consecutive = CONSTRAINT_RULES["RULE007"]["max_consecutive"].get(leave_type, 10)
    notice_required = CONSTRAINT_RULES["RULE006"]["notice_days"].get(leave_type, 3)
    
    return jsonify({
        "leave_type": leave_type,
        "requested_days": days,
        "validations": {
            "max_duration": {
                "valid": days <= max_allowed,
                "max": max_allowed
            },
            "max_consecutive": {
                "valid": days <= max_consecutive,
                "max": max_consecutive
            },
            "notice_required": notice_required
        }
    })


if __name__ == '__main__':
    print("\n" + "="*60)
    print("[*] CONSTRAINT SATISFACTION ENGINE")
    print("="*60)
    print(f"[*] Total Rules: {len(CONSTRAINT_RULES)}")
    print("[*] Rules loaded:")
    for rule_id, rule in CONSTRAINT_RULES.items():
        print(f"   - {rule_id}: {rule['name']}")
    
    # Check Database Connection on Startup
    test_db_connection()
    
    # Get port from environment or default to 8001
    port = int(os.environ.get("PORT", 8001))
    app.run(host='0.0.0.0', port=port, debug=False)