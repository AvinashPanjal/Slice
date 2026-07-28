'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { createClient } from '@/lib/supabase/client';
import { Person, Loan, MonthlyDue, PaymentAllocation, Adjustment, ActivityLog, LoanSource, ReminderTemplate } from '@/lib/types';
import { aggregatePersonSummary, calculateLoanRemaining, calculateDuePaid, calculateDueRemaining } from '@/lib/calculations';
import { formatINR } from '@/lib/utils/currency';
import { formatDateDisplay, getCurrentMonthStr, getTodayStr } from '@/lib/utils/date';
import { PersonFormModal } from '@/components/people/PersonFormModal';
import { WhatsAppModal } from '@/components/people/WhatsAppModal';
import { LoanFormModal } from '@/components/loans/LoanFormModal';
import { PaymentFormModal } from '@/components/payments/PaymentFormModal';
import { EditDueModal } from '@/components/dues/EditDueModal';
import { ActivityTimeline } from '@/components/audit/ActivityTimeline';
import {
  User,
  Phone,
  Edit,
  MessageSquare,
  PlusCircle,
  Receipt,
  CreditCard,
  Calendar,
  ArrowLeft,
  Trash2,
} from 'lucide-react';

export default function PersonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const personId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [person, setPerson] = useState<Person | null>(null);
  const [personLoans, setPersonLoans] = useState<Loan[]>([]);
  const [personDues, setPersonDues] = useState<MonthlyDue[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [sources, setSources] = useState<LoanSource[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);

  // Modals
  const [isEditPersonOpen, setIsEditPersonOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [selectedDueToEdit, setSelectedDueToEdit] = useState<MonthlyDue | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: p },
        { data: l },
        { data: d },
        { data: a },
        { data: adj },
        { data: s },
        { data: logData },
        { data: t },
      ] = await Promise.all([
        supabase.from('people').select('*').eq('id', personId).single(),
        supabase.from('loans').select('*, loan_source:loan_sources(*)').eq('person_id', personId),
        supabase.from('monthly_dues').select('*').eq('person_id', personId),
        supabase.from('payment_allocations').select('*'),
        supabase.from('adjustments').select('*').eq('person_id', personId),
        supabase.from('loan_sources').select('*'),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }),
        supabase.from('reminder_templates').select('*'),
      ]);

      if (p) setPerson(p);
      if (l) setPersonLoans(l);
      if (d) setPersonDues(d);
      if (a) setAllocations(a);
      if (adj) setAdjustments(adj);
      if (s) setSources(s);
      if (logData) setLogs(logData);
      if (t) setTemplates(t);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (personId) fetchData();
  }, [personId]);

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
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error deleting loan record');
    }
  };

  if (loading || !person) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton className="h-10 w-48" />
        <LoadingSkeleton className="h-40 w-full" />
      </div>
    );
  }

  const currentMonth = getCurrentMonthStr();
  const today = getTodayStr();

  const summary = aggregatePersonSummary(
    person,
    personLoans,
    personDues,
    allocations,
    adjustments,
    currentMonth,
    today
  );

  return (
    <div className="space-y-8">
      {/* Back Button */}
      <button
        onClick={() => router.push('/people')}
        className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back to People Ledger
      </button>

      {/* Person Header Card */}
      <Card className="p-6 bg-white dark:bg-[#131b2e] border border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-[#0b1c30] text-white flex items-center justify-center font-bold text-xl shadow-md">
              {person.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">{person.name}</h1>
                <Badge status={summary.status} />
              </div>
              <p className="text-xs text-slate-500 flex items-center mt-1">
                <Phone className="w-3.5 h-3.5 mr-1" /> +91 {person.phone}
                {person.email && <span className="ml-3">• {person.email}</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsEditPersonOpen(true)}>
              <Edit className="w-3.5 h-3.5 mr-1" />
              Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsWhatsAppOpen(true)}>
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600 mr-1" />
              WhatsApp
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsAddLoanOpen(true)}>
              <PlusCircle className="w-3.5 h-3.5 text-indigo-500 mr-1" />
              Add Loan
            </Button>
            <Button size="sm" variant="success" onClick={() => setIsAddPaymentOpen(true)}>
              <Receipt className="w-3.5 h-3.5 mr-1" />
              Add Payment
            </Button>
          </div>
        </div>

        {/* Aggregated Financial Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <p className="text-slate-400 font-semibold uppercase text-[10px]">Total Borrowed</p>
            <p className="font-extrabold text-base text-slate-900 dark:text-white mt-0.5">
              {formatINR(summary.total_borrowed)}
            </p>
          </div>
          <div>
            <p className="text-slate-400 font-semibold uppercase text-[10px]">Total Paid</p>
            <p className="font-extrabold text-base text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatINR(summary.total_paid)}
            </p>
          </div>
          <div>
            <p className="text-slate-400 font-semibold uppercase text-[10px]">Outstanding</p>
            <p className="font-extrabold text-base text-amber-600 dark:text-amber-400 mt-0.5">
              {formatINR(summary.outstanding)}
            </p>
          </div>
          <div>
            <p className="text-slate-400 font-semibold uppercase text-[10px]">Current Month Due</p>
            <p className="font-extrabold text-base text-slate-900 dark:text-white mt-0.5">
              {formatINR(summary.current_month_due)}
            </p>
          </div>
          <div>
            <p className="text-slate-400 font-semibold uppercase text-[10px]">Month Paid</p>
            <p className="font-extrabold text-base text-emerald-600 mt-0.5">
              {formatINR(summary.current_month_paid)}
            </p>
          </div>
          <div>
            <p className="text-slate-400 font-semibold uppercase text-[10px]">Month Pending</p>
            <p className="font-extrabold text-base text-rose-600 mt-0.5">
              {formatINR(summary.current_month_pending)}
            </p>
          </div>
          <div>
            <p className="text-slate-400 font-semibold uppercase text-[10px]">Overdue</p>
            <p className="font-extrabold text-base text-rose-600 mt-0.5">
              {formatINR(summary.overdue_amount)}
            </p>
          </div>
        </div>
      </Card>

      {/* Individual Loans Breakdown (Requirement 1 & 7) */}
      <div className="space-y-4">
        <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center">
          <CreditCard className="w-5 h-5 mr-2 text-indigo-500" />
          Individual Loan Transactions ({personLoans.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {personLoans.map((loan, idx) => {
            const loanAllocations = allocations.filter((a) => a.loan_id === loan.id);
            const paid = loanAllocations.reduce((acc, a) => acc + Number(a.amount), 0);
            const remaining = calculateLoanRemaining(loan, allocations, adjustments);

            // Related due
            const currentDue = personDues.find(
              (d) => d.loan_id === loan.id && d.due_month === currentMonth
            );

            return (
              <Card key={loan.id} className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                      Loan #{idx + 1} ({loan.loan_source?.name || 'Custom Source'})
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
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Paid</p>
                    <p className="font-bold text-emerald-600">{formatINR(paid)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Remaining</p>
                    <p className="font-extrabold text-amber-600">{formatINR(remaining)}</p>
                  </div>
                </div>

                {currentDue && (
                  <div className="p-3 bg-blue-50/50 dark:bg-slate-800/80 rounded-xl border border-blue-100 dark:border-slate-700 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-500">Current Month Due: </span>
                      <span className="font-bold text-slate-900 dark:text-white">{formatINR(currentDue.current_amount)}</span>
                      <span className="ml-2">
                        <Badge status={currentDue.status} />
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs py-1 px-2"
                      onClick={() => setSelectedDueToEdit(currentDue)}
                    >
                      Edit Due
                    </Button>
                  </div>
                )}

                <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-xs"
                    onClick={() => {
                      setEditingLoan(loan);
                      setIsAddLoanOpen(true);
                    }}
                  >
                    Edit Loan
                  </Button>
                  <Button
                    size="sm"
                    variant="success"
                    className="flex-1 text-xs"
                    onClick={() => setIsAddPaymentOpen(true)}
                  >
                    Add Payment
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
              </Card>
            );
          })}
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="space-y-4">
        <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
          Activity & Audit History
        </h2>
        <ActivityTimeline logs={logs} />
      </div>

      {/* Modals */}
      <PersonFormModal
        isOpen={isEditPersonOpen}
        onClose={() => setIsEditPersonOpen(false)}
        person={person}
        onSuccess={fetchData}
      />

      <WhatsAppModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        person={person}
        dueAmount={summary.current_month_due}
        paidAmount={summary.current_month_paid}
        remainingAmount={summary.current_month_pending}
        templates={templates}
      />

      <LoanFormModal
        isOpen={isAddLoanOpen}
        onClose={() => {
          setIsAddLoanOpen(false);
          setEditingLoan(null);
        }}
        loan={editingLoan}
        defaultPersonId={person.id}
        people={[person]}
        sources={sources}
        onSuccess={fetchData}
      />

      <PaymentFormModal
        isOpen={isAddPaymentOpen}
        onClose={() => setIsAddPaymentOpen(false)}
        defaultPersonId={person.id}
        people={[person]}
        loans={personLoans}
        dues={personDues}
        allocations={allocations}
        onSuccess={fetchData}
      />

      <EditDueModal
        isOpen={!!selectedDueToEdit}
        onClose={() => setSelectedDueToEdit(null)}
        due={selectedDueToEdit}
        onSuccess={fetchData}
      />
    </div>
  );
}
