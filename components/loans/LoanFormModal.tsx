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
import { getTodayStr, getMonthlyDueDates } from '@/lib/utils/date';

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
  const [localSources, setLocalSources] = useState<LoanSource[]>(sources || []);
  const [localPeople, setLocalPeople] = useState<Person[]>(people || []);

  useEffect(() => {
    if (sources && sources.length > 0) {
      setLocalSources(sources);
    } else if (isOpen) {
      const fetchSources = async () => {
        const { data } = await supabase.from('loan_sources').select('*').order('name');
        if (data) setLocalSources(data);
      };
      fetchSources();
    }
  }, [sources, isOpen, supabase]);

  useEffect(() => {
    if (people && people.length > 0) {
      setLocalPeople(people);
    } else if (isOpen) {
      const fetchPeople = async () => {
        const { data } = await supabase.from('people').select('*').eq('is_archived', false).order('name');
        if (data) setLocalPeople(data);
      };
      fetchPeople();
    }
  }, [people, isOpen, supabase]);

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
      default_due_day: 5,
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
        repayment_type: loan.repayment_type || 'FIXED_EMI',
        taken_date: loan.taken_date,
        first_due_date: loan.first_due_date || undefined,
        default_due_day: loan.default_due_day || 5,
        installment_count: loan.installment_count || undefined,
        notes: loan.notes || undefined,
      });
    } else {
      setBorrowerType(defaultPersonId ? 'PERSON' : 'PERSON');
      reset({
        borrower_type: 'PERSON',
        person_id: defaultPersonId || (people[0]?.id ?? localPeople[0]?.id ?? undefined),
        loan_source_id: sources[0]?.id ?? localSources[0]?.id ?? undefined,
        original_amount: 5000,
        default_due_amount: 481.60,
        repayment_type: 'FIXED_EMI',
        taken_date: getTodayStr(),
        default_due_day: 5,
        installment_count: 12,
      });
    }
  }, [loan, defaultPersonId, people, sources, localPeople, localSources, reset, isOpen]);

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

        // Auto-generate initial monthly dues using correct due date logic
        if (newLoan && data.default_due_amount && data.default_due_amount > 0) {
          const installmentCount = data.installment_count || 1;
          const dueDay = data.default_due_day || 5;
          const dueSchedule = getMonthlyDueDates(data.taken_date, installmentCount, dueDay);

          const duesToInsert = dueSchedule.map((d) => ({
            user_id: userData.user.id,
            loan_id: newLoan.id,
            person_id: data.borrower_type === 'PERSON' ? data.person_id : null,
            due_month: d.due_month,
            due_date: d.due_date,
            original_amount: data.default_due_amount,
            current_amount: data.default_due_amount,
            status: 'PENDING',
          }));

          await supabase.from('monthly_dues').insert(duesToInsert);
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
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5 sm:space-y-4">
        {/* Borrower Type Selector */}
        <div>
          <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
            Who is borrowing this money? *
          </label>
          <div className="flex w-full gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => handleBorrowerTypeChange('PERSON')}
              className={`flex-1 py-2 px-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all text-center truncate ${
                borrowerType === 'PERSON'
                  ? 'bg-[#0b1c30] text-white dark:bg-slate-700 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Friend / Person
            </button>
            <button
              type="button"
              onClick={() => handleBorrowerTypeChange('MYSELF')}
              className={`flex-1 py-2 px-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all text-center truncate ${
                borrowerType === 'MYSELF'
                  ? 'bg-[#0b1c30] text-white dark:bg-slate-700 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Myself
            </button>
          </div>
        </div>

        {borrowerType === 'PERSON' && (
          <div>
            <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Select Person *
            </label>
            <select
              className="w-full max-w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white truncate font-medium"
              {...register('person_id')}
            >
              {localPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.phone})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Loan Source App *
          </label>
          <select
            className="w-full max-w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white truncate font-medium"
            {...register('loan_source_id')}
          >
            <option value="">None / Custom</option>
            {localSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Original Principal Borrowed (₹) *"
            type="number"
            step="any"
            placeholder="5000"
            {...register('original_amount')}
            error={errors.original_amount?.message}
          />

          <Input
            label="Monthly EMI Amount (₹) *"
            type="number"
            step="any"
            placeholder="481.60"
            {...register('default_due_amount')}
            error={errors.default_due_amount?.message}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Number of Months (Tenure) *"
            type="number"
            min={1}
            max={120}
            placeholder="12"
            {...register('installment_count')}
            error={errors.installment_count?.message}
          />

          <Input
            label="Date Taken *"
            type="date"
            {...register('taken_date')}
            error={errors.taken_date?.message}
          />
        </div>

        <p className="text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
          ℹ️ Monthly EMI dues are automatically set to the <strong>5th of every month</strong> starting from the next cycle after the loan taken date.
        </p>

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

        <div className="sticky bottom-0 z-20 bg-white dark:bg-[#131b2e] flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 pt-3 pb-2 mt-4 border-t border-slate-100 dark:border-slate-800">
          {loan ? (
            <Button
              type="button"
              variant="danger"
              size="sm"
              className="text-xs"
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
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <Button type="button" variant="outline" size="sm" className="text-xs px-3" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="text-xs px-4" isLoading={isSubmitting}>
              {loan ? 'Save Changes' : 'Create Loan'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
