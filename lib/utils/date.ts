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
