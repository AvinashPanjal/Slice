'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { adjustmentSchema, AdjustmentFormData } from '@/lib/validation';
import { Person, Loan } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { getTodayStr } from '@/lib/utils/date';
import { formatINR } from '@/lib/utils/currency';

interface AdjustmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  people: Person[];
  loans: Loan[];
  defaultPersonId?: string;
  onSuccess: () => void;
}

export const AdjustmentFormModal: React.FC<AdjustmentFormModalProps> = ({
  isOpen,
  onClose,
  people,
  loans,
  defaultPersonId,
  onSuccess,
}) => {
  const supabase = createClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      adjustment_type: 'CORRECTION_ADD',
      adjustment_date: getTodayStr(),
      amount: 500,
    },
  });

  useEffect(() => {
    reset({
      adjustment_type: 'CORRECTION_ADD',
      adjustment_date: getTodayStr(),
      amount: 500,
      person_id: defaultPersonId || (people[0]?.id ?? undefined),
      reason: '',
    });
  }, [defaultPersonId, people, reset, isOpen]);

  const onSubmit = async (data: AdjustmentFormData) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: adj, error } = await supabase
        .from('adjustments')
        .insert({
          user_id: userData.user.id,
          person_id: data.person_id || null,
          loan_id: data.loan_id || null,
          amount: data.amount,
          adjustment_type: data.adjustment_type,
          reason: data.reason,
          adjustment_date: data.adjustment_date,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('activity_logs').insert({
        user_id: userData.user.id,
        entity_type: 'ADJUSTMENT',
        entity_id: adj.id,
        action: 'BALANCE_ADJUSTED',
        new_values: { amount: data.amount, type: data.adjustment_type },
        reason: data.reason,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error recording adjustment');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manual Balance Adjustment"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Adjustment Type *
          </label>
          <select
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white"
            {...register('adjustment_type')}
          >
            <option value="CORRECTION_ADD">Correction (+) Add to Outstanding Balance</option>
            <option value="CORRECTION_SUB">Correction (-) Subtract from Outstanding Balance</option>
            <option value="WAIVER">Waiver (Forgive Balance)</option>
            <option value="OPENING_BALANCE">Opening Balance Adjustment</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Person *
          </label>
          <select
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white"
            {...register('person_id')}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Adjustment Amount (₹) *"
            type="number"
            {...register('amount')}
            error={errors.amount?.message}
          />
          <Input
            label="Adjustment Date *"
            type="date"
            {...register('adjustment_date')}
            error={errors.adjustment_date?.message}
          />
        </div>

        <Input
          label="Reason for Adjustment *"
          placeholder="e.g. Reconciliation correction for cash rounding"
          {...register('reason')}
          error={errors.reason?.message}
        />

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Save Adjustment
          </Button>
        </div>
      </form>
    </Modal>
  );
};
