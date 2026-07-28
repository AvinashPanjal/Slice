import { format, parseISO } from 'date-fns';

/**
 * Returns YYYY-MM string for current month
 */
export function getCurrentMonthStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Returns YYYY-MM-DD string for today
 */
export function getTodayStr(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a date string (YYYY-MM-DD) into Indian display format (e.g. Jan 10, 2026)
 */
export function formatDateDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const parsed = parseISO(dateStr);
    return format(parsed, 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

/**
 * Formats month string (YYYY-MM) into display month (e.g. July 2026)
 */
export function formatMonthDisplay(monthStr: string): string {
  if (!monthStr || !monthStr.includes('-')) return monthStr;
  try {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    return format(date, 'MMMM yyyy');
  } catch {
    return monthStr;
  }
}

/**
 * Calculates days remaining or overdue for a given due date string YYYY-MM-DD
 */
export function getDaysRemainingInfo(dueDateStr: string, isPaid?: boolean): {
  days: number;
  label: string;
  badgeClass: string;
} {
  if (!dueDateStr || isPaid) {
    return { days: 0, label: 'Paid', badgeClass: 'bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:border-emerald-900/40' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = parseISO(dueDateStr);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 1) {
    return {
      days: diffDays,
      label: `${diffDays} days left`,
      badgeClass: diffDays <= 5
        ? 'bg-amber-500/10 text-amber-600 border border-amber-200 dark:border-amber-900/40 font-semibold'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
    };
  } else if (diffDays === 1) {
    return {
      days: 1,
      label: 'Due tomorrow',
      badgeClass: 'bg-amber-500/10 text-amber-600 border border-amber-200 dark:border-amber-900/40 font-extrabold',
    };
  } else if (diffDays === 0) {
    return {
      days: 0,
      label: 'Due today!',
      badgeClass: 'bg-rose-500/10 text-rose-600 border border-rose-200 dark:border-rose-900/40 font-extrabold animate-pulse',
    };
  } else {
    const overdue = Math.abs(diffDays);
    return {
      days: diffDays,
      label: `${overdue} day${overdue > 1 ? 's' : ''} overdue`,
      badgeClass: 'bg-rose-500/10 text-rose-600 border border-rose-200 dark:border-rose-900/40 font-extrabold',
    };
  }
}

/**
 * Returns YYYY-MM and YYYY-MM-DD for N months from a start date/month with a specific due day (default 5th)
 */
export function getMonthlyDueDates(startDateStr: string, monthsCount: number, dueDay: number = 5) {
  const result: { due_month: string; due_date: string }[] = [];
  const start = parseISO(startDateStr);
  let curYear = start.getFullYear();
  let curMonth = start.getMonth(); // 0-indexed
  const clampedDay = Math.min(Math.max(dueDay, 1), 31);

  // If loan start date's day of month is on or after dueDay, first payment due is next month!
  if (start.getDate() >= clampedDay) {
    curMonth++;
    if (curMonth > 11) {
      curMonth = 0;
      curYear++;
    }
  }

  for (let i = 0; i < monthsCount; i++) {
    const monthNum = curMonth + 1;
    const yearStr = String(curYear);
    const monthStr = String(monthNum).padStart(2, '0');
    const dueMonthStr = `${yearStr}-${monthStr}`;

    const lastDayOfMonth = new Date(curYear, monthNum, 0).getDate();
    const actualDay = Math.min(clampedDay, lastDayOfMonth);
    const dayStr = String(actualDay).padStart(2, '0');
    const dueDateStr = `${yearStr}-${monthStr}-${dayStr}`;

    result.push({
      due_month: dueMonthStr,
      due_date: dueDateStr,
    });

    curMonth++;
    if (curMonth > 11) {
      curMonth = 0;
      curYear++;
    }
  }

  return result;
}
