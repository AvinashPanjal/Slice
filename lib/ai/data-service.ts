import { createClient } from '@supabase/supabase-js';
import {
  calculateDashboardStats,
  aggregatePersonSummary,
  calculateLoanRemaining,
  calculateTotalPaid,
  calculateDuePaid,
  calculateDueRemaining,
  roundMoney,
} from '@/lib/calculations';
import { getCurrentMonthStr, getTodayStr, formatDateDisplay } from '@/lib/utils/date';
import type { Person, Loan, LoanSource, MonthlyDue, PaymentAllocation, Adjustment } from '@/lib/types';

/**
 * Creates a strictly READ-ONLY Supabase client.
 * Prioritizes SUPABASE_SERVICE_ROLE_KEY (to bypass RLS for server-side AI access),
 * falling back to NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
function getReadOnlySupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    return null;
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Fetches all necessary data from the database using strictly READ-ONLY SELECT queries.
 * NEVER performs any insert, update, delete, or schema mutations.
 */
async function fetchReadOnlySnapshot() {
  const supabase = getReadOnlySupabase();
  if (!supabase) {
    throw new Error('Supabase configuration missing in environment variables.');
  }

  const [
    { data: people, error: pErr },
    { data: sources, error: sErr },
    { data: loans, error: lErr },
    { data: dues, error: dErr },
    { data: allocations, error: aErr },
    { data: adjustments, error: adjErr },
  ] = await Promise.all([
    supabase.from('people').select('*').eq('is_archived', false).order('name'),
    supabase.from('loan_sources').select('*').order('name'),
    supabase.from('loans').select('*, person:people(*), loan_source:loan_sources(*)').order('created_at', { ascending: false }),
    supabase.from('monthly_dues').select('*, person:people(*), loan:loans(*)').order('due_date', { ascending: true }),
    supabase.from('payment_allocations').select('*'),
    supabase.from('adjustments').select('*'),
  ]);

  if (pErr) console.warn('Supabase read error (people):', pErr.message);
  if (lErr) console.warn('Supabase read error (loans):', lErr.message);

  return {
    people: (people || []) as Person[],
    sources: (sources || []) as LoanSource[],
    loans: (loans || []) as Loan[],
    dues: (dues || []) as MonthlyDue[],
    allocations: (allocations || []) as PaymentAllocation[],
    adjustments: (adjustments || []) as Adjustment[],
  };
}

/**
 * 1. High-level dashboard summary (totals, monthly status, overdue).
 */
export async function getDashboardSummary() {
  const data = await fetchReadOnlySnapshot();
  const currentMonthStr = getCurrentMonthStr();
  const todayStr = getTodayStr();

  const stats = calculateDashboardStats(
    data.loans,
    data.dues,
    data.allocations,
    data.adjustments,
    currentMonthStr,
    todayStr
  );

  const pendingThisMonth = roundMoney(Math.max(stats.due_this_month - stats.received_this_month, 0));
  const overdueCount = data.dues.filter((d) => {
    if (d.status === 'PAID' || d.status === 'WAIVED' || d.status === 'SKIPPED') return false;
    const remaining = calculateDueRemaining(d, data.allocations);
    return d.due_date < todayStr && remaining > 0;
  }).length;

  return {
    currency: 'INR (₹)',
    currentMonth: currentMonthStr,
    today: todayStr,
    totalGiven: stats.total_given,
    totalPaid: stats.total_paid,
    totalOutstanding: stats.total_outstanding,
    dueThisMonth: stats.due_this_month,
    receivedThisMonth: stats.received_this_month,
    pendingThisMonth,
    nextDueDate: stats.next_due_date,
    overdueAmount: stats.overdue_amount,
    overdueCount,
    activeLoansCount: data.loans.filter((l) => l.status === 'ACTIVE').length,
    registeredPeopleCount: data.people.length,
    defaultUpiId: process.env.DEFAULT_UPI_ID || 'avinashpanjal5@okhdfcbank',
  };
}

/**
 * 2. Search person by name or phone and get their full financial standing.
 */
