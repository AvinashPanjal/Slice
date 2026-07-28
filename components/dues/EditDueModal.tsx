'use client';

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { dueEditSchema, DueEditFormData } from '@/lib/validation';
import { MonthlyDue } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { formatINR } from '@/lib/utils/currency';

interface EditDueModalProps {
  isOpen: boolean;
  onClose: () => void;
  due: MonthlyDue | null;
  onSuccess: () => void;
}

export const EditDueModal: React.FC<EditDueModalProps> = ({
  isOpen,
  onClose,
  due,
  onSuccess,
}) => {
  const supabase = createClient();
  const [actionType, setActionType] = useState<'EDIT' | 'WAIVE' | 'CARRY' | 'MARK_PAID'>('EDIT');
  const [carryMonth, setCarryMonth] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DueEditFormData>({
    resolver: zodResolver(dueEditSchema),
  });

  useEffect(() => {
    if (due) {
      reset({
        current_amount: due.current_amount,
        due_date: due.due_date,
        adjustment_reason: due.adjustment_reason || '',
      });
      const [year, month] = due.due_month.split('-');
      const nextDate = new Date(parseInt(year, 10), parseInt(month, 10), 1);
      const nextMonthStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
      setCarryMonth(nextMonthStr);
    }
  }, [due, reset, isOpen]);

  if (!due) return null;

  const onSubmit = async (data: DueEditFormData) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      if (actionType === 'MARK_PAID') {
        const { error } = await supabase
          .from('monthly_dues')
          .update({
            status: 'PAID',
            is_manually_adjusted: true,
            adjustment_reason: data.adjustment_reason || 'Marked as paid for ongoing loan history',
            updated_at: new Date().toISOString(),
          })
          .eq('id', due.id);

        if (error) throw error;

        await supabase.from('activity_logs').insert({
          user_id: userData.user.id,
          entity_type: 'MONTHLY_DUE',
          entity_id: due.id,
          action: 'DUE_MARKED_PAID',
          new_values: { amount: due.current_amount, status: 'PAID' },
          reason: data.adjustment_reason || 'Marked as paid',
        });
      } else if (actionType === 'EDIT') {
        const { error } = await supabase
          .from('monthly_dues')
          .update({
            current_amount: data.current_amount,
            due_date: data.due_date,
            is_manually_adjusted: true,
            adjustment_reason: data.adjustment_reason,
            updated_at: new Date().toISOString(),
          })
          .eq('id', due.id);

        if (error) throw error;

        await supabase.from('activity_logs').insert({
          user_id: userData.user.id,
          entity_type: 'MONTHLY_DUE',
          entity_id: due.id,
          action: 'DUE_ADJUSTED',
          old_values: { amount: due.current_amount, due_date: due.due_date },
          new_values: { amount: data.current_amount, due_date: data.due_date },
          reason: data.adjustment_reason,
        });
      } else if (actionType === 'WAIVE') {
        const { error } = await supabase
          .from('monthly_dues')
          .update({
            status: 'WAIVED',
            is_manually_adjusted: true,
            adjustment_reason: data.adjustment_reason,
            updated_at: new Date().toISOString(),
          })
          .eq('id', due.id);

        if (error) throw error;

        await supabase.from('adjustments').insert({
          user_id: userData.user.id,
          person_id: due.person_id || null,
          loan_id: due.loan_id,
          monthly_due_id: due.id,
          amount: due.current_amount,
          adjustment_type: 'WAIVER',
          reason: data.adjustment_reason,
          adjustment_date: new Date().toISOString().split('T')[0],
        });

        await supabase.from('activity_logs').insert({
          user_id: userData.user.id,
          entity_type: 'MONTHLY_DUE',
          entity_id: due.id,
          action: 'DUE_WAIVED',
          new_values: { amount: due.current_amount },
          reason: data.adjustment_reason,
        });
      } else if (actionType === 'CARRY') {
        const remainingAmount = data.current_amount;
        const dueDay = due.due_date.slice(-2);
        const targetDueDate = `${carryMonth}-${dueDay}`;

        const { data: newCarriedDue, error: carryErr } = await supabase
          .from('monthly_dues')
          .insert({
            user_id: userData.user.id,
            loan_id: due.loan_id,
            person_id: due.person_id,
            due_month: carryMonth,
            due_date: targetDueDate,
            original_amount: remainingAmount,
            current_amount: remainingAmount,
            status: 'PENDING',
            is_manually_adjusted: true,
            carried_from_due_id: due.id,
            adjustment_reason: `Carried forward from ${due.due_month}: ${data.adjustment_reason}`,
          })
          .select()
          .single();

        if (carryErr) throw carryErr;

        await supabase
          .from('monthly_dues')
          .update({
            status: 'SKIPPED',
            is_manually_adjusted: true,
            adjustment_reason: `Carried forward ${formatINR(remainingAmount)} to ${carryMonth}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', due.id);

        await supabase.from('activity_logs').insert({
          user_id: userData.user.id,
          entity_type: 'MONTHLY_DUE',
          entity_id: due.id,
          action: 'DUE_CARRIED_FORWARD',
          new_values: { carried_to: carryMonth, amount: remainingAmount },
          reason: data.adjustment_reason,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error updating due record');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage Due for ${due.due_month}`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Action Toggle */}
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setActionType('EDIT')}
            className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
              actionType === 'EDIT'
                ? 'bg-[#0b1c30] text-white border-[#0b1c30] dark:bg-slate-700'
                : 'bg-white dark:bg-[#131b2e] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            Edit Amount
          </button>
          <button
            type="button"
            onClick={() => setActionType('MARK_PAID')}
            className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
              actionType === 'MARK_PAID'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white dark:bg-[#131b2e] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            Mark Paid
          </button>
          <button
            type="button"
            onClick={() => setActionType('WAIVE')}
            className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
              actionType === 'WAIVE'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white dark:bg-[#131b2e] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            Waive
          </button>
          <button
            type="button"
            onClick={() => setActionType('CARRY')}
            className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all ${
              actionType === 'CARRY'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white dark:bg-[#131b2e] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            Carry
          </button>
        </div>

        {actionType === 'EDIT' && (
          <>
            <Input
              label="Custom Due Amount (₹) *"
              type="number"
              {...register('current_amount')}
              error={errors.current_amount?.message}
            />
            <Input
              label="Due Date *"
              type="date"
              {...register('due_date')}
              error={errors.due_date?.message}
            />
          </>
        )}

        {actionType === 'CARRY' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Target Month (YYYY-MM) *
            </label>
            <input
              type="month"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white"
              value={carryMonth}
              onChange={(e) => setCarryMonth(e.target.value)}
            />
          </div>
        )}

        <Input
          label="Reason for Modification *"
          placeholder={
            actionType === 'WAIVE'
              ? 'e.g. Forgave remaining balance as a gift'
              : actionType === 'CARRY'
              ? 'e.g. Deferred to next month per request'
              : 'e.g. Reduced payment agreed for August'
          }
          {...register('adjustment_reason')}
          error={errors.adjustment_reason?.message}
        />

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="danger"
            onClick={async () => {
              if (!confirm('Are you sure you want to delete this monthly due record?')) return;
              try {
                await supabase.from('payment_allocations').delete().eq('monthly_due_id', due.id);
                const { error } = await supabase.from('monthly_dues').delete().eq('id', due.id);
                if (error) throw error;
                onSuccess();
                onClose();
              } catch (err: any) {
                alert(err.message || 'Error deleting due record');
              }
            }}
          >
            Delete Due
          </Button>
          <div className="flex items-center space-x-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              variant={actionType === 'WAIVE' ? 'danger' : 'primary'}
            >
              {actionType === 'WAIVE'
                ? 'Confirm Waiver'
                : actionType === 'CARRY'
                ? 'Carry Forward'
                : 'Save Adjustment'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
