import { Loan, MonthlyDue, PaymentAllocation, Adjustment, Person, PersonFinancialSummary, DashboardStats, DueStatus } from '../types';

/**
 * Safely parse a monetary number or default to 0
 */
export const roundMoney = (amount: number): number => {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

/**
 * Sum original amounts of all active loans
 */
export const calculateTotalBorrowed = (loans: Loan[]): number => {
  return roundMoney(
    loans.reduce((acc, loan) => acc + (Number(loan.original_amount) || 0), 0)
  );
};

/**
 * Sum all valid payment allocations plus dues explicitly marked as PAID
 */
export const calculateTotalPaid = (
  allocations: PaymentAllocation[] = [],
  dues: MonthlyDue[] = []
): number => {
  const allocPaid = allocations.reduce(
    (acc, alloc) => acc + (Number(alloc.amount) || 0),
    0
  );
  const paidDuesWithoutAlloc = dues.filter(
    (d) =>
      d.status === 'PAID' &&
      !allocations.some((a) => a.monthly_due_id === d.id)
  );
  const paidDuesSum = paidDuesWithoutAlloc.reduce(
    (acc, d) => acc + (Number(d.current_amount) || 0),
    0
  );
  return roundMoney(allocPaid + paidDuesSum);
};

/**
 * Calculate remaining outstanding amount for a single loan
 */
export const calculateLoanRemaining = (
  loan: Loan,
  allocations: PaymentAllocation[] = [],
  adjustments: Adjustment[] = [],
  dues: MonthlyDue[] = []
): number => {
  const original = Number(loan.original_amount) || 0;
  const loanAllocations = allocations.filter((a) => a.loan_id === loan.id);
  let paid = loanAllocations.reduce((acc, a) => acc + (Number(a.amount) || 0), 0);

  // Add paid amount from dues explicitly marked as PAID without allocation record
  const paidDuesWithoutAlloc = dues.filter(
    (d) =>
      d.loan_id === loan.id &&
      d.status === 'PAID' &&
      !loanAllocations.some((a) => a.monthly_due_id === d.id)
  );
  const paidDuesSum = paidDuesWithoutAlloc.reduce(
    (acc, d) => acc + (Number(d.current_amount) || 0),
    0
  );
  paid += paidDuesSum;

  const loanAdjustments = adjustments.filter((adj) => adj.loan_id === loan.id);
  const waived = loanAdjustments
    .filter((a) => a.adjustment_type === 'WAIVER')
    .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
  const addCorrections = loanAdjustments
    .filter(
      (a) =>
        a.adjustment_type === 'CORRECTION_ADD' ||
        a.adjustment_type === 'OPENING_BALANCE'
    )
    .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
  const subCorrections = loanAdjustments
    .filter((a) => a.adjustment_type === 'CORRECTION_SUB')
    .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);

  const remaining = original - paid - waived + addCorrections - subCorrections;
  return roundMoney(Math.max(remaining, 0));
};

/**
 * Calculate paid amount for a monthly due record
 */
export const calculateDuePaid = (
  due: MonthlyDue,
  allocations: PaymentAllocation[] = []
): number => {
  const current = Number(due.current_amount) || 0;
  const dueAllocations = allocations.filter((a) => a.monthly_due_id === due.id);
  const allocSum = dueAllocations.reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
  if (due.status === 'PAID') {
    return roundMoney(Math.max(allocSum, current));
  }
  return roundMoney(allocSum);
};

/**
 * Calculate remaining pending amount for a monthly due record
 */
export const calculateDueRemaining = (
  due: MonthlyDue,
  allocations: PaymentAllocation[] = []
): number => {
  if (due.status === 'PAID' || due.status === 'WAIVED' || due.status === 'SKIPPED') {
    return 0;
  }
  const current = Number(due.current_amount) || 0;
  const paid = calculateDuePaid(due, allocations);
  return roundMoney(Math.max(current - paid, 0));
};

/**
 * Derive status of a monthly due record based on payments and date
 */
export const deriveDueStatus = (
  due: MonthlyDue,
  paid: number,
  todayStr: string = new Date().toISOString().split('T')[0]
): DueStatus => {
  if (due.status === 'WAIVED' || due.status === 'SKIPPED') {
    return due.status;
  }
  const current = Number(due.current_amount) || 0;
  if (due.status === 'PAID' || (paid >= current && current > 0)) {
    return 'PAID';
  }
  if (paid > 0) {
    return 'PARTIALLY_PAID';
  }
  if (due.due_date < todayStr) {
    return 'OVERDUE';
  }
  if (due.due_date > todayStr) {
    return 'UPCOMING';
  }
  return 'PENDING';
};

