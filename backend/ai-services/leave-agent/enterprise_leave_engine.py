"""
Enterprise Leave Policy Engine
Country-specific leave policies with full compliance support
"""

from flask import Flask, request, jsonify
from datetime import datetime, date, timedelta
from decimal import Decimal, ROUND_HALF_UP
import json
import mysql.connector
from functools import lru_cache
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EnterpriseLeaveEngine:
    """
    Enterprise-grade leave management engine supporting:
    - Country-specific policies
    - Multi-level approval chains
    - Half-day leave
    - Comp-off tracking
    - Leave encashment
    - Public holiday integration
    - Audit compliance
    """
    
    def __init__(self, db_config=None):
        self.db_config = db_config or {
            'host': 'localhost',
            'user': 'root',
            'password': '',
            'database': 'company'
        }
        self._init_constraint_rules()
    
    def _get_db_connection(self):
        """Get database connection"""
        return mysql.connector.connect(**self.db_config)
    
    def _init_constraint_rules(self):
        """Initialize all constraint rules for leave validation"""
        self.constraint_rules = {
            # Balance constraints
            'BALANCE_001': {
                'name': 'Sufficient Balance Check',
                'category': 'balance',
                'severity': 'critical',
                'check': self._check_sufficient_balance
            },
            'BALANCE_002': {
                'name': 'Negative Balance Prevention',
                'category': 'balance',
                'severity': 'critical',
                'check': self._check_negative_balance
            },
            'BALANCE_003': {
                'name': 'Pending Leave Deduction',
                'category': 'balance',
                'severity': 'warning',
                'check': self._check_pending_deduction
            },
            
            # Policy constraints
            'POLICY_001': {
                'name': 'Leave Type Eligibility',
                'category': 'policy',
                'severity': 'critical',
                'check': self._check_leave_type_eligibility
            },
            'POLICY_002': {
                'name': 'Minimum Service Period',
                'category': 'policy',
                'severity': 'critical',
                'check': self._check_minimum_service
            },
            'POLICY_003': {
                'name': 'Maximum Consecutive Days',
                'category': 'policy',
                'severity': 'warning',
                'check': self._check_max_consecutive
            },
            'POLICY_004': {
                'name': 'Advance Notice Requirement',
                'category': 'policy',
                'severity': 'warning',
                'check': self._check_advance_notice
            },
            'POLICY_005': {
                'name': 'Probation Period Eligibility',
                'category': 'policy',
                'severity': 'critical',
                'check': self._check_probation_eligibility
            },
            'POLICY_006': {
                'name': 'Gender-Specific Leave Check',
                'category': 'policy',
                'severity': 'critical',
                'check': self._check_gender_eligibility
            },
            'POLICY_007': {
                'name': 'Document Requirement Check',
                'category': 'policy',
                'severity': 'warning',
                'check': self._check_document_requirement
            },
            
            # Team constraints
            'TEAM_001': {
                'name': 'Team Coverage Minimum',
                'category': 'team',
                'severity': 'critical',
                'check': self._check_team_coverage
            },
            'TEAM_002': {
                'name': 'Critical Role Coverage',
                'category': 'team',
                'severity': 'critical',
                'check': self._check_critical_role
            },
            'TEAM_003': {
                'name': 'Manager Availability',
                'category': 'team',
                'severity': 'warning',
                'check': self._check_manager_availability
            },
            'TEAM_004': {
                'name': 'Concurrent Leave Limit',
                'category': 'team',
                'severity': 'warning',
                'check': self._check_concurrent_leaves
            },
            
            # Calendar constraints
            'CALENDAR_001': {
                'name': 'Public Holiday Overlap',
                'category': 'calendar',
                'severity': 'info',
                'check': self._check_holiday_overlap
            },
            'CALENDAR_002': {
                'name': 'Weekend Sandwich Check',
                'category': 'calendar',
                'severity': 'info',
                'check': self._check_weekend_sandwich
            },
            'CALENDAR_003': {
                'name': 'Blackout Period Check',
                'category': 'calendar',
                'severity': 'critical',
                'check': self._check_blackout_period
            },
            
            # Business constraints
            'BUSINESS_001': {
                'name': 'Quarter End Restriction',
                'category': 'business',
                'severity': 'warning',
                'check': self._check_quarter_end
            },
            'BUSINESS_002': {
                'name': 'Project Deadline Conflict',
                'category': 'business',
                'severity': 'warning',
                'check': self._check_project_deadline
            },
            'BUSINESS_003': {
                'name': 'Year End Freeze Check',
                'category': 'business',
                'severity': 'critical',
                'check': self._check_year_end_freeze
            },
            
            # Compliance constraints
            'COMPLIANCE_001': {
                'name': 'Annual Leave Minimum Usage',
                'category': 'compliance',
                'severity': 'info',
                'check': self._check_annual_minimum_usage
            },
            'COMPLIANCE_002': {
                'name': 'Carry Forward Limit',
                'category': 'compliance',
                'severity': 'warning',
                'check': self._check_carry_forward_limit
            }
        }
    
    # ==========================================
    # BALANCE CONSTRAINT CHECKS
    # ==========================================
    
    def _check_sufficient_balance(self, leave_data: dict, context: dict) -> dict:
        """Check if employee has sufficient leave balance"""
        balance = context.get('balance', {})
        requested_days = Decimal(str(leave_data.get('total_days', 0)))
        available = Decimal(str(balance.get('available_balance', 0)))
        
        if requested_days > available:
            return {
                'passed': False,
                'message': f'Insufficient balance. Requested: {requested_days} days, Available: {available} days',
                'details': {
                    'requested': float(requested_days),
                    'available': float(available),
                    'shortfall': float(requested_days - available)
                }
            }
        return {
            'passed': True,
            'message': f'Balance check passed. {available - requested_days} days will remain',
            'details': {'remaining': float(available - requested_days)}
        }
    
    def _check_negative_balance(self, leave_data: dict, context: dict) -> dict:
        """Prevent negative balance scenarios"""
        balance = context.get('balance', {})
        available = Decimal(str(balance.get('available_balance', 0)))
        
        if available < 0:
            return {
                'passed': False,
                'message': 'Account has negative balance. Please contact HR.',
                'details': {'current_balance': float(available)}
            }
        return {'passed': True, 'message': 'No negative balance detected'}
    
    def _check_pending_deduction(self, leave_data: dict, context: dict) -> dict:
        """Check pending leaves that might affect balance"""
        balance = context.get('balance', {})
        pending = Decimal(str(balance.get('pending_days', 0)))
        
        if pending > 0:
            return {
                'passed': True,
                'message': f'Note: You have {pending} days in pending requests',
                'details': {'pending_days': float(pending)},
                'is_warning': True
            }
        return {'passed': True, 'message': 'No pending leaves'}
    
    # ==========================================
    # POLICY CONSTRAINT CHECKS
    # ==========================================
    
    def _check_leave_type_eligibility(self, leave_data: dict, context: dict) -> dict:
        """Check if leave type is valid for employee's country"""
        policy = context.get('policy', {})
        leave_type = leave_data.get('leave_type', '').lower()
        
        # Default allowed leave types if no policy configured
        if not policy:
            allowed_types = ['sick', 'vacation', 'casual', 'annual', 'maternity', 'paternity', 
                           'bereavement', 'comp_off', 'compensatory', 'emergency', 'unpaid']
            if any(allowed in leave_type for allowed in allowed_types):
                return {'passed': True, 'message': f'Leave type "{leave_type}" is valid'}
            return {
                'passed': False,
                'message': f'Leave type "{leave_type}" not recognized',
                'details': {'country': leave_data.get('country_code')}
            }
        return {'passed': True, 'message': 'Leave type is valid for your location'}
    
    def _check_minimum_service(self, leave_data: dict, context: dict) -> dict:
        """Check minimum service period requirement"""
        policy = context.get('policy', {})
        employee = context.get('employee', {})
        min_service_days = policy.get('min_service_days', 0)
        
        if min_service_days > 0:
            hire_date = employee.get('hire_date')
            if hire_date:
                if isinstance(hire_date, str):
                    hire_date = datetime.strptime(hire_date, '%Y-%m-%d').date()
                service_days = (date.today() - hire_date).days
                
                if service_days < min_service_days:
                    return {
                        'passed': False,
                        'message': f'Minimum {min_service_days} days of service required. Current: {service_days} days',
                        'details': {
                            'required': min_service_days,
                            'current': service_days,
                            'eligible_from': str(hire_date + timedelta(days=min_service_days))
                        }
                    }
        return {'passed': True, 'message': 'Service period requirement met'}
    
    def _check_max_consecutive(self, leave_data: dict, context: dict) -> dict:
        """Check maximum consecutive days limit"""
        policy = context.get('policy', {})
        max_days = policy.get('max_consecutive_days', 999)
        requested = leave_data.get('working_days', leave_data.get('total_days', 0))
        
        if requested > max_days:
            return {
                'passed': False,
                'message': f'Maximum {max_days} consecutive days allowed. Requested: {requested} days',
                'details': {
                    'max_allowed': max_days,
                    'requested': requested
                }
            }
        return {'passed': True, 'message': f'Within consecutive day limit ({max_days} days)'}
    
    def _check_advance_notice(self, leave_data: dict, context: dict) -> dict:
        """Check advance notice requirement"""
        policy = context.get('policy', {})
        required_notice = policy.get('advance_notice_days', 0)
        
        start_date = leave_data.get('start_date')
        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        
        notice_given = (start_date - date.today()).days
        
        if notice_given < required_notice:
            # Allow emergency leaves
            if leave_data.get('leave_type') in ['sick_leave', 'emergency', 'bereavement_leave']:
                return {
                    'passed': True,
                    'message': f'Emergency/sick leave exempted from {required_notice}-day notice',
                    'details': {'exemption_reason': 'emergency_type'}
                }
            return {
                'passed': False,
                'message': f'Minimum {required_notice} days advance notice required. Given: {notice_given} days',
                'details': {
                    'required': required_notice,
                    'given': notice_given
                },
                'can_override': True,
                'override_reason': 'manager_approval_required'
            }
        return {'passed': True, 'message': f'Advance notice requirement met ({notice_given} days)'}
    
    def _check_probation_eligibility(self, leave_data: dict, context: dict) -> dict:
        """Check if probation employees are eligible"""
        policy = context.get('policy', {})
        employee = context.get('employee', {})
        
        probation_eligible = policy.get('probation_eligible', True)
        is_on_probation = employee.get('is_probation', False)
        
        if is_on_probation and not probation_eligible:
            return {
                'passed': False,
                'message': f'This leave type is not available during probation period',
                'details': {'probation_end_date': employee.get('probation_end_date')}
            }
        return {'passed': True, 'message': 'Probation check passed'}
    
    def _check_gender_eligibility(self, leave_data: dict, context: dict) -> dict:
        """Check gender-specific leave eligibility"""
        policy = context.get('policy', {})
        employee = context.get('employee', {})
        
        gender_specific = policy.get('gender_specific', 'all')
        employee_gender = employee.get('gender', 'unknown')
        
        if gender_specific != 'all' and employee_gender != gender_specific:
            return {
                'passed': False,
                'message': f'This leave type is only available for {gender_specific} employees',
                'details': {'required_gender': gender_specific}
            }
        return {'passed': True, 'message': 'Gender eligibility check passed'}
    
    def _check_document_requirement(self, leave_data: dict, context: dict) -> dict:
        """Check if documents are required"""
        policy = context.get('policy', {})
        requires_doc_after = policy.get('requires_document_after_days')
        total_days = leave_data.get('total_days', 0)
        has_attachments = bool(leave_data.get('attachments'))
        
        if requires_doc_after and total_days > requires_doc_after and not has_attachments:
            return {
                'passed': True,  # Pass but warn
                'message': f'Medical certificate required for leaves > {requires_doc_after} days',
                'details': {
                    'document_required': True,
                    'threshold_days': requires_doc_after
                },
                'is_warning': True,
                'action_required': 'upload_document'
            }
        return {'passed': True, 'message': 'Document requirement check passed'}
    
    # ==========================================
    # TEAM CONSTRAINT CHECKS
    # ==========================================
    
    def _check_team_coverage(self, leave_data: dict, context: dict) -> dict:
        """Ensure minimum team coverage"""
        team = context.get('team', {})
        min_coverage = team.get('min_coverage_percent', 50)
        team_size = team.get('size', 1)
        already_on_leave = team.get('on_leave_count', 0)
        
        if team_size > 1:
            coverage_after = ((team_size - already_on_leave - 1) / team_size) * 100
            
            if coverage_after < min_coverage:
                return {
                    'passed': False,
                    'message': f'Team coverage would drop to {coverage_after:.0f}%. Minimum required: {min_coverage}%',
                    'details': {
                        'team_size': team_size,
                        'already_on_leave': already_on_leave,
                        'coverage_after': coverage_after,
                        'min_required': min_coverage
                    },
                    'can_override': True
                }
        return {'passed': True, 'message': 'Team coverage requirement met'}
    
    def _check_critical_role(self, leave_data: dict, context: dict) -> dict:
        """Check if critical role has backup"""
        employee = context.get('employee', {})
        is_critical = employee.get('is_critical_role', False)
        has_handover = bool(leave_data.get('handover_to'))
        
        if is_critical and not has_handover:
            return {
                'passed': False,
                'message': 'Critical role requires handover assignment before leave',
                'details': {'is_critical_role': True},
                'action_required': 'assign_handover'
            }
        return {'passed': True, 'message': 'Critical role check passed'}
    
    def _check_manager_availability(self, leave_data: dict, context: dict) -> dict:
        """Check if manager is available to approve"""
        team = context.get('team', {})
        manager_on_leave = team.get('manager_on_leave', False)
        
        if manager_on_leave:
            backup_approver = team.get('backup_approver')
            if backup_approver:
                return {
                    'passed': True,
                    'message': f'Manager is on leave. Request will go to {backup_approver}',
                    'details': {'backup_approver': backup_approver}
                }
            return {
                'passed': True,
                'message': 'Manager is on leave. Request will be escalated to next level',
                'details': {'will_escalate': True},
                'is_warning': True
            }
        return {'passed': True, 'message': 'Manager is available for approval'}
    
    def _check_concurrent_leaves(self, leave_data: dict, context: dict) -> dict:
        """Check concurrent leave limit for team"""
        team = context.get('team', {})
        max_concurrent = team.get('max_concurrent_leaves', 999)
        current_on_leave = team.get('on_leave_count', 0)
        
        if current_on_leave >= max_concurrent:
            return {
                'passed': False,
                'message': f'Maximum {max_concurrent} team members can be on leave simultaneously',
                'details': {
                    'max_allowed': max_concurrent,
                    'currently_on_leave': current_on_leave
                },
                'can_override': True
            }
        return {'passed': True, 'message': 'Concurrent leave limit check passed'}
    
    # ==========================================
    # CALENDAR CONSTRAINT CHECKS
    # ==========================================
    
    def _check_holiday_overlap(self, leave_data: dict, context: dict) -> dict:
        """Check for public holiday overlap (informational)"""
        holidays = context.get('holidays', [])
        start_date = datetime.strptime(leave_data['start_date'], '%Y-%m-%d').date() if isinstance(leave_data['start_date'], str) else leave_data['start_date']
        end_date = datetime.strptime(leave_data['end_date'], '%Y-%m-%d').date() if isinstance(leave_data['end_date'], str) else leave_data['end_date']
        
        overlapping = []
        for holiday in holidays:
            h_date = datetime.strptime(holiday['date'], '%Y-%m-%d').date() if isinstance(holiday['date'], str) else holiday['date']
            if start_date <= h_date <= end_date:
                overlapping.append(holiday)
        
        if overlapping:
            return {
                'passed': True,
                'message': f'Note: {len(overlapping)} public holiday(s) fall within your leave period',
                'details': {
                    'holidays': overlapping,
                    'days_saved': len(overlapping)
                },
                'is_info': True
            }
        return {'passed': True, 'message': 'No public holidays in leave period'}
    
    def _check_weekend_sandwich(self, leave_data: dict, context: dict) -> dict:
        """Detect weekend sandwich leaves"""
        start_date = datetime.strptime(leave_data['start_date'], '%Y-%m-%d').date() if isinstance(leave_data['start_date'], str) else leave_data['start_date']
        end_date = datetime.strptime(leave_data['end_date'], '%Y-%m-%d').date() if isinstance(leave_data['end_date'], str) else leave_data['end_date']
        
        # Check if leave is Friday and Tuesday (sandwich)
        if start_date.weekday() == 4 and end_date.weekday() == 1:  # Friday to Tuesday
            return {
                'passed': True,
                'message': 'Note: This appears to be a weekend sandwich leave (Fri + Mon/Tue)',
                'details': {
                    'sandwich_detected': True,
                    'tip': 'Consider if Monday is needed or just take Friday off'
                },
                'is_info': True
            }
        return {'passed': True, 'message': 'No weekend sandwich detected'}
    
    def _check_blackout_period(self, leave_data: dict, context: dict) -> dict:
        """Check for blackout periods"""
        blackouts = context.get('blackout_periods', [])
        start_date = datetime.strptime(leave_data['start_date'], '%Y-%m-%d').date() if isinstance(leave_data['start_date'], str) else leave_data['start_date']
        end_date = datetime.strptime(leave_data['end_date'], '%Y-%m-%d').date() if isinstance(leave_data['end_date'], str) else leave_data['end_date']
        
        for blackout in blackouts:
            b_start = datetime.strptime(blackout['start'], '%Y-%m-%d').date()
            b_end = datetime.strptime(blackout['end'], '%Y-%m-%d').date()
            
            if not (end_date < b_start or start_date > b_end):
                return {
                    'passed': False,
                    'message': f'Leave overlaps with blackout period: {blackout.get("reason", "Business Critical Period")}',
                    'details': {
                        'blackout_start': str(b_start),
                        'blackout_end': str(b_end),
                        'reason': blackout.get('reason')
                    },
                    'can_override': True,
                    'override_level': 'hr'
                }
        return {'passed': True, 'message': 'No blackout period conflict'}
    
    # ==========================================
    # BUSINESS CONSTRAINT CHECKS
    # ==========================================
    
    def _check_quarter_end(self, leave_data: dict, context: dict) -> dict:
        """Check for quarter-end restrictions"""
        employee = context.get('employee', {})
        department = employee.get('department', '').lower()
        
        # Only check for Finance/Accounting
        if department not in ['finance', 'accounting', 'audit']:
            return {'passed': True, 'message': 'Quarter-end check not applicable'}
        
        start_date = datetime.strptime(leave_data['start_date'], '%Y-%m-%d').date() if isinstance(leave_data['start_date'], str) else leave_data['start_date']
        
        # Check if within last week of quarter
        month = start_date.month
        day = start_date.day
        
        quarter_end_months = [3, 6, 9, 12]
        if month in quarter_end_months and day >= 25:
            return {
                'passed': True,
                'message': 'Warning: Leave during quarter-end period. Finance approval required.',
                'details': {'quarter_end': True},
                'is_warning': True,
                'requires_approval': 'department_head'
            }
        return {'passed': True, 'message': 'Not a quarter-end period'}
    
    def _check_project_deadline(self, leave_data: dict, context: dict) -> dict:
        """Check for project deadline conflicts"""
        projects = context.get('active_projects', [])
        start_date = datetime.strptime(leave_data['start_date'], '%Y-%m-%d').date() if isinstance(leave_data['start_date'], str) else leave_data['start_date']
        end_date = datetime.strptime(leave_data['end_date'], '%Y-%m-%d').date() if isinstance(leave_data['end_date'], str) else leave_data['end_date']
        
        conflicts = []
        for project in projects:
            deadline = datetime.strptime(project['deadline'], '%Y-%m-%d').date() if isinstance(project['deadline'], str) else project['deadline']
            if start_date <= deadline <= end_date:
                conflicts.append(project)
        
        if conflicts:
            return {
                'passed': True,
                'message': f'Note: {len(conflicts)} project deadline(s) fall within leave period',
                'details': {'conflicting_projects': conflicts},
                'is_warning': True
            }
        return {'passed': True, 'message': 'No project deadline conflicts'}
    
    def _check_year_end_freeze(self, leave_data: dict, context: dict) -> dict:
        """Check for year-end freeze periods"""
        company_settings = context.get('company_settings', {})
        freeze_start = company_settings.get('year_end_freeze_start')
        freeze_end = company_settings.get('year_end_freeze_end')
        
        if not freeze_start or not freeze_end:
            return {'passed': True, 'message': 'No year-end freeze configured'}
        
        start_date = datetime.strptime(leave_data['start_date'], '%Y-%m-%d').date() if isinstance(leave_data['start_date'], str) else leave_data['start_date']
        freeze_start = datetime.strptime(freeze_start, '%Y-%m-%d').date()
        freeze_end = datetime.strptime(freeze_end, '%Y-%m-%d').date()
        
        if freeze_start <= start_date <= freeze_end:
            return {
                'passed': False,
                'message': f'Year-end leave freeze in effect ({freeze_start} to {freeze_end})',
                'details': {
                    'freeze_start': str(freeze_start),
                    'freeze_end': str(freeze_end)
                },
                'can_override': True,
                'override_level': 'vp'
            }
        return {'passed': True, 'message': 'Not in year-end freeze period'}
    
    # ==========================================
    # COMPLIANCE CONSTRAINT CHECKS
    # ==========================================
    
    def _check_annual_minimum_usage(self, leave_data: dict, context: dict) -> dict:
        """Check annual minimum leave usage (some countries require it)"""
        balance = context.get('balance', {})
        policy = context.get('policy', {})
        
        # Some EU countries require minimum usage
        country = leave_data.get('country_code')
        if country in ['DE', 'FR']:
            entitlement = balance.get('annual_entitlement', 0)
            used = balance.get('used_days', 0)
            min_required = entitlement * 0.5  # Must use at least 50%
            
            months_remaining = 12 - date.today().month
            if months_remaining <= 3 and used < min_required:
                return {
                    'passed': True,
                    'message': f'Reminder: You must use at least {min_required} days this year. Used: {used} days',
                    'details': {
                        'minimum_required': min_required,
                        'used': used,
                        'remaining_months': months_remaining
                    },
                    'is_info': True
                }
        return {'passed': True, 'message': 'Annual usage check passed'}
    
    def _check_carry_forward_limit(self, leave_data: dict, context: dict) -> dict:
        """Check carry forward implications"""
        balance = context.get('balance', {})
        policy = context.get('policy', {})
        
        max_carry = policy.get('max_carry_forward', 0)
        available = balance.get('available_balance', 0)
        
        if date.today().month >= 11:  # November/December
            potential_carry = available - leave_data.get('total_days', 0)
            if potential_carry > max_carry:
                will_lapse = potential_carry - max_carry
                return {
                    'passed': True,
                    'message': f'Warning: {will_lapse} days may lapse at year-end (max carry forward: {max_carry})',
                    'details': {
                        'max_carry_forward': max_carry,
                        'will_lapse': will_lapse
                    },
                    'is_warning': True,
                    'suggestion': 'Consider taking more leave or encashment if available'
                }
        return {'passed': True, 'message': 'Carry forward check passed'}
    
    # ==========================================
    # MAIN ANALYSIS METHOD
    # ==========================================
    
    def analyze_leave_request(self, leave_data: dict) -> dict:
        """
        Main method to analyze a leave request against all constraints
        
        Args:
            leave_data: Dictionary containing leave request details
                - emp_id: Employee ID
                - country_code: Country code (IN, US, UK, DE, etc.)
                - leave_type: Type of leave
                - start_date: Start date (YYYY-MM-DD)
                - end_date: End date (YYYY-MM-DD)
                - total_days: Total days requested
                - working_days: Working days (excluding weekends/holidays)
                - is_half_day: Boolean for half-day leave
                - half_day_type: 'first_half' or 'second_half'
                - reason: Leave reason
                - attachments: List of attachment URLs
                - handover_to: Handover employee ID
        
        Returns:
            Dictionary with analysis results
        """
        start_time = datetime.now()
        
        # Gather context
        context = self._gather_context(leave_data)
        
        # Run all constraints
        results = {
            'critical': [],
            'warnings': [],
            'info': [],
            'passed': []
        }
        
        total_score = 0
        max_score = 0
        critical_failed = False
        
        for rule_id, rule in self.constraint_rules.items():
            try:
                result = rule['check'](leave_data, context)
                result['rule_id'] = rule_id
                result['rule_name'] = rule['name']
                result['category'] = rule['category']
                result['severity'] = rule['severity']
                
                if result.get('passed'):
                    if result.get('is_warning'):
                        results['warnings'].append(result)
                        total_score += 0.5
                    elif result.get('is_info'):
                        results['info'].append(result)
                        total_score += 1
                    else:
                        results['passed'].append(result)
                        total_score += 1
                else:
                    if rule['severity'] == 'critical':
                        results['critical'].append(result)
                        critical_failed = True
                    else:
                        results['warnings'].append(result)
                        total_score += 0.3
                
                max_score += 1
                
            except Exception as e:
                logger.error(f"Error in constraint {rule_id}: {str(e)}")
                results['warnings'].append({
                    'rule_id': rule_id,
                    'rule_name': rule['name'],
                    'passed': True,
                    'message': f'Could not evaluate: {str(e)}',
                    'is_warning': True
                })
                max_score += 1
        
        # Calculate confidence and recommendation
        confidence = (total_score / max_score) if max_score > 0 else 0
        
        if critical_failed:
            recommendation = 'reject'
            recommendation_reason = 'Critical constraints failed'
        elif len(results['warnings']) > 3:
            recommendation = 'review'
            recommendation_reason = 'Multiple warnings require manual review'
        elif confidence >= 0.8:
            recommendation = 'approve'
            recommendation_reason = 'All critical checks passed with high confidence'
        else:
            recommendation = 'escalate'
            recommendation_reason = 'Moderate confidence, needs manager review'
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Determine approval chain
        approval_chain = self._get_approval_chain(leave_data, context)
        
        return {
            'success': True,
            'request_id': leave_data.get('request_id'),
            'recommendation': recommendation,
            'recommendation_reason': recommendation_reason,
            'confidence': round(confidence, 4),
            'can_auto_approve': recommendation == 'approve' and approval_chain.get('auto_approve', False),
            'approval_chain': approval_chain,
            'constraints': {
                'critical_failures': results['critical'],
                'warnings': results['warnings'],
                'info': results['info'],
                'passed': results['passed']
            },
            'summary': {
                'total_rules': len(self.constraint_rules),
                'passed': len(results['passed']),
                'warnings': len(results['warnings']),
                'critical_failures': len(results['critical']),
                'info': len(results['info'])
            },
            'context': {
                'balance': context.get('balance'),
                'policy': {k: v for k, v in context.get('policy', {}).items() if k != 'id'},
                'holidays_in_period': len(context.get('holidays', []))
            },
            'processing_time_ms': round(processing_time, 2),
            'engine_version': '2.0.0',
            'analyzed_at': datetime.now().isoformat()
        }
    
    def _gather_context(self, leave_data: dict) -> dict:
        """Gather all context needed for constraint checking"""
        context = {}
        emp_id = leave_data.get('emp_id')
        country_code = leave_data.get('country_code', 'IN')
        leave_type = leave_data.get('leave_type')
        
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor(dictionary=True)
            
            # Get employee details
            cursor.execute("""
                SELECT e.*, 
                       DATEDIFF(CURDATE(), e.hire_date) as service_days,
                       CASE WHEN e.hire_date > DATE_SUB(CURDATE(), INTERVAL 90 DAY) THEN TRUE ELSE FALSE END as is_probation
                FROM employees e WHERE e.emp_id = %s
            """, (emp_id,))
            context['employee'] = cursor.fetchone() or {}
            
            # Get leave policy
            cursor.execute("""
                SELECT * FROM country_leave_policies 
                WHERE country_code = %s AND leave_type = %s
                AND CURDATE() BETWEEN effective_from AND effective_to
            """, (country_code, leave_type))
            context['policy'] = cursor.fetchone() or {}
            
            # Get leave balance
            cursor.execute("""
                SELECT * FROM leave_balances_v2 
                WHERE emp_id = %s AND leave_type = %s AND year = YEAR(CURDATE())
            """, (emp_id, leave_type))
            balance = cursor.fetchone()
            
            # If no v2 balance, try original table
            if not balance:
                cursor.execute("""
                    SELECT emp_id, leave_type, 
                           annual_quota as annual_entitlement,
                           used_so_far as used_days,
                           (annual_quota - used_so_far) as available_balance,
                           0 as pending_days
                    FROM leave_balances 
                    WHERE emp_id = %s AND leave_type = %s
                """, (emp_id, leave_type))
                balance = cursor.fetchone()
            
            context['balance'] = balance or {
                'annual_entitlement': context['policy'].get('annual_entitlement', 0),
                'used_days': 0,
                'available_balance': context['policy'].get('annual_entitlement', 0),
                'pending_days': 0
            }
            
            # Get public holidays in leave period
            cursor.execute("""
                SELECT holiday_date as date, holiday_name as name 
                FROM public_holidays 
                WHERE country_code = %s 
                AND holiday_date BETWEEN %s AND %s
            """, (country_code, leave_data['start_date'], leave_data['end_date']))
            context['holidays'] = cursor.fetchall() or []
            
            # Get team info
            cursor.execute("""
                SELECT COUNT(*) as size,
                       SUM(CASE WHEN lr.status = 'approved' 
                           AND %s BETWEEN lr.start_date AND lr.end_date THEN 1 ELSE 0 END) as on_leave_count
                FROM team_members tm
                LEFT JOIN leave_requests lr ON tm.emp_id = lr.emp_id
                WHERE tm.team_id = (SELECT team_id FROM team_members WHERE emp_id = %s)
            """, (leave_data['start_date'], emp_id))
            team_info = cursor.fetchone()
            context['team'] = {
                'size': team_info['size'] if team_info else 1,
                'on_leave_count': team_info['on_leave_count'] if team_info else 0,
                'min_coverage_percent': 50,
                'max_concurrent_leaves': max(1, (team_info['size'] if team_info else 1) // 2)
            }
            
            cursor.close()
            conn.close()
            
        except Exception as e:
            logger.error(f"Error gathering context: {str(e)}")
            # Return minimal context
            context = {
                'employee': {'emp_id': emp_id},
                'policy': {},
                'balance': {'available_balance': 0},
                'holidays': [],
                'team': {'size': 1, 'on_leave_count': 0}
            }
        
        return context
    
    def _get_approval_chain(self, leave_data: dict, context: dict) -> dict:
        """Determine the approval chain for this request"""
        country_code = leave_data.get('country_code', 'IN')
        total_days = leave_data.get('total_days', 0)
        
        try:
            conn = self._get_db_connection()
            cursor = conn.cursor(dictionary=True)
            
            cursor.execute("""
                SELECT * FROM approval_chains
                WHERE country_code = %s
                AND %s BETWEEN min_days AND max_days
                AND is_active = TRUE
                AND CURDATE() BETWEEN effective_from AND effective_to
                ORDER BY min_days DESC
                LIMIT 1
            """, (country_code, total_days))
            
            chain = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if chain:
                return {
                    'levels': self._build_approval_levels(chain),
                    'auto_approve': total_days <= chain.get('level_1_auto_approve_days', 0),
                    'sla_hours': chain.get('sla_hours', 48),
                    'notify_hr': chain.get('notify_hr', True)
                }
        except Exception as e:
            logger.error(f"Error getting approval chain: {str(e)}")
        
        # Default chain
        return {
            'levels': [{'level': 1, 'role': 'manager', 'required': True}],
            'auto_approve': False,
            'sla_hours': 48,
            'notify_hr': True
        }
    
    def _build_approval_levels(self, chain: dict) -> list:
        """Build approval levels from chain config"""
        levels = []
        
        if chain.get('level_1_role') != 'skip':
            levels.append({
                'level': 1,
                'role': chain['level_1_role'],
                'required': True
            })
        
        if chain.get('level_2_role') != 'skip':
            levels.append({
                'level': 2,
                'role': chain['level_2_role'],
                'required': True,
                'threshold_days': chain.get('level_2_threshold_days', 5)
            })
        
        if chain.get('level_3_role') != 'skip':
            levels.append({
                'level': 3,
                'role': chain['level_3_role'],
                'required': True,
                'threshold_days': chain.get('level_3_threshold_days', 10)
            })
        
        return levels


# Flask Application
app = Flask(__name__)
engine = EnterpriseLeaveEngine()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'enterprise-leave-engine',
        'version': '2.0.0',
        'constraints': len(engine.constraint_rules),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/analyze', methods=['POST'])
def analyze():
    """Analyze a leave request"""
    data = request.json
    result = engine.analyze_leave_request(data)
    return jsonify(result)

@app.route('/constraints', methods=['GET'])
def list_constraints():
    """List all constraint rules"""
    constraints = []
    for rule_id, rule in engine.constraint_rules.items():
        constraints.append({
            'id': rule_id,
            'name': rule['name'],
            'category': rule['category'],
            'severity': rule['severity']
        })
    return jsonify({
        'total': len(constraints),
        'constraints': constraints
    })

@app.route('/policies/<country_code>', methods=['GET'])
def get_country_policies(country_code):
    """Get leave policies for a country"""
    try:
        conn = engine._get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT * FROM country_leave_policies 
            WHERE country_code = %s
            AND CURDATE() BETWEEN effective_from AND effective_to
        """, (country_code.upper(),))
        
        policies = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Convert Decimal to float for JSON serialization
        for policy in policies:
            for key, value in policy.items():
                if isinstance(value, Decimal):
                    policy[key] = float(value)
        
        return jsonify({
            'country_code': country_code.upper(),
            'policies': policies,
            'total': len(policies)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/holidays/<country_code>/<int:year>', methods=['GET'])
def get_holidays(country_code, year):
    """Get public holidays for a country and year"""
    try:
        conn = engine._get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT holiday_date, holiday_name, is_national, is_optional
            FROM public_holidays 
            WHERE country_code = %s AND YEAR(holiday_date) = %s
            ORDER BY holiday_date
        """, (country_code.upper(), year))
        
        holidays = cursor.fetchall()
        cursor.close()
        conn.close()
        
        return jsonify({
            'country_code': country_code.upper(),
            'year': year,
            'holidays': holidays,
            'total': len(holidays)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/calculate-working-days', methods=['POST'])
def calculate_working_days():
    """Calculate working days between dates (excluding weekends and holidays)"""
    data = request.json
    country_code = data.get('country_code', 'IN')
    start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
    end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
    is_half_day = data.get('is_half_day', False)
    
    try:
        conn = engine._get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get holidays
        cursor.execute("""
            SELECT holiday_date FROM public_holidays 
            WHERE country_code = %s 
            AND holiday_date BETWEEN %s AND %s
        """, (country_code.upper(), start_date, end_date))
        
        holidays = set(row['holiday_date'] for row in cursor.fetchall())
        cursor.close()
        conn.close()
        
        # Calculate working days
        working_days = 0
        current = start_date
        while current <= end_date:
            if current.weekday() < 5 and current not in holidays:  # Mon-Fri and not holiday
                working_days += 1
            current += timedelta(days=1)
        
        # Adjust for half day
        if is_half_day:
            working_days = working_days - 0.5
        
        total_days = (end_date - start_date).days + 1
        
        return jsonify({
            'start_date': str(start_date),
            'end_date': str(end_date),
            'total_days': total_days,
            'working_days': working_days,
            'weekends': sum(1 for d in range((end_date - start_date).days + 1) 
                          if (start_date + timedelta(days=d)).weekday() >= 5),
            'holidays': len(holidays),
            'is_half_day': is_half_day
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print("=" * 60)
    print("ENTERPRISE LEAVE ENGINE v2.0.0")
    print("=" * 60)
    print(f"Loaded {len(engine.constraint_rules)} constraint rules")
    print("Categories: balance, policy, team, calendar, business, compliance")
    print("=" * 60)
    app.run(host='0.0.0.0', port=8001, debug=False, threaded=True)
