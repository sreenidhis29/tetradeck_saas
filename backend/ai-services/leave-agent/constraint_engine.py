"""
PURE CONSTRAINT SATISFACTION ENGINE FOR LEAVE MANAGEMENT
No RAG, No Mock Data - Real Business Rules Only

Port: 8001
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import re

app = Flask(__name__)
CORS(app)

# Database Configuration
DB_CONFIG = {
    "host": "localhost",
    "user": "root", 
    "password": "",
    "database": "company"
}

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
    "RULE008": {
        "name": "Weekend/Holiday Policy",
        "description": "Handle weekends and holidays in leave calculation"
    },
    "RULE009": {
        "name": "Probation Period Check",
        "description": "Limited leave for employees on probation"
    },
    "RULE010": {
        "name": "Previous Leave Pattern",
        "description": "Check for suspicious leave patterns"
    },
    "RULE011": {
        "name": "Project Deadline Conflict",
        "description": "Check against critical project deadlines"
    },
    "RULE012": {
        "name": "Manager Availability",
        "description": "Ensure manager is available for team coverage"
    },
    "RULE013": {
        "name": "Monthly Leave Quota",
        "description": "Maximum leaves per month per employee",
        "max_per_month": 5
    },
    "RULE014": {
        "name": "Year-End Restriction",
        "description": "Special restrictions during fiscal year end"
    }
}


def get_db_connection():
    """Get database connection"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except Error as e:
        print(f"❌ Database connection error: {e}")
        return None


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
    elif any(kw in text_lower for kw in ["vacation", "holiday", "trip", "travel"]):
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
    
    if "tomorrow" in text_lower:
        start_date = (today + timedelta(days=1)).strftime("%Y-%m-%d")
    elif "today" in text_lower:
        start_date = today.strftime("%Y-%m-%d")
    elif "next monday" in text_lower:
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
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT e.*, t.team_id, t.team_name, t.min_coverage
            FROM employees e
            LEFT JOIN team_members tm ON e.emp_id = tm.emp_id
            LEFT JOIN teams t ON tm.team_id = t.team_id
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


