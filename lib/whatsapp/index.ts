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
  upiId?: string;
}

const DEFAULT_TEMPLATE = `Hi *{name}* 👋

This is a friendly payment reminder for *{month}*.

📋 *Payment Details:*
• Scheduled EMI Due: *{due_amount}*
• Amount Settled: *{paid_amount}*
• Pending Balance: *{remaining_amount}*
• Due Date: *{due_date}*

{upi_link}

Kindly clear the remaining payment when possible.

Thank you!`;

/**
 * Generates dynamic UPI Deep Link (upi://pay) formatted strictly for NPCI & WhatsApp compliance
 */
export function generateUPILink(upiId: string, payeeName: string, amount: number, note?: string): string {
  const cleanUPI = upiId.trim();
  if (!cleanUPI) return '';
  const cleanAmount = (Math.max(0, amount) || 0).toFixed(2);
  const cleanName = encodeURIComponent((payeeName || 'LendWise').replace(/[^a-zA-Z0-9 ]/g, '').trim());
  const cleanNote = encodeURIComponent((note || 'EMIPayment').replace(/[^a-zA-Z0-9]/g, '').slice(0, 30));
  const tr = `LW${Date.now()}`;
  return `upi://pay?pa=${cleanUPI}&pn=${cleanName}&am=${cleanAmount}&cu=INR&tn=${cleanNote}&tr=${tr}`;
}

export const DEFAULT_UPI_ID = 'avinashpanjal5@okhdfcbank';

/**
 * Replaces placeholders in reminder template with actual values
 */
export function buildReminderMessage(params: ReminderParams): string {
  const rawTpl = params.template || DEFAULT_TEMPLATE;
  
  // Clean literal %0A strings, \\n, and \r\n into true JavaScript line breaks
  let tpl = rawTpl
    .replace(/%0A/gi, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');

  // Strip duplicate ₹ prefix before placeholders if present in template
  tpl = tpl
    .replace(/₹\s*{due_amount}/g, '{due_amount}')
    .replace(/₹\s*{paid_amount}/g, '{paid_amount}')
    .replace(/₹\s*{remaining_amount}/g, '{remaining_amount}');

  const effectiveUpi = params.upiId || DEFAULT_UPI_ID;

  const upiUri = effectiveUpi
    ? generateUPILink(effectiveUpi, 'LendWise', params.remainingAmount, 'EMIPayment')
    : '';

  const upiText = effectiveUpi
    ? `👉 *Pay via UPI App (GPay/PhonePe/Paytm):*\n${upiUri}\n\n💳 *UPI ID:* \`${effectiveUpi}\``
    : '';

  if (tpl.includes('{upi_link}')) {
    tpl = tpl.replace(/{upi_link}/g, upiText);
  } else if (upiText) {
    tpl = `${tpl}\n\n${upiText}`;
  }

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

  // Convert literal %0A strings, \\n, and \r\n into true linebreaks before URL encoding
  const cleanMessage = message
    .replace(/%0A/gi, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');

  const encodedMsg = encodeURIComponent(cleanMessage);
  return `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
}
