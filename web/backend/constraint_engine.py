"""
PURE CONSTRAINT SATISFACTION ENGINE FOR LEAVE MANAGEMENT
No RAG, No Mock Data - Real Business Rules Only

Port: 8001
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg
from psycopg.rows import dict_row
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
# DEFAULT CONSTRAINT RULES DEFINITION
# These are used as fallback when no company-specific rules exist
# ============================================================
DEFAULT_CONSTRAINT_RULES = {
    "RULE001": {
        "id": "RULE001",
        "name": "Maximum Leave Duration",
        "description": "Check if requested days exceed maximum allowed per leave type",
        "category": "limits",
        "is_blocking": True,
        "priority": 100,
        "is_active": True,
        "config": {
            "limits": {
                "Annual Leave": 20,
                "Sick Leave": 15,
                "Emergency Leave": 5,
                "Personal Leave": 5,
                "Maternity Leave": 180,
                "Paternity Leave": 15,
                "Bereavement Leave": 5,
                "Study Leave": 10,
                "LWP": 30,
                "Comp Off": 5
            }
        }
    },
    "RULE002": {
        "id": "RULE002",
        "name": "Leave Balance Check",
        "description": "Verify sufficient leave balance available before approval",
        "category": "balance",
        "is_blocking": True,
        "priority": 99,
        "is_active": True,
        "config": {
            "allow_negative": False,
            "negative_limit": 0
        }
    },
    "RULE003": {
        "id": "RULE003",
        "name": "Minimum Team Coverage",
        "description": "Ensure minimum team members present during leave period",
        "category": "coverage",
        "is_blocking": True,
        "priority": 90,
        "is_active": True,
        "config": {
            "min_coverage_percent": 60,
            "applies_to_departments": ["all"]
        }
    },
    "RULE004": {
        "id": "RULE004",
        "name": "Maximum Concurrent Leave",
        "description": "Limit simultaneous leaves in a team/department",
        "category": "coverage",
        "is_blocking": True,
        "priority": 89,
        "is_active": True,
        "config": {
            "max_concurrent": 2,
            "scope": "department"
        }
    },
    "RULE005": {
        "id": "RULE005",
        "name": "Blackout Period Check",
        "description": "No leaves during specified blackout dates",
        "category": "blackout",
        "is_blocking": True,
        "priority": 95,
        "is_active": True,
        "config": {
            "blackout_dates": [],
            "blackout_days_of_week": [],
            "exception_leave_types": ["Emergency Leave", "Bereavement Leave"]
        }
    },
    "RULE006": {
        "id": "RULE006",
        "name": "Advance Notice Requirement",
        "description": "Minimum notice period required for leave requests",
        "category": "notice",
        "is_blocking": False,
        "priority": 80,
        "is_active": True,
        "config": {
            "notice_days": {
                "Annual Leave": 7,
                "Sick Leave": 0,
                "Emergency Leave": 0,
                "Personal Leave": 3,
                "Maternity Leave": 30,
                "Paternity Leave": 14,
                "Bereavement Leave": 0,
                "Study Leave": 14,
                "LWP": 7,
                "Comp Off": 1
            }
        }
    },
    "RULE007": {
        "id": "RULE007",
        "name": "Consecutive Leave Limit",
        "description": "Maximum consecutive days allowed for each leave type",
        "category": "limits",
        "is_blocking": True,
        "priority": 85,
        "is_active": True,
        "config": {
            "max_consecutive": {
                "Annual Leave": 10,
                "Sick Leave": 5,
                "Emergency Leave": 3,
                "Personal Leave": 3,
                "Study Leave": 5,
                "LWP": 15,
                "Comp Off": 2
            }
        }
    },
    "RULE008": {
        "id": "RULE008",
        "name": "Weekend/Holiday Sandwich Rule",
        "description": "Count weekends/holidays between leave days as leave",
        "category": "calculation",
        "is_blocking": False,
        "priority": 70,
        "is_active": True,
        "config": {
            "enabled": True,
            "min_gap_days": 1,
            "applies_to": ["Annual Leave", "Personal Leave"]
        }
    },
    "RULE009": {
        "id": "RULE009",
        "name": "Minimum Gap Between Leaves",
        "description": "Required gap between consecutive leave requests",
        "category": "limits",
        "is_blocking": False,
        "priority": 75,
        "is_active": True,
        "config": {
            "min_gap_days": 7,
            "applies_to": ["Annual Leave", "Personal Leave"],
            "exception_types": ["Sick Leave", "Emergency Leave", "Bereavement Leave"]
        }
    },
    "RULE010": {
        "id": "RULE010",
        "name": "Probation Period Restriction",
        "description": "Limit leave types available during probation",
        "category": "eligibility",
        "is_blocking": True,
        "priority": 98,
        "is_active": True,
        "config": {
            "probation_months": 6,
            "allowed_during_probation": ["Sick Leave", "Emergency Leave", "Bereavement Leave"],
            "restricted_types": ["Annual Leave", "Personal Leave", "Study Leave"]
        }
    },
    "RULE011": {
        "id": "RULE011",
        "name": "Critical Project Freeze",
        "description": "Restrict leaves during critical project periods",
        "category": "blackout",
        "is_blocking": False,
        "priority": 85,
        "is_active": False,
        "config": {
            "enabled": False,
            "freeze_periods": [],
            "exception_types": ["Sick Leave", "Emergency Leave", "Bereavement Leave"]
        }
    },
    "RULE012": {
        "id": "RULE012",
        "name": "Document Requirement",
        "description": "Require supporting documents for certain leave types/durations",
        "category": "documentation",
        "is_blocking": False,
        "priority": 60,
        "is_active": True,
        "config": {
            "require_document_above_days": 3,
            "always_require_for": ["Sick Leave", "Study Leave", "Maternity Leave", "Paternity Leave"],
            "document_types": ["medical_certificate", "proof_of_event", "other"]
        }
    },
    "RULE013": {
        "id": "RULE013",
        "name": "Monthly Leave Quota",
        "description": "Maximum leaves per month per employee",
        "category": "limits",
        "is_blocking": False,
        "priority": 65,
        "is_active": True,
        "config": {
            "max_per_month": 5,
            "exception_types": ["Sick Leave", "Emergency Leave", "Bereavement Leave"]
        }
    },
    "RULE014": {
        "id": "RULE014",
        "name": "Half-Day Leave Escalation",
        "description": "Half-day leaves require HR approval - never auto-approved",
        "category": "escalation",
        "is_blocking": False,
        "priority": 50,
        "is_active": True,
        "config": {
            "always_escalate": True,
            "escalate_to": "hr"
        }
    }
}

# Active constraint rules (loaded dynamically per organization)
# This global is used as a fallback - prefer get_org_constraint_rules() for org-specific rules
CONSTRAINT_RULES = DEFAULT_CONSTRAINT_RULES.copy()

# Cache for organization-specific rules (org_id -> rules dict)
_org_rules_cache = {}
_org_rules_cache_time = {}
CACHE_TTL_SECONDS = 300  # 5 minutes cache


def get_org_constraint_rules(org_id: str) -> Dict:
    """
    Get constraint rules for a specific organization.
    Fetches from database if available, otherwise returns defaults.
    Uses caching to avoid repeated DB calls.
    """
    global _org_rules_cache, _org_rules_cache_time
    
    # Check cache first
    cache_key = org_id or "default"
    now = datetime.now()
    
    if cache_key in _org_rules_cache:
        cache_time = _org_rules_cache_time.get(cache_key)
        if cache_time and (now - cache_time).total_seconds() < CACHE_TTL_SECONDS:
            print(f"📦 Using cached rules for org: {cache_key}", file=sys.stderr)
            return _org_rules_cache[cache_key]
    
    # Fetch from database
    conn = get_db_connection()
    if not conn:
        print(f"⚠️ No DB connection, using default rules", file=sys.stderr)
        return DEFAULT_CONSTRAINT_RULES
    
    try:
        cur = conn.cursor(row_factory=dict_row)
        
        # Query constraint_policies table for org-specific rules
        cur.execute("""
            SELECT rules FROM constraint_policies 
            WHERE org_id = %s AND is_active = true
            ORDER BY updated_at DESC LIMIT 1
        """, (org_id,))
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        if result and result.get('rules'):
            org_rules = result['rules']
            
            # If rules is a string (JSON), parse it
            if isinstance(org_rules, str):
                org_rules = json.loads(org_rules)
            
            # Filter to only active rules
            active_rules = {}
            for rule_id, rule_data in org_rules.items():
                if rule_data.get('is_active', True):
                    # Normalize the rule structure for backwards compatibility
                    active_rules[rule_id] = normalize_rule_format(rule_id, rule_data)
            
            # Cache the result
            _org_rules_cache[cache_key] = active_rules
            _org_rules_cache_time[cache_key] = now
            
            print(f"✅ Loaded {len(active_rules)} active rules for org: {org_id}", file=sys.stderr)
            return active_rules
        else:
            # No custom rules, use defaults
            print(f"📋 No custom rules for org {org_id}, using defaults", file=sys.stderr)
            _org_rules_cache[cache_key] = DEFAULT_CONSTRAINT_RULES
            _org_rules_cache_time[cache_key] = now
            return DEFAULT_CONSTRAINT_RULES
            
    except Exception as e:
        print(f"❌ Error fetching org rules: {e}", file=sys.stderr)
        if conn:
            conn.close()
        return DEFAULT_CONSTRAINT_RULES


def normalize_rule_format(rule_id: str, rule_data: Dict) -> Dict:
    """
    Normalize rule data format for backwards compatibility.
    Ensures config is properly structured even if stored in flat format.
    """
    # Get default rule structure as template
    default = DEFAULT_CONSTRAINT_RULES.get(rule_id, {})
    
    normalized = {
        "id": rule_id,
        "name": rule_data.get("name", default.get("name", rule_id)),
        "description": rule_data.get("description", default.get("description", "")),
        "category": rule_data.get("category", default.get("category", "limits")),
        "is_blocking": rule_data.get("is_blocking", default.get("is_blocking", True)),
        "priority": rule_data.get("priority", default.get("priority", 50)),
        "is_active": rule_data.get("is_active", True),
        "is_custom": rule_data.get("is_custom", False),
    }
    
    # Handle config - might be nested or flat
    if "config" in rule_data:
        normalized["config"] = rule_data["config"]
    else:
        # Try to extract config from flat structure (old format compatibility)
        config = {}
        
        # RULE001: limits
        if "limits" in rule_data:
            config["limits"] = rule_data["limits"]
        
        # RULE003: min_coverage_percent
        if "min_coverage_percent" in rule_data:
            config["min_coverage_percent"] = rule_data["min_coverage_percent"]
        
        # RULE004: max_concurrent
        if "max_concurrent" in rule_data:
            config["max_concurrent"] = rule_data["max_concurrent"]
        
        # RULE006: notice_days
        if "notice_days" in rule_data:
            config["notice_days"] = rule_data["notice_days"]
        
        # RULE007: max_consecutive
        if "max_consecutive" in rule_data:
            config["max_consecutive"] = rule_data["max_consecutive"]
        
        # RULE013: max_per_month
        if "max_per_month" in rule_data:
            config["max_per_month"] = rule_data["max_per_month"]
        
        # RULE014: always_escalate
        if "always_escalate" in rule_data:
            config["always_escalate"] = rule_data["always_escalate"]
        
        # Use default config if nothing extracted
        normalized["config"] = config if config else default.get("config", {})
    
    return normalized


def clear_org_rules_cache(org_id: str = None):
    """Clear the rules cache for an organization or all orgs"""
    global _org_rules_cache, _org_rules_cache_time
    if org_id:
        _org_rules_cache.pop(org_id, None)
        _org_rules_cache_time.pop(org_id, None)
    else:
        _org_rules_cache.clear()
        _org_rules_cache_time.clear()
    print(f"🗑️ Rules cache cleared for: {org_id or 'all'}", file=sys.stderr)


def get_rule_config(rules: Dict, rule_id: str, config_key: str, default=None):
    """
    Safely get a config value from a rule, handling both nested and flat structures.
    """
    rule = rules.get(rule_id, {})
    config = rule.get("config", {})
    
    # Check nested config first
    if config_key in config:
        return config[config_key]
    
    # Check flat structure (old format)
    if config_key in rule:
        return rule[config_key]
    
    # Return default
    return default


from urllib.parse import urlparse, unquote

from urllib.parse import quote_plus

# ============================================================
# CONNECTION POOL MANAGEMENT
# Single persistent connection for performance
# ============================================================
_connection_pool = None

class PooledConnection:
    """Wrapper around psycopg connection that ignores close() calls"""
    def __init__(self, conn):
        self._conn = conn
        
    def cursor(self, *args, **kwargs):
        # psycopg3 uses row_factory instead of cursor_factory
        if 'row_factory' not in kwargs:
            kwargs['row_factory'] = dict_row
        return self._conn.cursor(**kwargs)
    
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
        conn = psycopg.connect(url_to_use, autocommit=True)
        return conn

    # Priority 2: Explicit Variables Fallback
    if DB_HOST and DB_USER and DB_PASSWORD:
        conn = psycopg.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT,
            dbname=DB_NAME,
            sslmode=DB_SSL,
            autocommit=True
        )
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
        cur = conn.cursor(row_factory=dict_row)
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
    
    # Detect leave type - check for specific event types first, then general categories
    leave_type = "Annual Leave"  # Default
    
    # Personal events (wedding, family events) - Casual/Annual Leave
    if any(kw in text_lower for kw in ["wedding", "marriage", "attend", "ceremony", "function", "celebration", "party", "event"]):
        leave_type = "Annual Leave"
    # Sick leave indicators
    elif any(kw in text_lower for kw in ["sick", "ill", "fever", "cold", "flu", "doctor", "medical", "hospital", "health", "unwell", "not feeling well", "feeling unwell", "not well"]):
        leave_type = "Sick Leave"
    elif any(kw in text_lower for kw in ["emergency", "urgent", "crisis", "family emergency"]):
        leave_type = "Emergency Leave"
    elif any(kw in text_lower for kw in ["vacation", "holiday", "trip", "travel", "casual"]):
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
        cur = conn.cursor(row_factory=dict_row)
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
        cur = conn.cursor(row_factory=dict_row)
        
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
        cur = conn.cursor(row_factory=dict_row)
        
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
        cur = conn.cursor(row_factory=dict_row)
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
        cur = conn.cursor(row_factory=dict_row)
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
# All functions now accept 'rules' parameter for dynamic rule configuration
# ============================================================

def check_rule001_max_duration(leave_info: Dict, rules: Dict = None) -> Dict:
    """RULE001: Check maximum leave duration"""
    if rules is None:
        rules = CONSTRAINT_RULES
    
    # Check if rule is active
    rule = rules.get("RULE001", {})
    if not rule.get("is_active", True):
        return {"rule_id": "RULE001", "rule_name": "Maximum Leave Duration", "passed": True, 
                "skipped": True, "message": "Rule disabled"}
    
    leave_type = leave_info['leave_type']
    days = leave_info['days_requested']
    
    # Get limits from config or flat structure
    config = rule.get("config", rule)
    limits = config.get("limits", {})
    max_allowed = limits.get(leave_type, 20)
    
    passed = days <= max_allowed
    
    return {
        "rule_id": "RULE001",
        "rule_name": rule.get("name", "Maximum Leave Duration"),
        "passed": passed,
        "is_blocking": rule.get("is_blocking", True),
        "details": {
            "requested_days": days,
            "max_allowed": max_allowed,
            "leave_type": leave_type
        },
        "message": f"✅ Duration OK ({days} days ≤ {max_allowed} max)" if passed 
                   else f"❌ Exceeds maximum! Requested {days} days, max allowed is {max_allowed} days for {leave_type}"
    }


def check_rule002_balance(emp_id: str, leave_info: Dict, rules: Dict = None) -> Dict:
    """RULE002: Check leave balance"""
    if rules is None:
        rules = CONSTRAINT_RULES
    
    rule = rules.get("RULE002", {})
    if not rule.get("is_active", True):
        return {"rule_id": "RULE002", "rule_name": "Leave Balance Check", "passed": True,
                "skipped": True, "message": "Rule disabled"}
    
    leave_type = leave_info['leave_type']
    days = leave_info['days_requested']
    balance = get_leave_balance(emp_id, leave_type)
    
    passed = balance >= days
    
    return {
        "rule_id": "RULE002",
        "rule_name": rule.get("name", "Leave Balance Check"),
        "passed": passed,
        "is_blocking": rule.get("is_blocking", True),
        "details": {
            "current_balance": balance,
            "requested_days": days,
            "remaining_after": balance - days if passed else 0
        },
        "message": f"✅ Sufficient balance ({balance} available, {days} requested)" if passed
                   else f"❌ Insufficient balance! Only {balance} days available, need {days}"
    }


def check_rule003_team_coverage(emp_id: str, leave_info: Dict, rules: Dict = None) -> Dict:
    """RULE003: Check minimum team coverage"""
    if rules is None:
        rules = CONSTRAINT_RULES
    
    rule = rules.get("RULE003", {})
    if not rule.get("is_active", True):
        return {"rule_id": "RULE003", "rule_name": "Minimum Team Coverage", "passed": True,
                "skipped": True, "message": "Rule disabled"}
    
    team_status = get_team_status(emp_id, leave_info['start_date'], leave_info['end_date'])
    
    team_size = team_status['team_size']
    would_be_available = team_status['available']
    
    # Get min coverage from rule config
    config = rule.get("config", rule)
    min_coverage_percent = config.get("min_coverage_percent", 60)
    min_required = max(1, round(team_size * (min_coverage_percent / 100)))
    
    passed = would_be_available >= min_required
    coverage_percent = round((would_be_available / team_size) * 100) if team_size > 0 else 0
    
    return {
        "rule_id": "RULE003",
        "rule_name": rule.get("name", "Minimum Team Coverage"),
        "passed": passed,
        "is_blocking": rule.get("is_blocking", True),
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


def check_rule004_concurrent_leave(emp_id: str, leave_info: Dict, rules: Dict = None) -> Dict:
    """RULE004: Check maximum concurrent leaves"""
    if rules is None:
        rules = CONSTRAINT_RULES
    
    rule = rules.get("RULE004", {})
    if not rule.get("is_active", True):
        return {"rule_id": "RULE004", "rule_name": "Maximum Concurrent Leave", "passed": True,
                "skipped": True, "message": "Rule disabled"}
    
    team_status = get_team_status(emp_id, leave_info['start_date'], leave_info['end_date'])
    
    would_be_on_leave = team_status['would_be_on_leave']
    config = rule.get("config", rule)
    max_concurrent = config.get("max_concurrent", 2)
    
    passed = would_be_on_leave <= max_concurrent
    
    return {
        "rule_id": "RULE004",
        "rule_name": rule.get("name", "Maximum Concurrent Leave"),
        "passed": passed,
        "is_blocking": rule.get("is_blocking", True),
        "details": {
            "current_on_leave": team_status['on_leave'],
            "would_be_on_leave": would_be_on_leave,
            "max_allowed": max_concurrent
        },
        "message": f"✅ Concurrent leave OK ({would_be_on_leave} ≤ {max_concurrent} max)" if passed
                   else f"❌ Too many on leave! {would_be_on_leave} would be on leave (max {max_concurrent})"
    }


def check_rule005_blackout(leave_info: Dict, rules: Dict = None) -> Dict:
    """RULE005: Check blackout dates"""
    if rules is None:
        rules = CONSTRAINT_RULES
    
    rule = rules.get("RULE005", {})
    if not rule.get("is_active", True):
        return {"rule_id": "RULE005", "rule_name": "Blackout Period Check", "passed": True,
                "skipped": True, "message": "Rule disabled"}
    
    blackouts = get_blackout_dates(leave_info['start_date'], leave_info['end_date'])
    
    passed = len(blackouts) == 0
    
    blackout_names = [b['blackout_name'] for b in blackouts]
    
    return {
        "rule_id": "RULE005",
        "rule_name": rule.get("name", "Blackout Period Check"),
        "passed": passed,
        "is_blocking": rule.get("is_blocking", True),
        "details": {
            "blackout_dates": blackouts,
            "conflicts": blackout_names
        },
        "message": f"✅ No blackout conflicts" if passed
                   else f"❌ Blackout period! Conflicts with: {', '.join(blackout_names)}"
    }


def check_rule006_notice(leave_info: Dict, rules: Dict = None) -> Dict:
    """RULE006: Check advance notice requirement"""
    if rules is None:
        rules = CONSTRAINT_RULES
    
    rule = rules.get("RULE006", {})
    if not rule.get("is_active", True):
        return {"rule_id": "RULE006", "rule_name": "Advance Notice Requirement", "passed": True,
                "skipped": True, "message": "Rule disabled"}
    
    leave_type = leave_info['leave_type']
    start_date = datetime.strptime(leave_info['start_date'], "%Y-%m-%d")
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    days_notice = (start_date - today).days
    config = rule.get("config", rule)
    notice_days_map = config.get("notice_days", {})
    required_notice = notice_days_map.get(leave_type, 3)
    
    # If no notice required (0), always pass. Otherwise check days_notice >= required
    passed = (required_notice == 0) or (days_notice >= required_notice)
    
    return {
        "rule_id": "RULE006",
        "rule_name": rule.get("name", "Advance Notice Requirement"),
        "passed": passed,
        "is_blocking": rule.get("is_blocking", False),
        "details": {
            "days_notice_given": days_notice,
            "days_required": required_notice,
            "leave_type": leave_type
        },
        "message": f"✅ Notice OK ({days_notice} days given, {required_notice} required)" if passed
                   else f"❌ Insufficient notice! {leave_type} requires {required_notice} days notice, only {days_notice} given"
    }


def check_rule007_consecutive(leave_info: Dict, rules: Dict = None) -> Dict:
    """RULE007: Check consecutive leave limit"""
    if rules is None:
        rules = CONSTRAINT_RULES
    
    rule = rules.get("RULE007", {})
    if not rule.get("is_active", True):
        return {"rule_id": "RULE007", "rule_name": "Consecutive Leave Limit", "passed": True,
                "skipped": True, "message": "Rule disabled"}
    
    leave_type = leave_info['leave_type']
    days = leave_info['days_requested']
    config = rule.get("config", rule)
    max_consecutive_map = config.get("max_consecutive", {})
    max_consecutive = max_consecutive_map.get(leave_type, 10)
    
    passed = days <= max_consecutive
    
    return {
        "rule_id": "RULE007",
        "rule_name": rule.get("name", "Consecutive Leave Limit"),
        "passed": passed,
        "is_blocking": rule.get("is_blocking", True),
        "details": {
            "requested_consecutive": days,
            "max_consecutive": max_consecutive
        },
        "message": f"✅ Consecutive days OK ({days} ≤ {max_consecutive} max)" if passed
                   else f"❌ Too many consecutive days! Max {max_consecutive} allowed at once, requested {days}"
    }


def check_rule013_monthly_quota(emp_id: str, leave_info: Dict, rules: Dict = None) -> Dict:
    """RULE013: Check monthly leave quota"""
    if rules is None:
        rules = CONSTRAINT_RULES
    
    rule = rules.get("RULE013", {})
    if not rule.get("is_active", True):
        return {"rule_id": "RULE013", "rule_name": "Monthly Leave Quota", "passed": True,
                "skipped": True, "message": "Rule disabled"}
    
    start_date = datetime.strptime(leave_info['start_date'], "%Y-%m-%d")
    month = start_date.month
    year = start_date.year
    
    current_monthly = get_monthly_leave_count(emp_id, month, year)
    new_total = current_monthly + leave_info['days_requested']
    config = rule.get("config", rule)
    max_monthly = config.get("max_per_month", 5)
    
    passed = new_total <= max_monthly
    
    return {
        "rule_id": "RULE013",
        "rule_name": rule.get("name", "Monthly Leave Quota"),
        "passed": passed,
        "is_blocking": rule.get("is_blocking", False),
        "details": {
            "already_taken_this_month": current_monthly,
            "requesting": leave_info['days_requested'],
            "would_be_total": new_total,
            "max_per_month": max_monthly
        },
        "message": f"✅ Monthly quota OK ({new_total}/{max_monthly} days this month)" if passed
                   else f"❌ Exceeds monthly quota! Already taken {current_monthly} days, requesting {leave_info['days_requested']} more (max {max_monthly}/month)"
    }


def check_rule014_half_day(leave_info: Dict, rules: Dict = None) -> Dict:
    """RULE014: Half-day leaves ALWAYS require HR approval - never auto-approved"""
    if rules is None:
        rules = CONSTRAINT_RULES
    
    rule = rules.get("RULE014", {})
    if not rule.get("is_active", True):
        return {"rule_id": "RULE014", "rule_name": "Half-Day Leave Escalation", "passed": True,
                "skipped": True, "message": "Rule disabled"}
    
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
        "rule_name": rule.get("name", "Half-Day Leave Escalation"),
        "passed": passed,
        "is_blocking": rule.get("is_blocking", False),
        "details": {
            "is_half_day": is_half_day,
            "priority": "HIGH" if is_half_day else "NORMAL",
            "requires_hr_approval": is_half_day
        },
        "message": f"✅ Standard leave request" if passed
                   else f"⚠️ HALF-DAY LEAVE: Requires HR approval (Priority: HIGH)"
    }


# ============================================================
# DYNAMIC CUSTOM RULE EVALUATION ENGINE
# Allows HR to create ANY type of rule and have it enforced
# ============================================================

def evaluate_custom_rule(rule_id: str, rule_data: Dict, emp_id: str, leave_info: Dict, all_rules: Dict) -> Dict:
    """
    Evaluate a custom rule based on its category and config.
    This allows HR to create arbitrary rules that the engine will enforce.
    
    Supported Categories:
    - limits: Max days, quotas, thresholds
    - balance: Balance checks with custom logic
    - coverage: Team/department coverage requirements
    - blackout: Date-based restrictions
    - notice: Advance notice requirements
    - calculation: Date calculation rules
    - eligibility: Who can take leave
    - documentation: Document requirements
    - escalation: When to escalate for review
    
    Config Format Examples:
    {
        "max_days": 5,                      // limits
        "min_days": 1,                      // limits
        "applies_to_types": ["Annual"],     // which leave types
        "excluded_types": ["Emergency"],    // exempt leave types
        "allowed_days": ["mon", "tue"],     // specific days allowed
        "blocked_days": ["fri", "sat"],     // specific days blocked
        "condition": "greater_than",        // greater_than, less_than, equals
        "threshold": 10,                    // numeric threshold
        "escalate_always": true,            // always escalate
        "require_manager_approval": true,   // approval chain
        "custom_message": "...",            // custom error message
    }
    """
    category = rule_data.get("category", "limits")
    config = rule_data.get("config", {})
    rule_name = rule_data.get("name", rule_id)
    is_blocking = rule_data.get("is_blocking", True)
    
    leave_type = leave_info.get("leave_type", "")
    days_requested = leave_info.get("days_requested", 0)
    start_date = leave_info.get("start_date", "")
    end_date = leave_info.get("end_date", "")
    
    # Check if rule applies to this leave type
    applies_to = config.get("applies_to_types", [])
    excluded = config.get("excluded_types", [])
    
    if applies_to and leave_type not in applies_to:
        return {
            "rule_id": rule_id,
            "rule_name": rule_name,
            "passed": True,
            "skipped": True,
            "is_blocking": is_blocking,
            "message": f"Rule not applicable to {leave_type}"
        }
    
    if excluded and leave_type in excluded:
        return {
            "rule_id": rule_id,
            "rule_name": rule_name,
            "passed": True,
            "skipped": True,
            "is_blocking": is_blocking,
            "message": f"{leave_type} is exempt from this rule"
        }
    
    passed = True
    message = f"✅ {rule_name}: Passed"
    details = {}
    
    try:
        # ============================================================
        # CATEGORY: LIMITS - Max/min days, quotas
        # ============================================================
        if category == "limits":
            max_days = config.get("max_days")
            min_days = config.get("min_days")
            
            if max_days is not None and days_requested > max_days:
                passed = False
                message = f"❌ {rule_name}: Exceeds maximum {max_days} days (requested: {days_requested})"
                details["limit"] = max_days
                details["requested"] = days_requested
            
            if min_days is not None and days_requested < min_days:
                passed = False
                message = f"❌ {rule_name}: Below minimum {min_days} days (requested: {days_requested})"
                details["minimum"] = min_days
                details["requested"] = days_requested
        
        # ============================================================
        # CATEGORY: BLACKOUT - Date-based restrictions
        # ============================================================
        elif category == "blackout":
            blocked_dates = config.get("blocked_dates", [])
            blocked_days = config.get("blocked_days", [])  # ["friday", "saturday"]
            
            if start_date:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                end_dt = datetime.strptime(end_date, "%Y-%m-%d") if end_date else start_dt
                
                # Check specific blocked dates
                current = start_dt
                while current <= end_dt:
                    date_str = current.strftime("%Y-%m-%d")
                    if date_str in blocked_dates:
                        passed = False
                        message = f"❌ {rule_name}: {date_str} is blocked"
                        details["blocked_date"] = date_str
                        break
                    
                    # Check blocked days of week
                    day_name = current.strftime("%A").lower()
                    if day_name in [d.lower() for d in blocked_days]:
                        passed = False
                        message = f"❌ {rule_name}: {day_name.title()} is not allowed"
                        details["blocked_day"] = day_name
                        break
                    
                    current += timedelta(days=1)
        
        # ============================================================
        # CATEGORY: NOTICE - Advance notice requirements
        # ============================================================
        elif category == "notice":
            min_notice_days = config.get("min_notice_days", 0)
            
            if start_date and min_notice_days > 0:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
                notice_given = (start_dt - today).days
                
                if notice_given < min_notice_days:
                    passed = False
                    message = f"❌ {rule_name}: Requires {min_notice_days} days notice (given: {notice_given})"
                    details["required_notice"] = min_notice_days
                    details["actual_notice"] = notice_given
        
        # ============================================================
        # CATEGORY: COVERAGE - Team coverage requirements
        # ============================================================
        elif category == "coverage":
            min_available = config.get("min_team_available")
            max_concurrent = config.get("max_concurrent")
            
            if min_available or max_concurrent:
                team_status = get_team_status(emp_id, start_date, end_date)
                available_after = team_status.get("available", 0)
                on_leave = team_status.get("on_leave", 0)
                
                if min_available and available_after < min_available:
                    passed = False
                    message = f"❌ {rule_name}: Minimum {min_available} team members must be available (would be: {available_after})"
                    details["min_required"] = min_available
                    details["would_be_available"] = available_after
                
                if max_concurrent and (on_leave + 1) > max_concurrent:
                    passed = False
                    message = f"❌ {rule_name}: Maximum {max_concurrent} concurrent leaves allowed (would be: {on_leave + 1})"
                    details["max_concurrent"] = max_concurrent
                    details["would_be_on_leave"] = on_leave + 1
        
        # ============================================================
        # CATEGORY: ELIGIBILITY - Who can take leave
        # ============================================================
        elif category == "eligibility":
            min_tenure_months = config.get("min_tenure_months")
            allowed_departments = config.get("allowed_departments", [])
            blocked_departments = config.get("blocked_departments", [])
            
            employee = get_employee_info(emp_id)
            if employee:
                dept = employee.get("department", "")
                
                if allowed_departments and dept not in allowed_departments:
                    passed = False
                    message = f"❌ {rule_name}: Not available for {dept} department"
                    details["department"] = dept
                
                if blocked_departments and dept in blocked_departments:
                    passed = False
                    message = f"❌ {rule_name}: Blocked for {dept} department"
                    details["department"] = dept
                
                if min_tenure_months:
                    join_date = employee.get("join_date")
                    if join_date:
                        if isinstance(join_date, str):
                            join_dt = datetime.strptime(join_date[:10], "%Y-%m-%d")
                        else:
                            join_dt = join_date
                        months_employed = (datetime.now() - join_dt).days / 30
                        if months_employed < min_tenure_months:
                            passed = False
                            message = f"❌ {rule_name}: Requires {min_tenure_months} months tenure (current: {int(months_employed)})"
                            details["required_months"] = min_tenure_months
                            details["current_months"] = int(months_employed)
        
        # ============================================================
        # CATEGORY: ESCALATION - Always escalate for review
        # ============================================================
        elif category == "escalation":
            escalate_always = config.get("escalate_always", False)
            escalate_above_days = config.get("escalate_above_days")
            
            if escalate_always:
                passed = False
                message = f"⚠️ {rule_name}: Requires manual review"
                details["escalation_reason"] = "Always requires review"
            
            if escalate_above_days and days_requested > escalate_above_days:
                passed = False
                message = f"⚠️ {rule_name}: Leaves over {escalate_above_days} days require review"
                details["threshold_days"] = escalate_above_days
                details["requested_days"] = days_requested
        
        # ============================================================
        # CATEGORY: DOCUMENTATION - Document requirements
        # ============================================================
        elif category == "documentation":
            require_doc_above_days = config.get("require_above_days")
            always_require = config.get("always_require", False)
            
            # Note: We can't actually check if docs are attached here,
            # but we can flag that docs are required
            if always_require or (require_doc_above_days and days_requested > require_doc_above_days):
                details["documents_required"] = True
                details["requirement_reason"] = "Always required" if always_require else f"Required for leaves over {require_doc_above_days} days"
                # Don't fail the check, just add to details
                message = f"ℹ️ {rule_name}: Supporting documents required"
        
        # ============================================================
        # GENERIC THRESHOLD CHECK (works for any category)
        # ============================================================
        threshold = config.get("threshold")
        condition = config.get("condition")
        
        if threshold is not None and condition:
            if condition == "greater_than" and days_requested > threshold:
                passed = False
                message = config.get("custom_message", f"❌ {rule_name}: Exceeds threshold of {threshold}")
            elif condition == "less_than" and days_requested < threshold:
                passed = False
                message = config.get("custom_message", f"❌ {rule_name}: Below threshold of {threshold}")
            elif condition == "equals" and days_requested == threshold:
                passed = False
                message = config.get("custom_message", f"❌ {rule_name}: Cannot request exactly {threshold} days")
        
    except Exception as e:
        print(f"⚠️ Error evaluating custom rule {rule_id}: {e}", file=sys.stderr)
        passed = True  # Don't block on evaluation errors
        message = f"⚠️ {rule_name}: Could not evaluate (error: {str(e)})"
        details["error"] = str(e)
    
    return {
        "rule_id": rule_id,
        "rule_name": rule_name,
        "passed": passed,
        "is_blocking": is_blocking,
        "is_custom": True,
        "category": category,
        "details": details,
        "message": message
    }


# ============================================================
# MAIN CONSTRAINT ENGINE - NOW FULLY DYNAMIC
# ============================================================

def evaluate_all_constraints(emp_id: str, leave_info: Dict, org_id: str = None) -> Dict:
    """
    Evaluate all active constraint rules for a leave request.
    
    Args:
        emp_id: Employee ID
        leave_info: Leave request details
        org_id: Organization ID (optional - fetches org-specific rules if provided)
    
    Returns:
        Complete evaluation result with all constraint checks
    """
    start_time = datetime.now()
    results = []
    violations = []
    warnings = []
    passed_rules = []
    skipped_rules = []
    
    # Get organization-specific rules or defaults
    if org_id:
        rules = get_org_constraint_rules(org_id)
        print(f"📋 Using {len(rules)} rules for org: {org_id}", file=sys.stderr)
    else:
        # Try to get org_id from employee
        employee = get_employee_info(emp_id)
        if employee and employee.get('org_id'):
            rules = get_org_constraint_rules(employee['org_id'])
        else:
            rules = DEFAULT_CONSTRAINT_RULES
            print(f"⚠️ No org_id, using default rules", file=sys.stderr)

    # Ensure leave_info has all necessary fields
    if 'days_requested' not in leave_info:
        # Calculate if missing
        start = datetime.strptime(leave_info['start_date'], "%Y-%m-%d")
        end = datetime.strptime(leave_info['end_date'], "%Y-%m-%d")
        leave_info['days_requested'] = (end - start).days + 1

    # Run all checks - passing the rules dict to each function
    # Only run checks for rules that exist in the rules dict
    checks = []
    
    if "RULE001" in rules:
        checks.append(check_rule001_max_duration(leave_info, rules))
    if "RULE002" in rules:
        checks.append(check_rule002_balance(emp_id, leave_info, rules))
    if "RULE003" in rules:
        checks.append(check_rule003_team_coverage(emp_id, leave_info, rules))
    if "RULE004" in rules:
        checks.append(check_rule004_concurrent_leave(emp_id, leave_info, rules))
    if "RULE005" in rules:
        checks.append(check_rule005_blackout(leave_info, rules))
    if "RULE006" in rules:
        checks.append(check_rule006_notice(leave_info, rules))
    if "RULE007" in rules:
        checks.append(check_rule007_consecutive(leave_info, rules))
    if "RULE013" in rules:
        checks.append(check_rule013_monthly_quota(emp_id, leave_info, rules))
    if "RULE014" in rules:
        checks.append(check_rule014_half_day(leave_info, rules))
    
    # ============================================================
    # DYNAMIC CUSTOM RULE EVALUATION
    # Evaluate any rule starting with "CUSTOM" using category-based logic
    # ============================================================
    for rule_id, rule_data in rules.items():
        if rule_id.startswith("CUSTOM") and rule_data.get("is_active", True):
            custom_result = evaluate_custom_rule(rule_id, rule_data, emp_id, leave_info, rules)
            checks.append(custom_result)
    
    # Process results
    for check in checks:
        results.append(check)
        
        # Handle skipped rules
        if check.get('skipped'):
            skipped_rules.append(check['rule_id'])
            continue
            
        if not check['passed']:
            # Check if this is a blocking violation or just a warning
            if check.get('is_blocking', True):
                violations.append(check)
            else:
                warnings.append(check)
        else:
            passed_rules.append(check['rule_id'])
            
    processing_time = (datetime.now() - start_time).total_seconds() * 1000
    
    # Determine outcome: Only blocking violations prevent approval
    all_passed = len(violations) == 0
    
    # Get employee info for response
    employee = get_employee_info(emp_id)
    team_status = get_team_status(emp_id, leave_info['start_date'], leave_info['end_date'])
    balance = get_leave_balance(emp_id, leave_info['leave_type'])
    
    return {
        "approved": all_passed,
        "status": "APPROVED" if all_passed else "ESCALATE_TO_HR",
        "recommendation": "approve" if all_passed else "escalate",
        "has_warnings": len(warnings) > 0,
        "employee": {
            "emp_id": emp_id,
            "name": employee['full_name'] if employee else "Unknown",
            "department": employee['department'] if employee else "Unknown",
            "team": team_status.get('team_name', 'Unknown'),
            "org_id": employee.get('org_id') if employee else None
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
            "warnings_count": len(warnings),
            "skipped": len(skipped_rules),
            "passed_rules": passed_rules,
            "violations": violations,
            "warnings": warnings,
            "skipped_rules": skipped_rules,
            "all_checks": results,
            "rules_loaded": len(rules)
        },
        "violations": violations,
        "warnings": warnings,
        "processing_time_ms": round(processing_time, 2),
        "decision_reason": "All constraints satisfied" if all_passed else f"{len(violations)} blocking constraint(s) violated",
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
        cur = conn.cursor(row_factory=dict_row)
        
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
        "service": "Dynamic Constraint Satisfaction Engine",
        "version": "2.0.0",
        "features": [
            "Organization-specific rules",
            "Dynamic rule configuration",
            "Blocking vs warning violations",
            "Rule caching with TTL"
        ],
        "endpoints": ["/rules", "/rules/<org_id>", "/validate", "/analyze", "/evaluate", "/cache/clear"]
    })


@app.route('/rules', methods=['GET'])
def get_rules():
    """Get default constraint rules or org-specific rules"""
    org_id = request.args.get('org_id')
    
    if org_id:
        rules = get_org_constraint_rules(org_id)
        return jsonify({
            "org_id": org_id,
            "total_rules": len(rules),
            "active_rules": len([r for r in rules.values() if r.get('is_active', True)]),
            "rules": rules,
            "is_custom": True
        })
    else:
        return jsonify({
            "total_rules": len(DEFAULT_CONSTRAINT_RULES),
            "rules": DEFAULT_CONSTRAINT_RULES,
            "is_custom": False,
            "note": "Pass ?org_id=xxx to get organization-specific rules"
        })


@app.route('/rules/<org_id>', methods=['GET'])
def get_org_rules(org_id: str):
    """Get rules for a specific organization"""
    rules = get_org_constraint_rules(org_id)
    active_count = len([r for r in rules.values() if r.get('is_active', True)])
    
    return jsonify({
        "org_id": org_id,
        "total_rules": len(rules),
        "active_rules": active_count,
        "inactive_rules": len(rules) - active_count,
        "rules": rules
    })


@app.route('/cache/clear', methods=['POST'])
def clear_cache():
    """Clear the rules cache (useful after HR updates rules)"""
    data = request.json or {}
    org_id = data.get('org_id')
    
    clear_org_rules_cache(org_id)
    
    return jsonify({
        "success": True,
        "message": f"Cache cleared for: {org_id or 'all organizations'}"
    })


@app.route('/validate', methods=['POST'])
def validate_quick():
    """Quick validation without full analysis"""
    data = request.json or {}
    leave_type = data.get('leave_type', 'Annual Leave')
    days = data.get('days', 1)
    org_id = data.get('org_id')
    
    # Get org-specific rules if available
    rules = get_org_constraint_rules(org_id) if org_id else DEFAULT_CONSTRAINT_RULES
    
    # Get config from rules
    rule001 = rules.get("RULE001", {})
    rule006 = rules.get("RULE006", {})
    rule007 = rules.get("RULE007", {})
    
    config001 = rule001.get("config", rule001)
    config006 = rule006.get("config", rule006)
    config007 = rule007.get("config", rule007)
    
    limits = config001.get("limits", {})
    notice_days = config006.get("notice_days", {})
    max_consecutive_map = config007.get("max_consecutive", {})
    
    max_allowed = limits.get(leave_type, 20)
    max_consecutive = max_consecutive_map.get(leave_type, 10)
    notice_required = notice_days.get(leave_type, 3)
    
    return jsonify({
        "leave_type": leave_type,
        "requested_days": days,
        "org_id": org_id,
        "validations": {
            "max_duration": {
                "valid": days <= max_allowed,
                "max": max_allowed,
                "rule_active": rule001.get("is_active", True)
            },
            "max_consecutive": {
                "valid": days <= max_consecutive,
                "max": max_consecutive,
                "rule_active": rule007.get("is_active", True)
            },
            "notice_required": notice_required,
            "notice_rule_active": rule006.get("is_active", True)
        }
    })


if __name__ == '__main__':
    print("\n" + "="*60)
    print("[*] DYNAMIC CONSTRAINT SATISFACTION ENGINE v2.0")
    print("="*60)
    print(f"[*] Default Rules: {len(DEFAULT_CONSTRAINT_RULES)}")
    print("[*] Rules loaded:")
    for rule_id, rule in DEFAULT_CONSTRAINT_RULES.items():
        status = "✅" if rule.get('is_active', True) else "⏸️"
        blocking = "🚫" if rule.get('is_blocking', True) else "⚠️"
        print(f"   {status} {blocking} {rule_id}: {rule['name']}")
    
    print("\n[*] Features:")
    print("   - Dynamic org-specific rules")
    print("   - Rule caching with 5-min TTL")
    print("   - Blocking vs warning violations")
    
    # Check Database Connection on Startup
    test_db_connection()
    
    # Get port from environment or default to 8001
    port = int(os.environ.get("PORT", 8001))
    app.run(host='0.0.0.0', port=port, debug=False)