export async function searchPerson(query: string) {
  const data = await fetchReadOnlySnapshot();
  const currentMonthStr = getCurrentMonthStr();
  const todayStr = getTodayStr();
  const normalizedQuery = (query || '').toLowerCase().trim();
  const digitsOnly = query ? query.replace(/\D/g, '') : '';

  const matchedPeople = data.people.filter((p) => {
    if (!normalizedQuery) return true;
    const nameMatch = p.name.toLowerCase().includes(normalizedQuery);
    const phoneDigits = p.phone.replace(/\D/g, '');
    const phoneMatch = digitsOnly && phoneDigits.includes(digitsOnly);
    return nameMatch || phoneMatch;
  });

  const results = matchedPeople.map((person) => {
    const summary = aggregatePersonSummary(
      person,
      data.loans,
      data.dues,
      data.allocations,
      data.adjustments,
      currentMonthStr,
      todayStr
    );

    const personLoans = data.loans.filter((l) => l.person_id === person.id);
    const personDues = data.dues.filter((d) => d.person_id === person.id);

    const loansOverview = personLoans.map((l) => {
      const remaining = calculateLoanRemaining(l, data.allocations, data.adjustments, data.dues);
      const loanDues = personDues.filter((d) => d.loan_id === l.id);
      const totalScheduled = loanDues.reduce((acc, d) => acc + (Number(d.current_amount) || 0), 0);
      const paid = calculateTotalPaid(
        data.allocations.filter((a) => a.loan_id === l.id),
        loanDues
      );

      return {
        loanId: l.id,
        source: l.loan_source?.name || 'Direct Cash',
        originalPrincipal: l.original_amount,
        totalWithInterest: totalScheduled > 0 ? totalScheduled : l.original_amount,
        paid,
        remainingBalance: remaining,
        monthlyEmi: l.default_due_amount || 0,
        tenureMonths: l.installment_count || 1,
        takenDate: l.taken_date,
        status: l.status,
        notes: l.notes || '',
      };
    });

    const pendingDues = personDues
      .filter((d) => Number(d.current_amount || 0) > 0 && d.status !== 'PAID')
      .map((d) => ({
        dueId: d.id,
        month: d.due_month,
        dueDate: d.due_date,
        formattedDueDate: formatDateDisplay(d.due_date),
        amount: Number(d.current_amount),
        status: d.status,
        isOverdue: d.due_date < todayStr,
      }));

    return {
      personId: person.id,
      name: person.name,
      phone: person.phone,
      totalBorrowed: summary.total_borrowed,
      totalPaid: summary.total_paid,
      remainingOutstanding: summary.outstanding,
      currentMonthDue: summary.current_month_due,
      currentMonthPaid: summary.current_month_paid,
      currentMonthPending: summary.current_month_pending,
      overdueAmount: summary.overdue_amount,
      overallStatus: summary.status,
      activeLoansCount: summary.active_loans_count,
      loans: loansOverview,
      pendingDues,
      paymentUpiId: process.env.DEFAULT_UPI_ID || 'avinashpanjal5@okhdfcbank',
    };
  });

  return {
    query,
    count: results.length,
    people: results,
  };
}

/**
 * 3. List all active or filtered loans.
 */
