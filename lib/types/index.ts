export type BorrowerType = 'PERSON' | 'MYSELF';
export type RepaymentType = 'FIXED_EMI' | 'FLEXIBLE';
export type LoanStatus = 'ACTIVE' | 'PAUSED' | 'CLOSED' | 'ARCHIVED';
export type DueStatus = 'UPCOMING' | 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'WAIVED' | 'SKIPPED';
export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'OTHER';
export type AllocationType = 'DUE_PAYMENT' | 'PRINCIPAL_REDUCTION' | 'ADVANCE_CREDIT' | 'NEXT_MONTH_DUE';
export type AdjustmentType = 'CORRECTION_ADD' | 'CORRECTION_SUB' | 'WAIVER' | 'OPENING_BALANCE';
export type ReminderType = 'NORMAL' | 'UPCOMING' | 'OVERDUE' | 'PARTIAL';

export interface Profile {
  id: string;
  email: string;
  full_name?: string | null;
  default_currency: string;
  default_country_code: string;
  created_at: string;
  updated_at: string;
}

export interface Person {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  country_code: string;
  email?: string | null;
  notes?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoanSource {
  id: string;
  user_id: string;
  name: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Loan {
  id: string;
  user_id: string;
  person_id?: string | null;
  borrower_type: BorrowerType;
  loan_source_id?: string | null;
  original_amount: number;
  default_due_amount?: number | null;
  repayment_type: RepaymentType;
  taken_date: string;
  first_due_date?: string | null;
  default_due_day?: number | null;
  installment_count?: number | null;
  notes?: string | null;
  status: LoanStatus;
  created_at: string;
  updated_at: string;

  // Joined fields
  person?: Person | null;
  loan_source?: LoanSource | null;
}

export interface MonthlyDue {
  id: string;
  user_id: string;
  loan_id: string;
  person_id?: string | null;
  due_month: string; // YYYY-MM
  due_date: string; // YYYY-MM-DD
  original_amount: number;
  current_amount: number;
  status: DueStatus;
  is_manually_adjusted: boolean;
  adjustment_reason?: string | null;
  carried_from_due_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  loan?: Loan | null;
  person?: Person | null;
  amount_paid?: number;
  remaining_due?: number;
}

export interface Payment {
  id: string;
  user_id: string;
  person_id?: string | null;
  loan_id?: string | null;
  monthly_due_id?: string | null;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  notes?: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  person?: Person | null;
  loan?: Loan | null;
  monthly_due?: MonthlyDue | null;
  allocations?: PaymentAllocation[];
}

export interface PaymentAllocation {
  id: string;
  user_id: string;
  payment_id: string;
  monthly_due_id?: string | null;
  loan_id: string;
  amount: number;
  allocation_type: AllocationType;
  created_at: string;
}

export interface Adjustment {
  id: string;
  user_id: string;
  person_id?: string | null;
  loan_id?: string | null;
  monthly_due_id?: string | null;
  amount: number;
  adjustment_type: AdjustmentType;
  reason: string;
  adjustment_date: string;
  created_at: string;

  // Joined fields
  person?: Person | null;
  loan?: Loan | null;
  monthly_due?: MonthlyDue | null;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values?: any;
  new_values?: any;
  reason?: string | null;
  created_at: string;
}

export interface ReminderTemplate {
  id: string;
  user_id: string;
  name: string;
  template: string;
  type: ReminderType;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_given: number;
  total_paid: number;
  total_outstanding: number;
  due_this_month: number;
  received_this_month: number;
  overdue_amount: number;
  pending_people_count: number;
  next_due_date?: string | null;
}

export interface PersonFinancialSummary {
  person: Person;
  total_borrowed: number;
  total_paid: number;
  outstanding: number;
  current_month_due: number;
  current_month_paid: number;
  current_month_pending: number;
  overdue_amount: number;
  active_loans_count: number;
  status: DueStatus | 'NO_DUE';
}
