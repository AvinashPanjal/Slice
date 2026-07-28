import { z } from 'zod';

export const personSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  country_code: z.string().default('+91'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  notes: z.string().optional(),
});

export const loanSourceSchema = z.object({
  name: z.string().min(1, 'Loan source name is required'),
  notes: z.string().optional(),
});

export const loanSchema = z.object({
  borrower_type: z.enum(['PERSON', 'MYSELF']),
  person_id: z.string().optional().nullable(),
  loan_source_id: z.string().optional().nullable(),
  original_amount: z.coerce.number().positive('Original amount must be greater than 0'),
  default_due_amount: z.coerce.number().min(0, 'EMI cannot be negative').optional().nullable(),
  repayment_type: z.enum(['FIXED_EMI', 'FLEXIBLE']),
  taken_date: z.string().min(1, 'Date taken is required'),
  first_due_date: z.string().optional().nullable(),
  default_due_day: z.coerce.number().min(1).max(31).optional().nullable(),
  installment_count: z.coerce.number().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const paymentSchema = z.object({
  person_id: z.string().optional().nullable(),
  loan_id: z.string().optional().nullable(),
  monthly_due_id: z.string().optional().nullable(),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  payment_date: z.string().min(1, 'Payment date is required'),
  payment_method: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER']),
  notes: z.string().optional().nullable(),
});

export const dueEditSchema = z.object({
  current_amount: z.coerce.number().min(0, 'Amount cannot be negative'),
  due_date: z.string().min(1, 'Due date is required'),
  adjustment_reason: z.string().min(1, 'Reason for modification is required'),
});

export const carryForwardSchema = z.object({
  target_month: z.string().min(1, 'Target month is required'),
  amount_to_carry: z.coerce.number().positive('Carry forward amount must be greater than 0'),
  reason: z.string().optional(),
});

export const adjustmentSchema = z.object({
  adjustment_type: z.enum(['CORRECTION_ADD', 'CORRECTION_SUB', 'WAIVER', 'OPENING_BALANCE']),
  person_id: z.string().optional().nullable(),
  loan_id: z.string().optional().nullable(),
  amount: z.coerce.number().positive('Adjustment amount must be greater than 0'),
  reason: z.string().min(1, 'Reason for adjustment is required'),
  adjustment_date: z.string().min(1, 'Adjustment date is required'),
});

export type PersonFormData = z.infer<typeof personSchema>;
export type LoanSourceFormData = z.infer<typeof loanSourceSchema>;
export type LoanFormData = z.infer<typeof loanSchema>;
export type PaymentFormData = z.infer<typeof paymentSchema>;
export type DueEditFormData = z.infer<typeof dueEditSchema>;
export type CarryForwardFormData = z.infer<typeof carryForwardSchema>;
export type AdjustmentFormData = z.infer<typeof adjustmentSchema>;
