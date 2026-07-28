'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { createClient } from '@/lib/supabase/client';
import { Loan, MonthlyDue, PaymentAllocation } from '@/lib/types';
import { formatINR } from '@/lib/utils/currency';
import { formatDateDisplay, formatMonthDisplay, getDaysRemainingInfo, getMonthlyDueDates, getTodayStr } from '@/lib/utils/date';
import { calculateDuePaid, calculateDueRemaining } from '@/lib/calculations';
import { Calendar, Plus, Trash2, Save, Sparkles, RefreshCw } from 'lucide-react';

interface MonthlyDuesScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
  onSuccess: () => void;
}

export const MonthlyDuesScheduleModal: React.FC<MonthlyDuesScheduleModalProps> = ({
  isOpen,
  onClose,
  loan,
  onSuccess,
}) => {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Existing dues in DB for this loan
  const [dues, setDues] = useState<MonthlyDue[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);

  // Generator form inputs
  const [numMonths, setNumMonths] = useState<number>(6);
  const [defaultAmount, setDefaultAmount] = useState<number>(1000);
  const [dueDay, setDueDay] = useState<number>(5);
  const [startDate, setStartDate] = useState<string>(getTodayStr());

  // Editable list of dues
  const [editableDues, setEditableDues] = useState<
    {
      id?: string;
      due_month: string;
      due_date: string;
      current_amount: number;
      status: string;
      notes?: string;
      is_new?: boolean;
    }[]
  >([]);

  const fetchLoanDues = async () => {
    if (!loan) return;
    setLoading(true);
    try {
      const [{ data: d }, { data: a }] = await Promise.all([
        supabase
          .from('monthly_dues')
          .select('*')
          .eq('loan_id', loan.id)
          .order('due_date', { ascending: true }),
        supabase.from('payment_allocations').select('*').eq('loan_id', loan.id),
      ]);

      if (d) {
        setDues(d);
        setEditableDues(
          d.map((item) => ({
            id: item.id,
            due_month: item.due_month,
            due_date: item.due_date,
            current_amount: item.current_amount,
            status: item.status,
            notes: item.notes || '',
            is_new: false,
          }))
        );
      }
      if (a) setAllocations(a);

      // Pre-fill generator defaults from loan
      if (loan.default_due_amount) setDefaultAmount(loan.default_due_amount);
      if (loan.default_due_day) setDueDay(loan.default_due_day);
      if (loan.installment_count) setNumMonths(loan.installment_count);
      if (loan.taken_date) setStartDate(loan.taken_date);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && loan) {
      fetchLoanDues();
    }
  }, [isOpen, loan]);

  if (!loan) return null;

  // Auto-generate dues schedule for N months on 5th (or selected day) of each month
  const handleGenerateSchedule = () => {
    if (numMonths <= 0 || defaultAmount <= 0) {
      alert('Please enter a valid number of months and amount.');
      return;
    }

    const generated = getMonthlyDueDates(startDate, numMonths, dueDay);

    // Build new list keeping any existing paid dues intact
    const existingPaid = editableDues.filter((d) => d.status === 'PAID' || d.status === 'PARTIALLY_PAID');
    const existingMonthsMap = new Map(editableDues.map((d) => [d.due_month, d]));

    const newList = generated.map((gen) => {
      const existing = existingMonthsMap.get(gen.due_month);
      if (existing) {
        return {
          ...existing,
          due_date: gen.due_date,
          current_amount: existing.status === 'PAID' ? existing.current_amount : defaultAmount,
        };
      }
      return {
        due_month: gen.due_month,
        due_date: gen.due_date,
        current_amount: defaultAmount,
        status: 'PENDING',
        notes: `Month Installment (Due ${dueDay}th)`,
        is_new: true,
      };
    });

    setEditableDues(newList);
  };

  const handleAddSingleMonth = () => {
    const lastDue = editableDues[editableDues.length - 1];
    let nextMonthStr = getTodayStr().slice(0, 7);
    let nextDateStr = `${nextMonthStr}-${String(dueDay).padStart(2, '0')}`;

    if (lastDue) {
      const generatedNext = getMonthlyDueDates(lastDue.due_date, 2, dueDay);
      if (generatedNext[1]) {
        nextMonthStr = generatedNext[1].due_month;
        nextDateStr = generatedNext[1].due_date;
      }
    }

    setEditableDues((prev) => [
      ...prev,
      {
        due_month: nextMonthStr,
        due_date: nextDateStr,
        current_amount: defaultAmount > 0 ? defaultAmount : 1000,
        status: 'PENDING',
        notes: `Additional installment`,
        is_new: true,
      },
    ]);
  };

  const handleAmountChange = (index: number, newAmount: number) => {
    setEditableDues((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, current_amount: newAmount } : item))
    );
  };

  const handleDateChange = (index: number, newDate: string) => {
    const monthStr = newDate.slice(0, 7);
    setEditableDues((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, due_date: newDate, due_month: monthStr } : item
      )
    );
  };

  const handleStatusChange = (index: number, newStatus: string) => {
    setEditableDues((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, status: newStatus } : item))
    );
  };

  const handleDeleteItem = (index: number) => {
    setEditableDues((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // 1. Delete dues that were removed from the editable list
      const currentIds = editableDues.map((d) => d.id).filter(Boolean);
      const duesToDelete = dues.filter((d) => !currentIds.includes(d.id));
      for (const d of duesToDelete) {
        await supabase.from('monthly_dues').delete().eq('id', d.id);
      }

      // 2. Upsert editable dues
      for (const d of editableDues) {
        if (d.id) {
          await supabase
            .from('monthly_dues')
            .update({
              due_month: d.due_month,
              due_date: d.due_date,
              current_amount: d.current_amount,
              original_amount: d.current_amount,
              status: d.status,
              notes: d.notes || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', d.id);
        } else {
          await supabase.from('monthly_dues').insert({
            user_id: userData.user.id,
            loan_id: loan.id,
            person_id: loan.person_id || null,
            due_month: d.due_month,
            due_date: d.due_date,
            original_amount: d.current_amount,
            current_amount: d.current_amount,
            status: d.status || 'PENDING',
            notes: d.notes || null,
          });
        }
      }

      // Update loan installment count
      await supabase
        .from('loans')
        .update({
          installment_count: editableDues.length,
          default_due_amount: defaultAmount,
          default_due_day: dueDay,
          updated_at: new Date().toISOString(),
        })
        .eq('id', loan.id);

      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error saving monthly dues schedule');
    } finally {
      setSaving(false);
    }
  };

  const totalScheduled = editableDues.reduce((acc, d) => acc + Number(d.current_amount), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Monthly Dues Schedule — ${loan.loan_source?.name || 'Loan'} (${loan.person?.name || 'Myself'})`}
      maxWidth="2xl"
    >
      <div className="space-y-6">
        {/* Schedule Generator Tool Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-4">
          <div className="flex items-center space-x-2 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span>Generate / Reset Multi-Month Schedule</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Number of Months
              </label>
              <input
                type="number"
                min={1}
                max={60}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-bold focus:outline-none dark:bg-[#131b2e] dark:text-white"
                value={numMonths}
                onChange={(e) => setNumMonths(parseInt(e.target.value, 10) || 1)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Monthly Amount (₹)
              </label>
              <input
                type="number"
                min={0}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-bold focus:outline-none dark:bg-[#131b2e] dark:text-white"
                value={defaultAmount}
                onChange={(e) => setDefaultAmount(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Due Day of Month
              </label>
              <input
                type="number"
                min={1}
                max={31}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-bold focus:outline-none dark:bg-[#131b2e] dark:text-white"
                value={dueDay}
                onChange={(e) => setDueDay(parseInt(e.target.value, 10) || 5)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Start Date
              </label>
              <input
                type="date"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-bold focus:outline-none dark:bg-[#131b2e] dark:text-white"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={handleGenerateSchedule}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Generate {numMonths} Months Schedule (5th of each month)
            </Button>
          </div>
        </div>

        {/* Schedule Summary Bar */}
        <div className="flex items-center justify-between px-1 text-xs">
          <div className="text-slate-500">
            Total Months: <span className="font-extrabold text-slate-900 dark:text-white">{editableDues.length} Months</span>
          </div>
          <div className="text-slate-500">
            Total Scheduled Dues: <span className="font-black text-indigo-600 dark:text-indigo-400">{formatINR(totalScheduled)}</span>
          </div>
        </div>

        {/* Multi-Month Interactive Dues List */}
        {loading ? (
          <LoadingSkeleton className="h-48 w-full" />
        ) : editableDues.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 font-semibold">No monthly dues scheduled yet for this loan.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={handleGenerateSchedule}>
              Generate 6-Month Schedule
            </Button>
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
            {editableDues.map((item, idx) => {
              const remInfo = getDaysRemainingInfo(item.due_date, item.status === 'PAID');
              return (
                <div
                  key={idx}
                  className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {formatMonthDisplay(item.due_month)}
                      </p>
                      <span className={`inline-block px-2 py-0.5 mt-0.5 rounded-md text-[10px] ${remInfo.badgeClass}`}>
                        {remInfo.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400">Due Date</label>
                      <input
                        type="date"
                        className="rounded-xl border border-slate-200 dark:border-slate-800 px-2 py-1 text-xs font-semibold focus:outline-none dark:bg-[#131b2e] dark:text-white"
                        value={item.due_date}
                        onChange={(e) => handleDateChange(idx, e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400">Amount (₹)</label>
                      <input
                        type="number"
                        step="any"
                        min={0}
                        className="w-24 rounded-xl border border-slate-200 dark:border-slate-800 px-2 py-1 text-xs font-bold focus:outline-none dark:bg-[#131b2e] dark:text-white"
                        value={item.current_amount}
                        onChange={(e) => handleAmountChange(idx, parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] uppercase font-bold text-slate-400">Status</label>
                      <select
                        className="rounded-xl border border-slate-200 dark:border-slate-800 px-2 py-1 text-xs font-semibold focus:outline-none dark:bg-[#131b2e] dark:text-white"
                        value={item.status}
                        onChange={(e) => handleStatusChange(idx, e.target.value)}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="PAID">Paid</option>
                        <option value="PARTIALLY_PAID">Partially Paid</option>
                        <option value="WAIVED">Waived</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStatusChange(idx, item.status === 'PAID' ? 'PENDING' : 'PAID')}
                      className={`px-2 py-1 rounded-xl text-xs font-bold transition-all border mt-3.5 ${
                        item.status === 'PAID'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {item.status === 'PAID' ? '✓ Paid' : 'Mark Paid'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteItem(idx)}
                      title="Delete Month Due"
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 mt-3.5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={handleAddSingleMonth}>
            <Plus className="w-4 h-4 mr-1.5" />
            Add Another Month
          </Button>

          <div className="flex items-center space-x-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" isLoading={saving} onClick={handleSaveAll}>
              <Save className="w-4 h-4 mr-1.5" />
              Save Schedule Changes
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
