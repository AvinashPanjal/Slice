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

const DEFAULT_TEMPLATE = `Hi *{name}* 👋

This is a friendly payment reminder for *{month}*.

📋 *Payment Details:*
• Scheduled EMI Due: *{due_amount}*
• Amount Settled: *{paid_amount}*
• Pending Balance: *{remaining_amount}*
• Due Date: *{due_date}*

Kindly clear the remaining payment of *{remaining_amount}* when possible.

Thank you! 🙏`;

/**
 * Replaces placeholders in reminder template with actual values
 */
export function buildReminderMessage(params: ReminderParams): string {
  const rawTpl = params.template || DEFAULT_TEMPLATE;
  const tpl = rawTpl.replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

  return tpl
    .replace(/{name}/g, params.name)
    .replace(/{month}/g, formatMonthDisplay(params.month))
    .replace(/{due_amount}/g, formatINR(params.dueAmount))
    .replace(/{paid_amount}/g, formatINR(params.paidAmount))
    .replace(/{remaining_amount}/g, formatINR(params.remainingAmount))
    .replace(/{due_date}/g, formatDateDisplay(params.dueDate || ''));
}

/**
 * Generates WhatsApp click-to-chat URL (wa.me) with proper URL encoded multiline breaks (%0A)
 */
export function generateWhatsAppLink(phone: string, countryCode: string = '+91', message: string): string {
  let cleanPhone = phone.replace(/\D/g, '');
  let cc = countryCode.replace(/\D/g, '');

  if (!cleanPhone.startsWith(cc) && cc) {
    cleanPhone = `${cc}${cleanPhone}`;
  }

  // Convert literal \n or \r\n characters into true linebreaks before URL encoding
  const cleanMessage = message
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');

  const encodedMsg = encodeURIComponent(cleanMessage);
  return `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
}