/**
 * Helper to get active target dues for a person or dashboard.
 * If current month's due is paid/passed, automatically rolls over to the NEXT upcoming unpaid due.
 */
export const getActiveTargetDues = (
  allDues: MonthlyDue[],
  allocations: PaymentAllocation[],
  currentMonthStr: string,
  todayStr: string
): MonthlyDue[] => {
  // 1. Dues for current month or overdue past dues that have remaining balance
  const currentOrOverdueUnpaid = allDues.filter((d) => {
    if (d.status === 'PAID' || d.status === 'WAIVED' || d.status === 'SKIPPED') return false;
    const remaining = calculateDueRemaining(d, allocations);
    return remaining > 0 && (d.due_month <= currentMonthStr || d.due_date <= todayStr);
  });

  if (currentOrOverdueUnpaid.length > 0) {
    return currentOrOverdueUnpaid;
  }

  // 2. If current/past month dues are cleared, find the earliest NEXT upcoming unpaid due
  const upcomingUnpaid = allDues
    .filter((d) => {
      if (d.status === 'PAID' || d.status === 'WAIVED' || d.status === 'SKIPPED') return false;
      const remaining = calculateDueRemaining(d, allocations);
      return remaining > 0 && d.due_date > todayStr;
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  if (upcomingUnpaid.length > 0) {
    const nextDueMonth = upcomingUnpaid[0].due_month;
    return upcomingUnpaid.filter((d) => d.due_month === nextDueMonth);
  }

  // 3. Fallback: if all dues ever are paid, return current month dues list
  return allDues.filter((d) => d.due_month === currentMonthStr);
};

/**
 * Aggregate complete financial profile summary for a Person
 */
export const aggregatePersonSummary = (
  person: Person,
  loans: Loan[],
  dues: MonthlyDue[],
  allocations: PaymentAllocation[],
  adjustments: Adjustment[],
  currentMonthStr: string = new Date().toISOString().slice(0, 7),
  todayStr: string = new Date().toISOString().split('T')[0]
): PersonFinancialSummary => {
  const personLoans = loans.filter((l) => l.person_id === person.id);
  const total_borrowed = calculateTotalBorrowed(personLoans);

  const personDues = dues.filter((d) => d.person_id === person.id);
  const personAllocations = allocations.filter((a) =>
    personLoans.some((l) => l.id === a.loan_id)
  );
  const total_paid = calculateTotalPaid(personAllocations, personDues);

  const personAdjustments = adjustments.filter((adj) => adj.person_id === person.id);
  const totalWaivers = personAdjustments
    .filter((a) => a.adjustment_type === 'WAIVER')
    .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
  const totalAdd = personAdjustments
    .filter((a) => a.adjustment_type === 'CORRECTION_ADD' || a.adjustment_type === 'OPENING_BALANCE')
    .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
  const totalSub = personAdjustments
    .filter((a) => a.adjustment_type === 'CORRECTION_SUB')
    .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);

  const outstanding = roundMoney(
    Math.max(total_borrowed - total_paid - totalWaivers + totalAdd - totalSub, 0)
  );

  // Use rolling active dues logic
  const activeDuesList = getActiveTargetDues(personDues, allocations, currentMonthStr, todayStr);

  const current_month_due = roundMoney(
    activeDuesList.reduce((acc, d) => acc + (Number(d.current_amount) || 0), 0)
  );

  const current_month_paid = roundMoney(
    activeDuesList.reduce((acc, d) => acc + calculateDuePaid(d, allocations), 0)
  );

  const current_month_pending = roundMoney(
    Math.max(current_month_due - current_month_paid, 0)
  );

  // Overdue dues: due_date < todayStr and not fully paid and not waived/skipped
  const overdueDues = personDues.filter((d) => {
    if (d.status === 'PAID' || d.status === 'WAIVED' || d.status === 'SKIPPED') return false;
    const remaining = calculateDueRemaining(d, allocations);
    return d.due_date < todayStr && remaining > 0;
  });

  const overdue_amount = roundMoney(
    overdueDues.reduce((acc, d) => acc + calculateDueRemaining(d, allocations), 0)
  );

  const active_loans_count = personLoans.filter((l) => l.status === 'ACTIVE').length;

  let status: DueStatus | 'NO_DUE' = 'NO_DUE';
  if (overdue_amount > 0) {
    status = 'OVERDUE';
  } else if (current_month_pending > 0 && current_month_paid > 0) {
    status = 'PARTIALLY_PAID';
  } else if (current_month_pending > 0) {
    status = 'PENDING';
  } else if (current_month_due > 0 && current_month_pending === 0) {
    status = 'PAID';
  }

  return {
    person,
    total_borrowed,
    total_paid,
    outstanding,
    current_month_due,
    current_month_paid,
    current_month_pending,
    overdue_amount,
    active_loans_count,
    status,
  };
};

/**
 * Calculate Overall Dashboard High-Level Statistics
 */
export const calculateDashboardStats = (
  loans: Loan[],
  dues: MonthlyDue[],
  allocations: PaymentAllocation[],
  adjustments: Adjustment[],
  currentMonthStr: string = new Date().toISOString().slice(0, 7),
  todayStr: string = new Date().toISOString().split('T')[0]
): DashboardStats => {
  const total_given = calculateTotalBorrowed(loans);
  const total_paid = calculateTotalPaid(allocations, dues);

  const totalWaivers = adjustments
    .filter((a) => a.adjustment_type === 'WAIVER')
    .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
  const totalAdd = adjustments
    .filter((a) => a.adjustment_type === 'CORRECTION_ADD' || a.adjustment_type === 'OPENING_BALANCE')
    .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
  const totalSub = adjustments
    .filter((a) => a.adjustment_type === 'CORRECTION_SUB')
    .reduce((acc, a) => acc + (Number(a.amount) || 0), 0);

  const total_outstanding = roundMoney(
    Math.max(total_given - total_paid - totalWaivers + totalAdd - totalSub, 0)
  );

  const activeDashboardDues = getActiveTargetDues(dues, allocations, currentMonthStr, todayStr);
  const due_this_month = roundMoney(
    activeDashboardDues.reduce((acc, d) => acc + (Number(d.current_amount) || 0), 0)
  );
  const next_due_date = activeDashboardDues.length > 0 ? activeDashboardDues[0].due_date : null;

  const currentMonthDues = dues.filter((d) => d.due_month === currentMonthStr);
  const received_this_month = roundMoney(
    currentMonthDues.reduce((acc, d) => acc + calculateDuePaid(d, allocations), 0)
  );

  const overdueDues = dues.filter((d) => {
    if (d.status === 'PAID' || d.status === 'WAIVED' || d.status === 'SKIPPED') return false;
    const remaining = calculateDueRemaining(d, allocations);
    return d.due_date < todayStr && remaining > 0;
  });

  const overdue_amount = roundMoney(
    overdueDues.reduce((acc, d) => acc + calculateDueRemaining(d, allocations), 0)
  );

  // Count distinct people with pending or overdue dues
  const pendingPersonIds = new Set<string>();
  dues.forEach((d) => {
    if (d.person_id) {
      if (calculateDueRemaining(d, allocations) > 0 && d.status !== 'PAID' && d.status !== 'WAIVED' && d.status !== 'SKIPPED') {
        pendingPersonIds.add(d.person_id);
      }
    }
  });

  return {
    total_given,
    total_outstanding,
    due_this_month,
    received_this_month,
    overdue_amount,
    pending_people_count: pendingPersonIds.size,
    next_due_date,
  };
};

/**
 * Auto-allocate a lump-sum payment across multiple loans/dues
 * Oldest overdue dues get allocated first.
 */
export const autoAllocatePayment = (
  paymentAmount: number,
  personDues: MonthlyDue[],
  personLoans: Loan[],
  allocations: PaymentAllocation[]
): {
  allocatedDues: { due_id: string; loan_id: string; amount: number }[];
  remainingExcess: number;
} => {
  let unallocated = paymentAmount;
  const result: { due_id: string; loan_id: string; amount: number }[] = [];

  // Sort dues by due_date ascending (oldest first)
  const sortedDues = [...personDues]
    .filter((d) => d.status !== 'PAID' && d.status !== 'WAIVED' && d.status !== 'SKIPPED')
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  for (const due of sortedDues) {
    if (unallocated <= 0) break;
    const remaining = calculateDueRemaining(due, allocations);
    if (remaining > 0) {
      const applyAmount = Math.min(unallocated, remaining);
      result.push({
        due_id: due.id,
        loan_id: due.loan_id,
        amount: roundMoney(applyAmount),
      });
      unallocated = roundMoney(unallocated - applyAmount);
    }
  }

  return {
    allocatedDues: result,
    remainingExcess: roundMoney(Math.max(unallocated, 0)),
  };
};
