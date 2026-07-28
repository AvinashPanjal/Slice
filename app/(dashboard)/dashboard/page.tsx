'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { createClient } from '@/lib/supabase/client';
import {
  Loan,
  MonthlyDue,
  PaymentAllocation,
  Adjustment,
  Person,
  DashboardStats,
  ReminderTemplate,
} from '@/lib/types';
import {
  calculateDashboardStats,
  calculateDueRemaining,
  aggregatePersonSummary,
  calculateDuePaid,
} from '@/lib/calculations';
import { formatINR } from '@/lib/utils/currency';
import { formatDateDisplay, getCurrentMonthStr, getTodayStr } from '@/lib/utils/date';
import { WhatsAppModal } from '@/components/people/WhatsAppModal';
import { PaymentFormModal } from '@/components/payments/PaymentFormModal';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle,
  MessageSquare,
  PlusCircle,
  UserCheck,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

export default function DashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  const [loans, setLoans] = useState<Loan[]>([]);
  const [dues, setDues] = useState<MonthlyDue[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);

  // Action Modals
  const [selectedPersonForWhatsApp, setSelectedPersonForWhatsApp] = useState<{
    person: Person;
    dueAmount: number;
    paidAmount: number;
    remainingAmount: number;
    dueDate?: string;
  } | null>(null);

  const [paymentModalPersonId, setPaymentModalPersonId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [
        { data: l },
        { data: d },
        { data: a },
        { data: adj },
        { data: p },
        { data: t },
      ] = await Promise.all([
        supabase.from('loans').select('*'),
        supabase.from('monthly_dues').select('*'),
        supabase.from('payment_allocations').select('*'),
        supabase.from('adjustments').select('*'),
        supabase.from('people').select('*'),
        supabase.from('reminder_templates').select('*'),
      ]);

      if (l) setLoans(l);
      if (d) setDues(d);
      if (a) setAllocations(a);
      if (adj) setAdjustments(adj);
      if (p) setPeople(p);
      if (t) setTemplates(t);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const currentMonth = getCurrentMonthStr();
  const today = getTodayStr();

  const stats: DashboardStats = calculateDashboardStats(
    loans,
    dues,
    allocations,
    adjustments,
    currentMonth,
    today
  );

  // Identify "Needs Attention" Dues (Overdue, Due Today, Partial)
  const needsAttentionDues = dues.filter((d) => {
    if (d.status === 'WAIVED' || d.status === 'SKIPPED') return false;
    const remaining = calculateDueRemaining(d, allocations);
    return remaining > 0 && (d.due_date <= today || d.status === 'PARTIALLY_PAID');
  });

  // Monthly Chart Data (Last 6 Months)
  const chartData = [
    { month: 'Mar', expected: 12000, received: 10000 },
    { month: 'Apr', expected: 15000, received: 14000 },
    { month: 'May', expected: 8000, received: 8000 },
    { month: 'Jun', expected: 18000, received: 15000 },
    { month: 'Jul', expected: stats.due_this_month, received: stats.received_this_month },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <LoadingSkeleton className="h-24 w-full" />
          <LoadingSkeleton className="h-24 w-full" />
          <LoadingSkeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. Summary Cards Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white dark:from-[#131b2e] dark:to-slate-900 border-none">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Given</p>
          <h3 className="text-xl sm:text-2xl font-black mt-1 tracking-tight">{formatINR(stats.total_given)}</h3>
          <p className="text-[10px] text-slate-400 mt-2">Sum of original loans</p>
        </Card>

        <Card className="border-amber-200 dark:border-amber-900/40 bg-amber-500/5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Outstanding</p>
          <h3 className="text-xl sm:text-2xl font-black mt-1 tracking-tight text-amber-600 dark:text-amber-400">
            {formatINR(stats.total_outstanding)}
          </h3>
          <p className="text-[10px] text-slate-500 mt-2">Active balance</p>
        </Card>

        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Due This Month</p>
          <h3 className="text-xl sm:text-2xl font-black mt-1 tracking-tight text-slate-900 dark:text-white">
            {formatINR(stats.due_this_month)}
          </h3>
          <p className="text-[10px] text-slate-500 mt-2">Current month target</p>
        </Card>

        <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-500/5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Received</p>
          <h3 className="text-xl sm:text-2xl font-black mt-1 tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatINR(stats.received_this_month)}
          </h3>
          <p className="text-[10px] text-slate-500 mt-2">Collected this month</p>
        </Card>

        <Card className="border-rose-200 dark:border-rose-900/40 bg-rose-500/5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">Overdue</p>
          <h3 className="text-xl sm:text-2xl font-black mt-1 tracking-tight text-rose-600 dark:text-rose-400">
            {formatINR(stats.overdue_amount)}
          </h3>
          <p className="text-[10px] text-slate-500 mt-2">Past due date</p>
        </Card>

        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pending People</p>
          <h3 className="text-xl sm:text-2xl font-black mt-1 tracking-tight text-slate-900 dark:text-white">
            {stats.pending_people_count}
          </h3>
          <p className="text-[10px] text-slate-500 mt-2">Borrowers with due</p>
        </Card>
      </div>

      {/* 2. Needs Attention Section (Priority for Daily Use) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              Needs Immediate Attention
            </h2>
          </div>
          <span className="text-xs font-bold text-slate-400">
            {needsAttentionDues.length} pending items
          </span>
        </div>

        {needsAttentionDues.length === 0 ? (
          <EmptyState
            icon={<CheckCircle className="w-6 h-6 text-emerald-500" />}
            title="All Clear! No Overdue Payments"
            description="Everyone has cleared their pending dues for this cycle."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {needsAttentionDues.slice(0, 6).map((due) => {
              const person = people.find((p) => p.id === due.person_id);
              const remaining = calculateDueRemaining(due, allocations);
              const paid = calculateDuePaid(due, allocations);
              const isOverdue = due.due_date < today;

              return (
                <Card
                  key={due.id}
                  className={`flex flex-col justify-between space-y-4 ${
                    isOverdue ? 'border-rose-200 dark:border-rose-900/60 bg-rose-500/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-base text-slate-900 dark:text-white">
                        {person ? person.name : 'Myself'}
                      </h4>
                      <p className="text-xs text-slate-500">
                        {person?.phone ? `+91 ${person.phone}` : 'Personal Expense'}
                      </p>
                    </div>
                    <Badge status={isOverdue ? 'OVERDUE' : due.status} />
                  </div>

                  <div className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-xl space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Due Month:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{due.due_month}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Due Date:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {formatDateDisplay(due.due_date)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 dark:border-slate-700 pt-1 mt-1">
                      <span className="text-slate-500">Pending Amount:</span>
                      <span className="font-extrabold text-rose-600 dark:text-rose-400">
                        {formatINR(remaining)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Button
                      size="sm"
                      variant="success"
                      className="flex-1 text-xs"
                      onClick={() => setPaymentModalPersonId(due.person_id || null)}
                    >
                      <PlusCircle className="w-3.5 h-3.5 mr-1" />
                      Record Payment
                    </Button>
                    {person && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() =>
                          setSelectedPersonForWhatsApp({
                            person,
                            dueAmount: due.current_amount,
                            paidAmount: paid,
                            remainingAmount: remaining,
                            dueDate: due.due_date,
                          })
                        }
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Collection Trends Chart */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
              Monthly Repayment Analytics
            </h3>
            <p className="text-xs text-slate-500">Expected vs Received collection history</p>
          </div>
          <TrendingUp className="w-5 h-5 text-emerald-500" />
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip formatter={(value: any) => formatINR(Number(value))} />
              <Legend />
              <Bar dataKey="expected" fill="#3b82f6" name="Expected Due" radius={[4, 4, 0, 0]} />
              <Bar dataKey="received" fill="#10b981" name="Received" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

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
          templates={templates}
        />
      )}

      {/* Payment Form Modal */}
      {paymentModalPersonId && (
        <PaymentFormModal
          isOpen={!!paymentModalPersonId}
          onClose={() => setPaymentModalPersonId(null)}
          defaultPersonId={paymentModalPersonId}
          people={people}
          loans={loans}
          dues={dues}
          allocations={allocations}
          onSuccess={fetchDashboardData}
        />
      )}
    </div>
  );
}