export async function listLoans(options?: {
  borrowerType?: 'ALL' | 'PERSON' | 'MYSELF';
  status?: string;
  sourceId?: string;
}) {
  const data = await fetchReadOnlySnapshot();

  const borrowerType = options?.borrowerType || 'ALL';
  const status = options?.status || 'ALL';
  const sourceId = options?.sourceId || 'ALL';

  const filtered = data.loans.filter((loan) => {
    if (borrowerType !== 'ALL' && loan.borrower_type !== borrowerType) return false;
    if (status !== 'ALL' && loan.status !== status) return false;
    if (sourceId !== 'ALL' && loan.loan_source_id !== sourceId) return false;
    return true;
  });

  const loansList = filtered.map((l) => {
    const loanDues = data.dues.filter((d) => d.loan_id === l.id);
    const loanAllocations = data.allocations.filter((a) => a.loan_id === l.id);
    const paid = calculateTotalPaid(loanAllocations, loanDues);
    const remaining = calculateLoanRemaining(l, data.allocations, data.adjustments, data.dues);
    const totalScheduled = loanDues.reduce((acc, d) => acc + (Number(d.current_amount) || 0), 0);

    return {
      id: l.id,
      borrowerType: l.borrower_type,
      borrowerName: l.borrower_type === 'MYSELF' ? 'Myself' : l.person?.name || 'Unknown',
      borrowerPhone: l.person?.phone || '',
      loanSource: l.loan_source?.name || 'Direct Cash',
      originalPrincipal: Number(l.original_amount),
      totalWithInterest: totalScheduled > 0 ? totalScheduled : Number(l.original_amount),
      totalPaid: paid,
      remainingBalance: remaining,
      monthlyEmi: Number(l.default_due_amount || 0),
      tenureMonths: l.installment_count || 1,
      takenDate: l.taken_date,
      formattedTakenDate: formatDateDisplay(l.taken_date),
      status: l.status,
      notes: l.notes || '',
    };
  });

  return {
    totalLoans: loansList.length,
    totalPrincipal: roundMoney(loansList.reduce((acc, l) => acc + l.originalPrincipal, 0)),
    totalRemaining: roundMoney(loansList.reduce((acc, l) => acc + l.remainingBalance, 0)),
    loans: loansList,
  };
}

/**
 * 4. Get monthly dues for a specific cycle (defaults to current month).
 */
export async function getMonthlyDues(monthStr?: string) {
  const data = await fetchReadOnlySnapshot();
  const targetMonth = monthStr || getCurrentMonthStr();
  const todayStr = getTodayStr();

  const monthDues = data.dues.filter((d) => d.due_month === targetMonth);

  const duesList = monthDues.map((d) => {
    const paid = calculateDuePaid(d, data.allocations);
    const remaining = calculateDueRemaining(d, data.allocations);
    const isOverdue = d.due_date < todayStr && remaining > 0 && d.status !== 'PAID';

    return {
      dueId: d.id,
      borrowerName: d.person?.name || 'Unknown',
      borrowerPhone: d.person?.phone || '',
      loanSource: d.loan?.loan_source?.name || 'Direct Cash',
      dueMonth: d.due_month,
      dueDate: d.due_date,
      formattedDueDate: formatDateDisplay(d.due_date),
      scheduledAmount: Number(d.current_amount),
      paidAmount: paid,
      remainingAmount: remaining,
      status: d.status,
      isOverdue,
    };
  });

  const totalScheduled = roundMoney(duesList.reduce((acc, d) => acc + d.scheduledAmount, 0));
  const totalPaid = roundMoney(duesList.reduce((acc, d) => acc + d.paidAmount, 0));
  const totalPending = roundMoney(duesList.reduce((acc, d) => acc + d.remainingAmount, 0));

  return {
    targetMonth,
    totalScheduled,
    totalPaid,
    totalPending,
    duesCount: duesList.length,
    dues: duesList,
  };
}

/**
 * 5. Get all currently overdue dues and borrowers across all months.
 */
export async function getOverdueDues() {
  const data = await fetchReadOnlySnapshot();
  const todayStr = getTodayStr();

  const overdueList = data.dues
    .filter((d) => {
      if (d.status === 'PAID' || d.status === 'WAIVED' || d.status === 'SKIPPED') return false;
      const remaining = calculateDueRemaining(d, data.allocations);
      return d.due_date < todayStr && remaining > 0;
    })
    .map((d) => {
      const remaining = calculateDueRemaining(d, data.allocations);
      return {
        dueId: d.id,
        borrowerName: d.person?.name || 'Unknown',
        borrowerPhone: d.person?.phone || '',
        loanSource: d.loan?.loan_source?.name || 'Direct Cash',
        dueMonth: d.due_month,
        dueDate: d.due_date,
        formattedDueDate: formatDateDisplay(d.due_date),
        overdueAmount: remaining,
        status: d.status,
      };
    });

  const totalOverdueAmount = roundMoney(overdueList.reduce((acc, d) => acc + d.overdueAmount, 0));

  return {
    asOfDate: todayStr,
    totalOverdueCount: overdueList.length,
    totalOverdueAmount,
    overdueDues: overdueList,
  };
}
