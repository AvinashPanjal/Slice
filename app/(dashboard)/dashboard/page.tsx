'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
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
import { formatDateDisplay, getCurrentMonthStr, getTodayStr, getDaysRemainingInfo } from '@/lib/utils/date';
import { WhatsAppModal } from '@/components/people/WhatsAppModal';
import { PaymentFormModal } from '@/components/payments/PaymentFormModal';
import {
  TrendingUp,
  AlertTriangle,
  Users,
  CheckCircle,
  PlusCircle,
  Receipt,
  MessageSquare,
  ArrowUpRight,
  PieChart as PieChartIcon,
  Eye,
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

interface PersonAttentionGroup {
  groupKey: string;
  personId: string | null;
  person: Person | null;
  totalPending: number;
  earliestDueDate: string;
  duesCount: number;
  hasOverdue: boolean;
  dueMonth: string;
}

export default function DashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  const [loans, setLoans] = useState<Loan[]>([]);
  const [dues, setDues] = useState<MonthlyDue[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);

  // Modal State
  const [paymentModalPersonId, setPaymentModalPersonId] = useState<string | null>(null);
  const [selectedPersonForWhatsApp, setSelectedPersonForWhatsApp] = useState<{
    person: Person;
    dueAmount: number;
    paidAmount: number;
    remainingAmount: number;
    dueDate: string;
  } | null>(null);

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

  // Group pending/overdue dues by Person (and Myself) so each person gets ONE summary card
  const attentionGroupMap = new Map<string, PersonAttentionGroup>();

  dues.forEach((d) => {
    if (d.status === 'PAID' || d.status === 'WAIVED' || d.status === 'SKIPPED') return;
    const remaining = calculateDueRemaining(d, allocations);
    if (remaining <= 0) return;

    if (d.due_date <= today || d.status === 'PARTIALLY_PAID' || d.due_month === currentMonth) {
      const groupKey = d.person_id || 'MYSELF';
      const personObj = d.person_id ? people.find((p) => p.id === d.person_id) || null : null;

      if (!attentionGroupMap.has(groupKey)) {
        attentionGroupMap.set(groupKey, {
          groupKey,
          personId: d.person_id || null,
          person: personObj,
          totalPending: 0,
          earliestDueDate: d.due_date,
          duesCount: 0,
          hasOverdue: false,
          dueMonth: d.due_month,
        });
      }

      const grp = attentionGroupMap.get(groupKey)!;
      grp.totalPending += remaining;
      grp.duesCount += 1;
      if (d.due_date < grp.earliestDueDate) {
        grp.earliestDueDate = d.due_date;
        grp.dueMonth = d.due_month;
      }
      if (d.due_date < today) {
        grp.hasOverdue = true;
      }
    }
  });

  const personAttentionList = Array.from(attentionGroupMap.values()).sort((a, b) => {
    if (a.hasOverdue && !b.hasOverdue) return -1;
    if (!a.hasOverdue && b.hasOverdue) return 1;
    return a.earliestDueDate.localeCompare(b.earliestDueDate);
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
            {personAttentionList.length} borrower{personAttentionList.length !== 1 ? 's' : ''} with pending dues
          </span>
        </div>

        {personAttentionList.length === 0 ? (
          <EmptyState
            icon={<CheckCircle className="w-6 h-6 text-emerald-500" />}
            title="All Clear! No Overdue Payments"
            description="Everyone has cleared their pending dues for this cycle."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {personAttentionList.map((grp) => {
              const remInfo = getDaysRemainingInfo(grp.earliestDueDate, false);

              return (
                <Card
                  key={grp.groupKey}
                  className={`flex flex-col justify-between space-y-4 ${
                    grp.hasOverdue ? 'border-rose-200 dark:border-rose-900/60 bg-rose-500/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      {grp.person ? (
                        <Link
                          href={`/people/${grp.person.id}`}
                          className="font-bold text-base text-slate-900 dark:text-white hover:underline"
                        >
                          {grp.person.name}
                        </Link>
                      ) : (
                        <h4 className="font-bold text-base text-slate-900 dark:text-white">Myself</h4>
                      )}
                      <p className="text-xs text-slate-500">
                        {grp.person?.phone ? `+91 ${grp.person.phone}` : 'Personal Loan Expense'}
                      </p>
                    </div>
                    <Badge status={grp.hasOverdue ? 'OVERDUE' : 'PENDING'} />
                  </div>

                  <div className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Earliest Due Date:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {formatDateDisplay(grp.earliestDueDate)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-0.5">
                      <span className="text-slate-500">Scheduled Status:</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] ${remInfo.badgeClass}`}>
                        {remInfo.label} ({grp.duesCount} due{grp.duesCount > 1 ? 's' : ''})
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 dark:border-slate-700 pt-1.5 mt-1">
                      <span className="text-slate-500 font-medium">Total Pending Balance:</span>
                      <span className="font-extrabold text-rose-600 dark:text-rose-400">
                        {formatINR(grp.totalPending)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Button
                      size="sm"
                      variant="success"
                      className="flex-1 text-xs"
                      onClick={() => setPaymentModalPersonId(grp.personId)}
                    >
                      <PlusCircle className="w-3.5 h-3.5 mr-1" />
                      Record Payment
                    </Button>
                    {grp.person && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          title="Send WhatsApp Reminder"
                          onClick={() =>
                            setSelectedPersonForWhatsApp({
                              person: grp.person!,
                              dueAmount: grp.totalPending,
                              paidAmount: 0,
                              remainingAmount: grp.totalPending,
                              dueDate: grp.earliestDueDate,
                            })
                          }
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                        </Button>
                        <Link href={`/people/${grp.person.id}`}>
                          <Button size="sm" variant="outline" className="text-xs" title="View Profile">
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                          </Button>
                        </Link>
                      </>
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
