'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { createClient } from '@/lib/supabase/client';
import { LoanSource, Loan, PaymentAllocation, Adjustment, MonthlyDue, Person } from '@/lib/types';
import { calculateTotalBorrowed, calculateLoanRemaining, calculateTotalPaid, calculateDueRemaining, calculateDuePaid } from '@/lib/calculations';
import { formatINR } from '@/lib/utils/currency';
import { formatDateDisplay, getCurrentMonthStr, getTodayStr, formatMonthDisplay, getDaysRemainingInfo } from '@/lib/utils/date';
import { WhatsAppModal } from '@/components/people/WhatsAppModal';
import { Building2, Plus, Trash2, CreditCard, Calendar, CheckCircle, MessageSquare, PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react';

export default function LoanSourcesPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  const [sources, setSources] = useState<LoanSource[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [dues, setDues] = useState<MonthlyDue[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [people, setPeople] = useState<Person[]>([]);

  // Selected Month Filter for Breakdown
  const currentMonth = getCurrentMonthStr();
  const today = getTodayStr();
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-08');

  // Modal State
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [selectedPersonForWhatsApp, setSelectedPersonForWhatsApp] = useState<{
    person: Person;
    dueAmount: number;
    paidAmount: number;
    remainingAmount: number;
    dueDate: string;
  } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: s },
        { data: l },
        { data: a },
        { data: adj },
        { data: d },
        { data: p },
      ] = await Promise.all([
        supabase.from('loan_sources').select('*').order('name'),
        supabase.from('loans').select('*'),
        supabase.from('payment_allocations').select('*'),
        supabase.from('adjustments').select('*'),
        supabase.from('monthly_dues').select('*'),
        supabase.from('people').select('*'),
      ]);

      if (s) setSources(s);
      if (l) setLoans(l);
      if (a) setAllocations(a);
      if (adj) setAdjustments(adj);
      if (d) setDues(d);
      if (p) setPeople(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error } = await supabase.from('loan_sources').insert({
        user_id: userData.user.id,
        name: name.trim(),
        notes: notes.trim() || null,
      });

      if (error) throw error;
      setName('');
      setNotes('');
      setIsAddSourceOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating loan source');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSource = async (id: string, sourceName: string) => {
    if (!confirm(`Are you sure you want to delete loan source "${sourceName}"?`)) return;
    await supabase.from('loan_sources').delete().eq('id', id);
    fetchData();
  };

  const handleQuickMarkPaidSource = async (dueIds: string[]) => {
    try {
      const { error } = await supabase
        .from('monthly_dues')
        .update({
          status: 'PAID',
          is_manually_adjusted: true,
          adjustment_reason: 'Quick marked paid from Loan Sources page',
          updated_at: new Date().toISOString(),
        })
        .in('id', dueIds);

      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error marking dues as paid');
    }
  };

  // Get all unique due months present in data for month tabs, sorted chronologically
  const availableMonths = Array.from(new Set(dues.map((d) => d.due_month))).sort();
  if (!availableMonths.includes(currentMonth)) availableMonths.push(currentMonth);
  availableMonths.sort();

  // Find index of selectedMonth for prev/next navigation
  const selectedIndex = availableMonths.indexOf(selectedMonth);

  const handlePrevMonth = () => {
    if (selectedIndex > 0) {
      setSelectedMonth(availableMonths[selectedIndex - 1]);
    }
  };

  const handleNextMonth = () => {
    if (selectedIndex < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[selectedIndex + 1]);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-10 w-64" />
        <LoadingSkeleton className="h-36 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Loan Sources & Apps
          </h1>
          <p className="text-xs text-slate-500">Manage borrowing platforms (e.g. Slice, Navi, Bank, Custom)</p>
        </div>

        <Button onClick={() => setIsAddSourceOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add Custom Loan Source
        </Button>
      </div>

      {/* Sources Overview Cards */}
      {sources.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-6 h-6 text-slate-400" />}
          title="No Loan Sources Added"
          description="Add loan sources such as Slice, Navi, or banks to track platform borrowing."
          actionLabel="Add Loan Source"
          onAction={() => setIsAddSourceOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map((source) => {
            const sLoans = loans.filter((l) => l.loan_source_id === source.id);
            const sDues = dues.filter((d) => sLoans.some((l) => l.id === d.loan_id));
            const sAllocations = allocations.filter((a) => sLoans.some((l) => l.id === a.loan_id));

            const totalOriginalPrincipal = calculateTotalBorrowed(sLoans);
            const totalScheduled = sDues.reduce((acc, d) => acc + (Number(d.current_amount) || 0), 0);
            const totalPaid = calculateTotalPaid(sAllocations, sDues);
            const outstanding = sLoans.reduce(
              (acc, l) => acc + calculateLoanRemaining(l, allocations, adjustments, dues),
              0
            );

            return (
              <Card key={source.id} className="flex flex-col justify-between space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                      {source.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{sLoans.length} active loan records</p>
                  </div>
                  <button
                    onClick={() => handleDeleteSource(source.id, source.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Original Principal</p>
                    <p className="font-bold text-slate-900 dark:text-white">{formatINR(totalOriginalPrincipal)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-indigo-500 font-semibold uppercase">Total w/ Interest</p>
                    <p className="font-bold text-indigo-600 dark:text-indigo-400">
                      {formatINR(totalScheduled > 0 ? totalScheduled : totalOriginalPrincipal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Paid</p>
                    <p className="font-bold text-emerald-600">{formatINR(totalPaid)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Outstanding</p>
                    <p className="font-extrabold text-amber-600">{formatINR(outstanding)}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Monthly Breakdown Per Person & Overall Section */}
      <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-indigo-500" />
              Monthly Due Breakdown (Per Person & Overall)
            </h2>
            <p className="text-xs text-slate-500">Monthly schedule breakdown per borrower for platform sources</p>
          </div>

          {/* Month Selector Controls */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={selectedIndex <= 0}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131b2e] text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-50 transition-all text-xs font-bold shrink-0"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white shadow-sm cursor-pointer"
            >
              {availableMonths.map((mStr) => (
                <option key={mStr} value={mStr}>
                  {formatMonthDisplay(mStr)} {mStr === currentMonth ? '★ (Active Cycle)' : ''}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleNextMonth}
              disabled={selectedIndex >= availableMonths.length - 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131b2e] text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-50 transition-all text-xs font-bold shrink-0"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Month Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-2 scrollbar-none">
          {availableMonths.map((mStr) => {
            const isSelected = selectedMonth === mStr;
            const isCurrent = mStr === currentMonth;

            return (
              <button
                key={mStr}
                type="button"
                onClick={() => setSelectedMonth(mStr)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#0b1c30] text-white border-[#0b1c30] dark:bg-slate-700 dark:border-slate-600 shadow-sm'
                    : isCurrent
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                    : 'bg-white dark:bg-[#131b2e] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                }`}
              >
                {formatMonthDisplay(mStr)} {isCurrent ? '★' : ''}
              </button>
            );
          })}
        </div>

        {/* Per-Source & Per-Person Breakdown Cards */}
        {sources.map((source) => {
          const sLoans = loans.filter((l) => l.loan_source_id === source.id);
          const sDuesMonth = dues.filter(
            (d) => d.due_month === selectedMonth && sLoans.some((l) => l.id === d.loan_id)
          );

          // Group by Person for this source & month
          const personGroupMap = new Map<string, {
            personId: string | null;
            person: Person | null;
            totalDue: number;
            paidAmount: number;
            remainingAmount: number;
            dueIds: string[];
            duesCount: number;
            status: string;
            dueDate: string;
          }>();

          sDuesMonth.forEach((d) => {
            const groupKey = d.person_id || 'MYSELF';
            const personObj = d.person_id ? people.find((p) => p.id === d.person_id) || null : null;
            const duePaid = calculateDuePaid(d, allocations);
            const dueRem = calculateDueRemaining(d, allocations);

            if (!personGroupMap.has(groupKey)) {
              personGroupMap.set(groupKey, {
                personId: d.person_id || null,
                person: personObj,
                totalDue: Number(d.current_amount) || 0,
                paidAmount: duePaid,
                remainingAmount: dueRem,
                dueIds: [d.id],
                duesCount: 1,
                status: d.status,
                dueDate: d.due_date,
              });
            } else {
              const grp = personGroupMap.get(groupKey)!;
              grp.totalDue += Number(d.current_amount) || 0;
              grp.paidAmount += duePaid;
              grp.remainingAmount += dueRem;
              grp.dueIds.push(d.id);
              grp.duesCount += 1;
            }
          });

          const personBreakdownList = Array.from(personGroupMap.values());
          const overallSourceMonthDue = sDuesMonth.reduce((acc, d) => acc + (Number(d.current_amount) || 0), 0);
          const overallSourceMonthPaid = sDuesMonth.reduce((acc, d) => acc + calculateDuePaid(d, allocations), 0);
          const overallSourceMonthPending = Math.max(overallSourceMonthDue - overallSourceMonthPaid, 0);

          return (
            <Card key={source.id} className="space-y-4 border-l-4 border-l-indigo-500">
              {/* Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-black text-lg text-slate-900 dark:text-white">
                    {source.name} — {formatMonthDisplay(selectedMonth)} Breakdown
                  </h3>
                  <p className="text-xs text-slate-500">
                    {personBreakdownList.length} borrower{personBreakdownList.length !== 1 ? 's' : ''} with scheduled dues in {formatMonthDisplay(selectedMonth)}
                  </p>
                </div>

                <div className="flex items-center space-x-4 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-2xl text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Overall Month Due</span>
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">{formatINR(overallSourceMonthDue)}</span>
                  </div>
                  <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Month Paid</span>
                    <span className="font-extrabold text-sm text-emerald-600">{formatINR(overallSourceMonthPaid)}</span>
                  </div>
                  <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Month Pending</span>
                    <span className="font-extrabold text-sm text-rose-600">{formatINR(overallSourceMonthPending)}</span>
                  </div>
                </div>
              </div>

              {/* Borrower Rows */}
              {personBreakdownList.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No monthly dues scheduled for {source.name} in {formatMonthDisplay(selectedMonth)}.</p>
              ) : (
                <div className="space-y-2.5">
                  {personBreakdownList.map((grp) => {
                    const remInfo = getDaysRemainingInfo(grp.dueDate, grp.remainingAmount <= 0);

                    return (
                      <div
                        key={grp.personId || 'MYSELF'}
                        className="p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        {/* Left: Borrower info */}
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs">
                            {grp.person ? grp.person.name.charAt(0).toUpperCase() : 'M'}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                              {grp.person ? grp.person.name : 'Myself'}
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              {grp.person?.phone ? `+91 ${grp.person.phone}` : 'Personal Loan'} • {grp.duesCount} loan installment(s)
                            </p>
                          </div>
                        </div>

                        {/* Center: Financial breakdown for this month */}
                        <div className="flex items-center space-x-5">
                          <div>
                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Due Date</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{formatDateDisplay(grp.dueDate)}</span>
                            <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] ml-1 ${remInfo.badgeClass}`}>
                              {remInfo.label}
                            </span>
                          </div>

                          <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Monthly Total</span>
                            <span className="font-extrabold text-slate-900 dark:text-white">{formatINR(grp.totalDue)}</span>
                          </div>

                          <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Pending</span>
                            <span className={`font-black ${grp.remainingAmount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {formatINR(grp.remainingAmount)}
                            </span>
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center space-x-2">
                          {grp.remainingAmount > 0 ? (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 shadow-sm"
                              onClick={() => handleQuickMarkPaidSource(grp.dueIds)}
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              Mark Paid
                            </Button>
                          ) : (
                            <span className="px-2.5 py-1 rounded-xl text-xs font-extrabold bg-emerald-500/10 text-emerald-600 border border-emerald-200 dark:border-emerald-900/40">
                              ✓ Paid
                            </span>
                          )}

                          {grp.person && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs text-emerald-600 border-emerald-200 dark:border-emerald-900/50"
                              onClick={() =>
                                setSelectedPersonForWhatsApp({
                                  person: grp.person!,
                                  dueAmount: grp.totalDue,
                                  paidAmount: grp.paidAmount,
                                  remainingAmount: grp.remainingAmount,
                                  dueDate: grp.dueDate,
                                })
                              }
                            >
                              <MessageSquare className="w-3.5 h-3.5 mr-1" />
                              WhatsApp
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isAddSourceOpen}
        onClose={() => setIsAddSourceOpen(false)}
        title="Add Loan Source App"
      >
        <form onSubmit={handleCreateSource} className="space-y-4">
          <Input
            label="Source Name *"
            placeholder="e.g. Slice, Navi, KreditBee"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Notes (Optional)
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white"
              rows={2}
              placeholder="Account reference info or notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsAddSourceOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              Create Source
            </Button>
          </div>
        </form>
      </Modal>

      {/* WhatsApp Modal */}
      {selectedPersonForWhatsApp && (
        <WhatsAppModal
          isOpen={!!selectedPersonForWhatsApp}
          onClose={() => setSelectedPersonForWhatsApp(null)}
          person={selectedPersonForWhatsApp.person}
          dueAmount={selectedPersonForWhatsApp.dueAmount}
          paidAmount={selectedPersonForWhatsApp.paidAmount}
          remainingAmount={selectedPersonForWhatsApp.remainingAmount}
          dueDate={selectedPersonForWhatsApp.dueDate}
        />
      )}
    </div>
  );
}
