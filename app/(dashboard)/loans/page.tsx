'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { createClient } from '@/lib/supabase/client';
import { Loan, Person, LoanSource, PaymentAllocation, Adjustment, MonthlyDue } from '@/lib/types';
import { calculateLoanRemaining, calculateTotalBorrowed, calculateTotalPaid } from '@/lib/calculations';
import { formatINR } from '@/lib/utils/currency';
import { formatDateDisplay, formatMonthDisplay } from '@/lib/utils/date';
import { LoanFormModal } from '@/components/loans/LoanFormModal';
import { MonthlyDuesScheduleModal } from '@/components/dues/MonthlyDuesScheduleModal';
import { CreditCard, Plus, Filter, User, UserCheck, Trash2, Calendar, X, CalendarRange } from 'lucide-react';

export default function LoansPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  const [loans, setLoans] = useState<Loan[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [sources, setSources] = useState<LoanSource[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [dues, setDues] = useState<MonthlyDue[]>([]);

  // Filter & Sort
  const [borrowerTypeFilter, setBorrowerTypeFilter] = useState<'ALL' | 'PERSON' | 'MYSELF'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [dateFilterMode, setDateFilterMode] = useState<'EXACT' | 'RANGE' | 'MONTH' | 'ALL'>('EXACT');
  const [exactDate, setExactDate] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  // Modal State
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [selectedLoanForSchedule, setSelectedLoanForSchedule] = useState<Loan | null>(null);

  const fetchLoansData = async () => {
    setLoading(true);
    try {
      const [
        { data: l },
        { data: p },
        { data: s },
        { data: a },
        { data: adj },
        { data: d },
      ] = await Promise.all([
        supabase.from('loans').select('*, person:people(*), loan_source:loan_sources(*)').order('created_at', { ascending: false }),
        supabase.from('people').select('*'),
        supabase.from('loan_sources').select('*'),
        supabase.from('payment_allocations').select('*'),
        supabase.from('adjustments').select('*'),
        supabase.from('monthly_dues').select('*'),
      ]);

      if (l) setLoans(l);
      if (p) setPeople(p);
      if (s) setSources(s);
      if (a) setAllocations(a);
      if (adj) setAdjustments(adj);
      if (d) setDues(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoansData();
  }, []);

  const handleDeleteLoan = async (loanId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this loan record? This action will permanently remove this loan and all associated monthly dues and payment allocations.'
      )
    ) {
      return;
    }
    try {
      await supabase.from('payment_allocations').delete().eq('loan_id', loanId);
      await supabase.from('adjustments').delete().eq('loan_id', loanId);
      await supabase.from('monthly_dues').delete().eq('loan_id', loanId);
      const { error } = await supabase.from('loans').delete().eq('id', loanId);
      if (error) throw error;
      fetchLoansData();
    } catch (err: any) {
      alert(err.message || 'Error deleting loan record');
    }
  };

  const getLoanDatePart = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    return dateStr.split('T')[0].split(' ')[0].trim();
  };

  const isDateFilterActive =
    (dateFilterMode === 'EXACT' && !!exactDate) ||
    (dateFilterMode === 'RANGE' && (!!startDate || !!endDate)) ||
    (dateFilterMode === 'MONTH' && !!selectedMonth);

  const isAnyFilterActive =
    borrowerTypeFilter !== 'ALL' ||
    sourceFilter !== 'ALL' ||
    isDateFilterActive;

  const handleResetFilters = () => {
    setBorrowerTypeFilter('ALL');
    setSourceFilter('ALL');
    setExactDate('');
    setStartDate('');
    setEndDate('');
    setSelectedMonth('');
  };

  const filteredLoans = loans.filter((loan) => {
    if (borrowerTypeFilter !== 'ALL' && loan.borrower_type !== borrowerTypeFilter) return false;
    if (sourceFilter !== 'ALL' && loan.loan_source_id !== sourceFilter) return false;

    if (isDateFilterActive) {
      const loanDate = getLoanDatePart(loan.taken_date);
      if (!loanDate) return false;

      if (dateFilterMode === 'EXACT' && exactDate) {
        if (loanDate !== exactDate) return false;
      } else if (dateFilterMode === 'RANGE') {
        if (startDate && loanDate < startDate) return false;
        if (endDate && loanDate > endDate) return false;
      } else if (dateFilterMode === 'MONTH' && selectedMonth) {
        if (!loanDate.startsWith(selectedMonth)) return false;
      }
    }

    return true;
  });

  const totalOriginal = calculateTotalBorrowed(filteredLoans);

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LoadingSkeleton className="h-44 w-full" />
          <LoadingSkeleton className="h-44 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Loans Directory</h1>
          <p className="text-xs text-slate-500">Track all active and historical loan records for friends & myself</p>
        </div>
        <Button
          onClick={() => {
            setEditingLoan(null);
            setIsLoanModalOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Record New Loan
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Main Filter Group */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Borrower Filter */}
            <select
              aria-label="Filter by borrower"
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold focus:outline-none dark:bg-[#131b2e] dark:text-white"
              value={borrowerTypeFilter}
              onChange={(e: any) => setBorrowerTypeFilter(e.target.value)}
            >
              <option value="ALL">All Borrowers (Person & Myself)</option>
              <option value="PERSON">Friend / Person Loans</option>
              <option value="MYSELF">Money Taken for Myself</option>
            </select>

            {/* Loan Source Filter */}
            <select
              aria-label="Filter by loan source"
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold focus:outline-none dark:bg-[#131b2e] dark:text-white"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="ALL">All Loan Sources</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Date Filter Mode Selector */}
            <select
              aria-label="Filter by date option"
              className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold focus:outline-none dark:bg-[#131b2e] dark:text-white"
              value={dateFilterMode}
              onChange={(e: any) => {
                const mode = e.target.value;
                setDateFilterMode(mode);
                if (mode === 'ALL') {
                  setExactDate('');
                  setStartDate('');
                  setEndDate('');
                  setSelectedMonth('');
                }
              }}
            >
              <option value="EXACT">📅 Specific Taking Date</option>
              <option value="RANGE">📅 Taking Date Range</option>
              <option value="MONTH">📅 Taking Month</option>
              <option value="ALL">📅 Date Filter: Off</option>
            </select>

            {/* Exact Taking Date Input */}
            {dateFilterMode === 'EXACT' && (
              <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="text-xs text-slate-500 font-medium shrink-0">Taking Date:</span>
                <input
                  type="date"
                  aria-label="Filter by loan taking date"
                  className="bg-transparent text-xs font-semibold focus:outline-none dark:text-white dark:[color-scheme:dark] cursor-pointer"
                  value={exactDate}
                  onChange={(e) => setExactDate(e.target.value)}
                />
                {exactDate && (
                  <button
                    onClick={() => setExactDate('')}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 rounded-full"
                    title="Clear date filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Taking Date Range Inputs */}
            {dateFilterMode === 'RANGE' && (
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5">
                <CalendarRange className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="text-[11px] text-slate-400 font-semibold uppercase">From</span>
                <input
                  type="date"
                  aria-label="Filter from taking date"
                  className="bg-transparent text-xs font-semibold focus:outline-none dark:text-white dark:[color-scheme:dark] cursor-pointer"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="text-[11px] text-slate-400 font-semibold uppercase">To</span>
                <input
                  type="date"
                  aria-label="Filter to taking date"
                  className="bg-transparent text-xs font-semibold focus:outline-none dark:text-white dark:[color-scheme:dark] cursor-pointer"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 rounded-full"
                    title="Clear date range"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Taking Month Input */}
            {dateFilterMode === 'MONTH' && (
              <div className="flex items-center space-x-1.5 bg-slate-50 dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="text-xs text-slate-500 font-medium shrink-0">Taking Month:</span>
                <input
                  type="month"
                  aria-label="Filter by loan taking month"
                  className="bg-transparent text-xs font-semibold focus:outline-none dark:text-white dark:[color-scheme:dark] cursor-pointer"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
                {selectedMonth && (
                  <button
                    onClick={() => setSelectedMonth('')}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5 rounded-full"
                    title="Clear month filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Reset All Filters Button */}
            {isAnyFilterActive && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center space-x-1 text-xs font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400 px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                title="Reset all filters"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Counts & Totals */}
          <div className="flex items-center space-x-3 text-xs text-slate-500 font-semibold ml-auto">
            <span>
              Showing <strong className="text-slate-900 dark:text-white">{filteredLoans.length}</strong> of {loans.length}
            </span>
            <span>•</span>
            <span>
              Filtered Total: <span className="font-extrabold text-slate-900 dark:text-white">{formatINR(totalOriginal)}</span>
            </span>
          </div>
        </div>

        {/* Active Date Filter Indicator Banner */}
        {isDateFilterActive && (
          <div className="flex items-center justify-between text-xs py-1.5 px-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/40 rounded-xl text-indigo-700 dark:text-indigo-300">
            <span className="font-medium">
              Filtered by Taking Date:{' '}
              <strong className="font-bold">
                {dateFilterMode === 'EXACT' && exactDate && formatDateDisplay(exactDate)}
                {dateFilterMode === 'RANGE' &&
                  `${startDate ? formatDateDisplay(startDate) : 'Beginning'} → ${endDate ? formatDateDisplay(endDate) : 'Present'}`}
                {dateFilterMode === 'MONTH' && selectedMonth && formatMonthDisplay(selectedMonth)}
              </strong>
            </span>
            <button
              onClick={() => {
                setExactDate('');
                setStartDate('');
                setEndDate('');
                setSelectedMonth('');
              }}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Clear Date Filter
            </button>
          </div>
        )}
      </Card>

      {/* Loans Grid */}
      {filteredLoans.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="w-6 h-6 text-slate-400" />}
          title={loans.length === 0 ? 'No Loans Found' : 'No Loans Match Filters'}
          description={
            loans.length === 0
              ? 'Create your first loan record to begin tracking dues.'
              : 'No loan records match your selected date or borrower criteria.'
          }
          actionLabel={loans.length === 0 ? 'Record Loan' : 'Reset Filters'}
          onAction={() => {
            if (loans.length === 0) {
              setEditingLoan(null);
              setIsLoanModalOpen(true);
            } else {
              handleResetFilters();
            }
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLoans.map((loan) => {
            const loanAllocations = allocations.filter((a) => a.loan_id === loan.id);
            const loanDues = dues.filter((d) => d.loan_id === loan.id);
            const paid = calculateTotalPaid(loanAllocations, loanDues);
            const remaining = calculateLoanRemaining(loan, allocations, adjustments, dues);
            const totalScheduled = loanDues.reduce((acc, d) => acc + (Number(d.current_amount) || 0), 0);

            return (
              <Card key={loan.id} className="flex flex-col justify-between space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-500">
                      {loan.borrower_type === 'MYSELF' ? 'MYSELF' : loan.person?.name}
                    </span>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white mt-0.5">
                      {loan.loan_source?.name || 'Direct Cash'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Taken on {formatDateDisplay(loan.taken_date)}
                    </p>
                  </div>
                  <Badge status={loan.status} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Original Principal</p>
                    <p className="font-bold text-slate-900 dark:text-white">{formatINR(loan.original_amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-semibold uppercase">Total w/ Interest</p>
                    <p className="font-bold text-indigo-600 dark:text-indigo-400">
                      {formatINR(totalScheduled > 0 ? totalScheduled : loan.original_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Paid</p>
                    <p className="font-bold text-emerald-600">{formatINR(paid)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Remaining Balance</p>
                    <p className="font-extrabold text-amber-600">{formatINR(remaining)}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200/80 dark:border-indigo-900/50"
                    onClick={() => setSelectedLoanForSchedule(loan)}
                  >
                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                    Manage Monthly Dues Schedule ({loan.installment_count || 1} Mos)
                  </Button>

                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs"
                      onClick={() => {
                        setEditingLoan(loan);
                        setIsLoanModalOpen(true);
                      }}
                    >
                      Edit Loan Details
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/50"
                      title="Delete Loan"
                      onClick={() => handleDeleteLoan(loan.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Loan Form Modal */}
      <LoanFormModal
        isOpen={isLoanModalOpen}
        onClose={() => {
          setIsLoanModalOpen(false);
          setEditingLoan(null);
        }}
        loan={editingLoan}
        people={people}
        sources={sources}
        onSuccess={fetchLoansData}
      />

      {/* Dues Schedule Modal */}
      {selectedLoanForSchedule && (
        <MonthlyDuesScheduleModal
          isOpen={!!selectedLoanForSchedule}
          onClose={() => setSelectedLoanForSchedule(null)}
          loan={selectedLoanForSchedule}
          onSuccess={fetchLoansData}
        />
      )}
    </div>
  );
}
