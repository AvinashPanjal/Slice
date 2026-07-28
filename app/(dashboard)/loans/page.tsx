'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { createClient } from '@/lib/supabase/client';
import { Loan, Person, LoanSource, PaymentAllocation, Adjustment } from '@/lib/types';
import { calculateLoanRemaining, calculateTotalBorrowed } from '@/lib/calculations';
import { formatINR } from '@/lib/utils/currency';
import { formatDateDisplay } from '@/lib/utils/date';
import { LoanFormModal } from '@/components/loans/LoanFormModal';
import { MonthlyDuesScheduleModal } from '@/components/dues/MonthlyDuesScheduleModal';
import { CreditCard, Plus, Filter, User, UserCheck, Trash2, Calendar } from 'lucide-react';

export default function LoansPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  const [loans, setLoans] = useState<Loan[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [sources, setSources] = useState<LoanSource[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);

  // Filter & Sort
  const [borrowerTypeFilter, setBorrowerTypeFilter] = useState<'ALL' | 'PERSON' | 'MYSELF'>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');

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
      ] = await Promise.all([
        supabase.from('loans').select('*, person:people(*), loan_source:loan_sources(*)').order('created_at', { ascending: false }),
        supabase.from('people').select('*'),
        supabase.from('loan_sources').select('*'),
        supabase.from('payment_allocations').select('*'),
        supabase.from('adjustments').select('*'),
      ]);

      if (l) setLoans(l);
      if (p) setPeople(p);
      if (s) setSources(s);
      if (a) setAllocations(a);
      if (adj) setAdjustments(adj);
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

  const filteredLoans = loans.filter((loan) => {
    if (borrowerTypeFilter !== 'ALL' && loan.borrower_type !== borrowerTypeFilter) return false;
    if (sourceFilter !== 'ALL' && loan.loan_source_id !== sourceFilter) return false;
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
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-2 overflow-x-auto">
          <select
            className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold focus:outline-none dark:bg-[#131b2e] dark:text-white"
            value={borrowerTypeFilter}
            onChange={(e: any) => setBorrowerTypeFilter(e.target.value)}
          >
            <option value="ALL">All Borrowers (Person & Myself)</option>
            <option value="PERSON">Friend / Person Loans</option>
            <option value="MYSELF">Money Taken for Myself</option>
          </select>

          <select
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
        </div>

        <div className="text-xs text-slate-500 font-semibold">
          Filtered Total: <span className="font-extrabold text-slate-900 dark:text-white">{formatINR(totalOriginal)}</span>
        </div>
      </Card>

      {/* Loans Grid */}
      {filteredLoans.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="w-6 h-6 text-slate-400" />}
          title="No Loans Found"
          description="Create your first loan record to begin tracking dues."
          actionLabel="Record Loan"
          onAction={() => {
            setEditingLoan(null);
            setIsLoanModalOpen(true);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLoans.map((loan) => {
            const remaining = calculateLoanRemaining(loan, allocations, adjustments);
            const loanAllocations = allocations.filter((a) => a.loan_id === loan.id);
            const paid = loanAllocations.reduce((acc, a) => acc + Number(a.amount), 0);

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

                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Original</p>
                    <p className="font-bold text-slate-900 dark:text-white">{formatINR(loan.original_amount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Paid</p>
                    <p className="font-bold text-emerald-600">{formatINR(paid)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Remaining</p>
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
