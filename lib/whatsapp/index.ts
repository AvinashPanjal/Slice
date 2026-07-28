import { formatINR } from '../utils/currency';
import { formatMonthDisplay, formatDateDisplay } from '../utils/date';

interface ReminderParams {
  phone: string;
  countryCode?: string;
  name: string;
  month: string;
  dueAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: string;
  template?: string;
}

const DEFAULT_TEMPLATE = `Hi {name} 👋

Payment reminder for {month}.
Total due: {due_amount}
Paid: {paid_amount}
Remaining: {remaining_amount}

Please make the remaining payment when possible.
Thank you.`;

/**
 * Replaces placeholders in reminder template with actual values
 */
export function buildReminderMessage(params: ReminderParams): string {
  const tpl = params.template || DEFAULT_TEMPLATE;

  return tpl
    .replace(/{name}/g, params.name)
    .replace(/{month}/g, formatMonthDisplay(params.month))
    .replace(/{due_amount}/g, formatINR(params.dueAmount))
    .replace(/{paid_amount}/g, formatINR(params.paidAmount))
    .replace(/{remaining_amount}/g, formatINR(params.remainingAmount))
    .replace(/{due_date}/g, formatDateDisplay(params.dueDate || ''));
}

/**
 * Generates WhatsApp click-to-chat URL (wa.me)
 */
export function generateWhatsAppLink(phone: string, countryCode: string = '+91', message: string): string {
  let cleanPhone = phone.replace(/\D/g, '');
  let cc = countryCode.replace(/\D/g, '');

  if (!cleanPhone.startsWith(cc) && cc) {
    cleanPhone = `${cc}${cleanPhone}`;
  }

  const encodedMsg = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
}
