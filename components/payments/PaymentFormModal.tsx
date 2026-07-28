'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { paymentSchema, PaymentFormData } from '@/lib/validation';
import { Person, Loan, MonthlyDue, PaymentAllocation } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { getTodayStr } from '@/lib/utils/date';
import { formatINR } from '@/lib/utils/currency';
import { autoAllocatePayment, calculateDueRemaining } from '@/lib/calculations';
import { Zap } from 'lucide-react';

interface PaymentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPersonId?: string;
  defaultLoanId?: string;
  defaultDueId?: string;
  people: Person[];
  loans: Loan[];
  dues: MonthlyDue[];
  allocations: PaymentAllocation[];
  onSuccess: () => void;
}

export const PaymentFormModal: React.FC<PaymentFormModalProps> = ({
  isOpen,
  onClose,
  defaultPersonId,
  defaultLoanId,
  defaultDueId,
  people,
  loans,
  dues,
  allocations,
  onSuccess,
}) => {
  const supabase = createClient();
  const [selectedPersonId, setSelectedPersonId] = useState<string>(defaultPersonId || '');
  const [manualAllocations, setManualAllocations] = useState<
    { due_id: string; loan_id: string; amount: number }[]
  >([]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      payment_date: getTodayStr(),
      payment_method: 'UPI',
      amount: 1000,
    },
  });

  const watchAmount = watch('amount');

  useEffect(() => {
    if (defaultPersonId) {
      setSelectedPersonId(defaultPersonId);
      setValue('person_id', defaultPersonId);
    } else if (people.length > 0) {
      setSelectedPersonId(people[0].id);
      setValue('person_id', people[0].id);
    }
    if (defaultLoanId) setValue('loan_id', defaultLoanId);
    if (defaultDueId) setValue('monthly_due_id', defaultDueId);
  }, [defaultPersonId, defaultLoanId, defaultDueId, people, setValue, isOpen]);

  // Filter dues for selected person
  const personDues = dues.filter((d) => d.person_id === selectedPersonId);
  const personLoans = loans.filter((l) => l.person_id === selectedPersonId);

  const handleAutoAllocate = () => {
    const amount = Number(watchAmount) || 0;
    if (amount <= 0) return;
    const { allocatedDues } = autoAllocatePayment(amount, personDues, personLoans, allocations);
    setManualAllocations(allocatedDues);
  };

  const handleAllocationChange = (dueId: string, loanId: string, val: number) => {
    setManualAllocations((prev) => {
      const filtered = prev.filter((p) => p.due_id !== dueId);
      if (val > 0) {
        return [...filtered, { due_id: dueId, loan_id: loanId, amount: val }];
      }
      return filtered;
    });
  };

  const onSubmit = async (data: PaymentFormData) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // 1. Create Payment record
      const { data: newPayment, error: payErr } = await supabase
        .from('payments')
        .insert({
          user_id: userData.user.id,
          person_id: data.person_id || null,
          loan_id: data.loan_id || null,
          monthly_due_id: data.monthly_due_id || null,
          amount: data.amount,
          payment_date: data.payment_date,
          payment_method: data.payment_method,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (payErr) throw payErr;

      // 2. Create Payment Allocations
      if (manualAllocations.length > 0) {
        const allocRecords = manualAllocations.map((a) => ({
          user_id: userData.user.id,
          payment_id: newPayment.id,
          monthly_due_id: a.due_id,
          loan_id: a.loan_id,
          amount: a.amount,
          allocation_type: 'DUE_PAYMENT' as const,
        }));
        const { error: allocErr } = await supabase
          .from('payment_allocations')
          .insert(allocRecords);
        if (allocErr) throw allocErr;

        // Update status of related dues
        for (const alloc of manualAllocations) {
          const targetDue = dues.find((d) => d.id === alloc.due_id);
          if (targetDue) {
            const existingPaid = allocations
              .filter((a) => a.monthly_due_id === targetDue.id)
              .reduce((acc, a) => acc + Number(a.amount), 0);
            const newTotalPaid = existingPaid + alloc.amount;
            let newStatus = targetDue.status;
            if (newTotalPaid >= targetDue.current_amount) {
              newStatus = 'PAID';
            } else if (newTotalPaid > 0) {
              newStatus = 'PARTIALLY_PAID';
            }

            await supabase
              .from('monthly_dues')
              .update({ status: newStatus, updated_at: new Date().toISOString() })
              .eq('id', targetDue.id);
          }
        }
      } else if (data.loan_id) {
        // Direct allocation to single loan
        await supabase.from('payment_allocations').insert({
          user_id: userData.user.id,
          payment_id: newPayment.id,
          monthly_due_id: data.monthly_due_id || null,
          loan_id: data.loan_id,
          amount: data.amount,
          allocation_type: data.monthly_due_id ? 'DUE_PAYMENT' : 'PRINCIPAL_REDUCTION',
        });
      }

      // 3. Log Activity
      await supabase.from('activity_logs').insert({
        user_id: userData.user.id,
        entity_type: 'PAYMENT',
        entity_id: newPayment.id,
        action: 'PAYMENT_RECORDED',
        new_values: { amount: data.amount, method: data.payment_method },
        reason: `Payment of ${formatINR(data.amount)} recorded`,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error recording payment');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Person / Borrower *
          </label>
          <select
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white"
            {...register('person_id')}
            onChange={(e) => setSelectedPersonId(e.target.value)}
            value={selectedPersonId}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.phone})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Input
              label="Payment Amount (₹) *"
              type="number"
              placeholder="2000"
              {...register('amount')}
              error={errors.amount?.message}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Method *
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white"
              {...register('payment_method')}
            >
              <option value="UPI">UPI</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        <Input
          label="Payment Date *"
          type="date"
          {...register('payment_date')}
          error={errors.payment_date?.message}
        />

        {/* Multi-loan Payment Allocation Section */}
        {personDues.length > 0 && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Cross-Loan Due Allocations
                </h4>
                <p className="text-[11px] text-slate-500">
                  Allocate this payment across active monthly dues
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAutoAllocate}
              >
                <Zap className="w-3.5 h-3.5 mr-1 text-amber-500" />
                Auto Allocate
              </Button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {personDues.map((due) => {
                const remaining = calculateDueRemaining(due, allocations);
                const currentAlloc =
                  manualAllocations.find((a) => a.due_id === due.id)?.amount || '';

                return (
                  <div
                    key={due.id}
                    className="flex items-center justify-between p-2.5 bg-white dark:bg-[#131b2e] rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        Due Month: {due.due_month} (Date: {due.due_date})
                      </p>
                      <p className="text-slate-500">
                        Remaining: <span className="font-bold text-rose-500">{formatINR(remaining)}</span>
                      </p>
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        placeholder="₹ Amount"
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#0b1c30]"
                        value={currentAlloc}
                        onChange={(e) =>
                          handleAllocationChange(due.id, due.loan_id, parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Notes / Reference
          </label>
          <textarea
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white"
            rows={2}
            placeholder="Google Pay transaction ID..."
            {...register('notes')}
          />
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} variant="success">
            Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
};
