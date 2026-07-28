'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { loanSchema, LoanFormData } from '@/lib/validation';
import { Person, LoanSource, Loan } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { getTodayStr } from '@/lib/utils/date';

interface LoanFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan?: Loan | null;
  defaultPersonId?: string;
  people: Person[];
  sources: LoanSource[];
  onSuccess: () => void;
}

export const LoanFormModal: React.FC<LoanFormModalProps> = ({
  isOpen,
  onClose,
  loan,
  defaultPersonId,
  people,
  sources,
  onSuccess,
}) => {
  const supabase = createClient();
  const [borrowerType, setBorrowerType] = useState<'PERSON' | 'MYSELF'>('PERSON');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoanFormData>({
    resolver: zodResolver(loanSchema),
    defaultValues: {
      borrower_type: 'PERSON',
      repayment_type: 'FIXED_EMI',
      taken_date: getTodayStr(),
      default_due_day: 10,
    },
  });

  const watchRepaymentType = watch('repayment_type');

  useEffect(() => {
    if (loan) {
      setBorrowerType(loan.borrower_type);
      reset({
        borrower_type: loan.borrower_type,
        person_id: loan.person_id || undefined,
        loan_source_id: loan.loan_source_id || undefined,
        original_amount: loan.original_amount,
        default_due_amount: loan.default_due_amount || 0,
        repayment_type: loan.repayment_type,
        taken_date: loan.taken_date,
        first_due_date: loan.first_due_date || undefined,
        default_due_day: loan.default_due_day || 10,
        installment_count: loan.installment_count || undefined,
        notes: loan.notes || undefined,
      });
    } else {
      setBorrowerType(defaultPersonId ? 'PERSON' : 'PERSON');
      reset({
        borrower_type: 'PERSON',
        person_id: defaultPersonId || (people[0]?.id ?? undefined),
        loan_source_id: sources[0]?.id ?? undefined,
        original_amount: 5000,
        default_due_amount: 1000,
        repayment_type: 'FIXED_EMI',
        taken_date: getTodayStr(),
        default_due_day: 10,
      });
    }
  }, [loan, defaultPersonId, people, sources, reset, isOpen]);

  const handleBorrowerTypeChange = (type: 'PERSON' | 'MYSELF') => {
    setBorrowerType(type);
    setValue('borrower_type', type);
    if (type === 'MYSELF') {
      setValue('person_id', null);
    }
  };

  const onSubmit = async (data: LoanFormData) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      if (loan) {
        // Edit existing loan
        const { error } = await supabase
          .from('loans')
          .update({
            borrower_type: data.borrower_type,
            person_id: data.borrower_type === 'PERSON' ? data.person_id : null,
            loan_source_id: data.loan_source_id || null,
            original_amount: data.original_amount,
            default_due_amount: data.default_due_amount || 0,
            repayment_type: data.repayment_type,
            taken_date: data.taken_date,
            first_due_date: data.first_due_date || null,
            default_due_day: data.default_due_day || null,
            installment_count: data.installment_count || null,
            notes: data.notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', loan.id);

        if (error) throw error;
      } else {
        // Create new loan
        const { data: newLoan, error } = await supabase
          .from('loans')
          .insert({
            user_id: userData.user.id,
            borrower_type: data.borrower_type,
            person_id: data.borrower_type === 'PERSON' ? data.person_id : null,
            loan_source_id: data.loan_source_id || null,
            original_amount: data.original_amount,
            default_due_amount: data.default_due_amount || 0,
            repayment_type: data.repayment_type,
            taken_date: data.taken_date,
            first_due_date: data.first_due_date || null,
            default_due_day: data.default_due_day || 10,
            installment_count: data.installment_count || null,
            notes: data.notes || null,
          })
          .select()
          .single();

        if (error) throw error;

        // Auto-generate initial monthly due for current month
        if (newLoan && data.default_due_amount && data.default_due_amount > 0) {
          const takenYearMonth = data.taken_date.slice(0, 7);
          const dueDay = String(data.default_due_day || 10).padStart(2, '0');
          const dueDateStr = `${takenYearMonth}-${dueDay}`;

          await supabase.from('monthly_dues').insert({
            user_id: userData.user.id,
            loan_id: newLoan.id,
            person_id: data.borrower_type === 'PERSON' ? data.person_id : null,
            due_month: takenYearMonth,
            due_date: dueDateStr,
            original_amount: data.default_due_amount,
            current_amount: data.default_due_amount,
            status: 'PENDING',
          });
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error saving loan record');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={loan ? 'Edit Loan Record' : 'Record New Loan'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Borrower Type Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
            Who is borrowing this money? *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleBorrowerTypeChange('PERSON')}
              className={`py-2.5 px-4 rounded-xl text-sm font-semibold border transition-all ${
                borrowerType === 'PERSON'
                  ? 'bg-[#0b1c30] text-white border-[#0b1c30] dark:bg-slate-700'
                  : 'bg-white dark:bg-[#131b2e] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Friend / Person
            </button>
            <button
              type="button"
              onClick={() => handleBorrowerTypeChange('MYSELF')}
              className={`py-2.5 px-4 rounded-xl text-sm font-semibold border transition-all ${
                borrowerType === 'MYSELF'
                  ? 'bg-[#0b1c30] text-white border-[#0b1c30] dark:bg-slate-700'
                  : 'bg-white dark:bg-[#131b2e] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              Myself
            </button>
          </div>
        </div>

        {borrowerType === 'PERSON' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Select Person *
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white"
              {...register('person_id')}
            >
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.phone})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Loan Source App *
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white"
              {...register('loan_source_id')}
            >
              <option value="">None / Custom</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Original Amount (₹) *"
            type="number"
            placeholder="5000"
            {...register('original_amount')}
            error={errors.original_amount?.message}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Repayment Type *
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white"
              {...register('repayment_type')}
            >
              <option value="FIXED_EMI">Fixed EMI Monthly</option>
              <option value="FLEXIBLE">Flexible Repayment</option>
            </select>
          </div>

          <Input
            label="Default Monthly EMI / Due (₹)"
            type="number"
            placeholder="1000"
            {...register('default_due_amount')}
            error={errors.default_due_amount?.message}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Date Taken *"
            type="date"
            {...register('taken_date')}
            error={errors.taken_date?.message}
          />

          <Input
            label="Default Monthly Due Day (1-31)"
            type="number"
            min={1}
            max={31}
            {...register('default_due_day')}
            error={errors.default_due_day?.message}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Notes / Purpose
          </label>
          <textarea
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white"
            rows={2}
            placeholder="e.g. Taken via Slice for phone purchase..."
            {...register('notes')}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          {loan ? (
            <Button
              type="button"
              variant="danger"
              onClick={async () => {
                if (
                  !confirm(
                    'Are you sure you want to delete this loan record? This action will permanently remove this loan and all associated monthly dues and payment allocations.'
                  )
                ) {
                  return;
                }
                try {
                  await supabase.from('payment_allocations').delete().eq('loan_id', loan.id);
                  await supabase.from('adjustments').delete().eq('loan_id', loan.id);
                  await supabase.from('monthly_dues').delete().eq('loan_id', loan.id);
                  const { error } = await supabase.from('loans').delete().eq('id', loan.id);
                  if (error) throw error;
                  onSuccess();
                  onClose();
                } catch (err: any) {
                  alert(err.message || 'Error deleting loan record');
                }
              }}
            >
              Delete Loan
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center space-x-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {loan ? 'Save Changes' : 'Create Loan'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