def get_leave_balance(emp_id: str, leave_type: str) -> int:
    """Get leave balance for specific type"""
    conn = get_db_connection()
    if not conn:
        return 0
    
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
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT remaining FROM leave_balances 
            WHERE emp_id = %s AND leave_type = %s
        """, (emp_id, db_leave_type))
        result = cur.fetchone()
        cur.close()
        conn.close()
        return result['remaining'] if result else 0
    except Exception as e:
        print(f"❌ Error getting balance: {e}")
        if conn:
            conn.close()
        return 0


def get_team_status(emp_id: str, start_date: str, end_date: str) -> Dict:
    """Get team status including who's on leave"""
    # Default response for employees not in teams
    default_response = {
        "team_id": None,
        "team_name": "No Team",
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
        cur = conn.cursor(dictionary=True)
        
        # Get employee's team
        cur.execute("""
            SELECT t.team_id, t.team_name, t.min_coverage,
                   (SELECT COUNT(*) FROM team_members WHERE team_id = t.team_id) as team_size
            FROM team_members tm
            JOIN teams t ON tm.team_id = t.team_id
            WHERE tm.emp_id = %s
        """, (emp_id,))
        team = cur.fetchone()
        
        if not team:
            cur.close()
            conn.close()
            return default_response
        
        # Get team members on leave during requested period
        cur.execute("""
            SELECT COUNT(DISTINCT lr.emp_id) as on_leave
            FROM leave_requests lr
            JOIN team_members tm ON lr.emp_id = tm.emp_id
            WHERE tm.team_id = %s
            AND lr.emp_id != %s
            AND lr.status IN ('approved', 'pending')
            AND NOT (lr.end_date < %s OR lr.start_date > %s)
        """, (team['team_id'], emp_id, start_date, end_date))
        leave_result = cur.fetchone()
        
        on_leave = leave_result['on_leave'] if leave_result else 0
        
        # Get names of team members on leave
        cur.execute("""
            SELECT e.full_name, lr.leave_type, lr.start_date, lr.end_date
            FROM leave_requests lr
            JOIN employees e ON lr.emp_id = e.emp_id
            JOIN team_members tm ON lr.emp_id = tm.emp_id
            WHERE tm.team_id = %s
            AND lr.emp_id != %s
            AND lr.status IN ('approved', 'pending')
            AND NOT (lr.end_date < %s OR lr.start_date > %s)
        """, (team['team_id'], emp_id, start_date, end_date))
        members_on_leave = cur.fetchall()
        
        cur.close()
        conn.close()
        
        return {
            "team_id": team['team_id'],
            "team_name": team['team_name'],
            "team_size": team['team_size'],
            "on_leave": on_leave,
            "would_be_on_leave": on_leave + 1,  # Including this request
            "available": team['team_size'] - on_leave - 1,
            "min_coverage": team['min_coverage'] or 3,
            "members_on_leave": members_on_leave
        }
    except Exception as e:
        print(f"❌ Error getting team status: {e}")
        if conn:
            conn.close()
        return {"team_size": 5, "on_leave": 0, "available": 5, "min_coverage": 3}


def get_blackout_dates(start_date: str, end_date: str) -> List[Dict]:
    """Check if dates fall in blackout period"""
    conn = get_db_connection()
    if not conn:
        return []
    
    try:
        cur = conn.cursor(dictionary=True)
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
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT COALESCE(SUM(total_days), 0) as total
            FROM leave_requests
            WHERE emp_id = %s
            AND MONTH(start_date) = %s
            AND YEAR(start_date) = %s
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


# ============================================================
# MAIN CONSTRAINT ENGINE
# ============================================================

def evaluate_all_constraints(emp_id: str, leave_info: Dict) -> Dict:
    """Evaluate all constraints and return comprehensive result"""
    start_time = datetime.now()
    
    results = []
    violations = []
    passed_rules = []
    
    # Run all constraint checks
    checks = [
        check_rule001_max_duration(leave_info),
        check_rule002_balance(emp_id, leave_info),
        check_rule003_team_coverage(emp_id, leave_info),
        check_rule004_concurrent_leave(emp_id, leave_info),
        check_rule005_blackout(leave_info),
        check_rule006_notice(leave_info),
        check_rule007_consecutive(leave_info),
        check_rule013_monthly_quota(emp_id, leave_info),
    ]
    
    for check in checks:
        results.append(check)
        if check['passed']:
            passed_rules.append(check['rule_id'])
        else:
            violations.append({
                "rule_id": check['rule_id'],
                "rule_name": check['rule_name'],
                "message": check['message'],
                "details": check['details']
            })
    
    # Calculate processing time
    processing_time = (datetime.now() - start_time).total_seconds() * 1000
    
    # Determine final decision
    all_passed = len(violations) == 0
    
    # Get employee info for response
    employee = get_employee_info(emp_id)
    team_status = get_team_status(emp_id, leave_info['start_date'], leave_info['end_date'])
    balance = get_leave_balance(emp_id, leave_info['leave_type'])
    
    return {
        "approved": all_passed,
        "status": "APPROVED" if all_passed else "ESCALATE_TO_HR",
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
            "original_text": leave_info['original_text']
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
            "coverage_percent": round((team_status.get('available', 0) / team_status.get('team_size', 1)) * 100)
        },
        "constraint_results": {
            "total_rules": len(results),
            "passed": len(passed_rules),
            "failed": len(violations),
            "passed_rules": passed_rules,
            "violations": violations,
            "all_checks": results
        },
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

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    conn = get_db_connection()
    db_ok = conn is not None
    if conn:
        conn.close()
    
    return jsonify({
        "status": "healthy" if db_ok else "degraded",
        "service": "Constraint Satisfaction Engine",
        "version": "1.0",
        "database": "connected" if db_ok else "disconnected",
        "total_rules": len(CONSTRAINT_RULES)
    })


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
    
    # Extract leave information
    leave_info = extract_leave_info(text)
    print(f"Extracted: {leave_info['days_requested']} days of {leave_info['leave_type']}")
    print(f"Dates: {leave_info['start_date']} to {leave_info['end_date']}")
    
    # Evaluate all constraints
    result = evaluate_all_constraints(emp_id, leave_info)
    
    print(f"\n📊 Result: {'✅ APPROVED' if result['approved'] else '❌ ESCALATED'}")
    print(f"Rules: {result['constraint_results']['passed']}/{result['constraint_results']['total_rules']} passed")
    print(f"Time: {result['processing_time_ms']}ms")
    print(f"{'='*60}\n")
    
    return jsonify(result)


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
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=8001, debug=False)
