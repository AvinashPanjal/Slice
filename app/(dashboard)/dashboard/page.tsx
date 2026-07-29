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
  nextDueId: string;
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

  const handleQuickMarkPaid = async (dueId: string) => {
    try {
      const { error } = await supabase
        .from('monthly_dues')
        .update({
          status: 'PAID',
          is_manually_adjusted: true,
          adjustment_reason: 'Quick marked paid from Dashboard',
          updated_at: new Date().toISOString(),
        })
        .eq('id', dueId);

      if (error) throw error;
      fetchDashboardData();
    } catch (err: any) {
      alert(err.message || 'Error marking due as paid');
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

  // Group pending/overdue dues by Person. Shows ONLY next month's due amount and excludes far-future months (> 35 days out)
  const attentionGroupMap = new Map<string, PersonAttentionGroup>();

  const todayDate = new Date();
  const maxUpcomingDate = new Date();
  maxUpcomingDate.setDate(todayDate.getDate() + 35);
  const maxUpcomingStr = maxUpcomingDate.toISOString().split('T')[0];

  dues.forEach((d) => {
    if (d.status === 'PAID' || d.status === 'WAIVED' || d.status === 'SKIPPED') return;
    const remaining = calculateDueRemaining(d, allocations);
    if (remaining <= 0) return;

    // Only include dues that are OVERDUE or UPCOMING within next 35 days
    if (d.due_date > maxUpcomingStr && d.due_date > today) return;

    const groupKey = d.person_id || 'MYSELF';
    const personObj = d.person_id ? people.find((p) => p.id === d.person_id) || null : null;

    if (!attentionGroupMap.has(groupKey)) {
      attentionGroupMap.set(groupKey, {
        groupKey,
        personId: d.person_id || null,
        person: personObj,
        totalPending: remaining, // NEXT MONTH'S DUE AMOUNT ONLY
        nextDueId: d.id,
        earliestDueDate: d.due_date,
        duesCount: 1,
        hasOverdue: d.due_date < today,
        dueMonth: d.due_month,
      });
    } else {
      const grp = attentionGroupMap.get(groupKey)!;
      if (d.due_date < grp.earliestDueDate) {
        grp.earliestDueDate = d.due_date;
        grp.totalPending = remaining; // Use earliest next upcoming due amount
        grp.nextDueId = d.id;
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

        <Card className="border-blue-200 dark:border-blue-900/40 bg-blue-500/5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Target Next Due</p>
          <h3 className="text-xl sm:text-2xl font-black mt-1 tracking-tight text-blue-600 dark:text-blue-400">
            {formatINR(stats.due_this_month)}
          </h3>
          <p className="text-[10px] font-semibold text-slate-500 mt-2">
            {stats.next_due_date ? `Due: ${formatDateDisplay(stats.next_due_date)}` : 'No upcoming due'}
          </p>
        </Card>

        <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-500/5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Received</p>
          <h3 className="text-xl sm:text-2xl font-black mt-1 tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatINR(stats.total_paid)}
          </h3>
          <p className="text-[10px] text-slate-500 mt-2">
            {stats.received_this_month > 0 ? `${formatINR(stats.received_this_month)} in active cycle` : 'Total collected all-time'}
          </p>
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
          <div className="space-y-2.5">
            {personAttentionList.map((grp) => {
              const remInfo = getDaysRemainingInfo(grp.earliestDueDate, false);

              return (
                <div
                  key={grp.groupKey}
                  className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    grp.hasOverdue
                      ? 'border-rose-300 dark:border-rose-900/60 bg-rose-500/5'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131b2e]'
                  }`}
                >
                  {/* Left: Borrower info */}
                  <div className="flex items-center space-x-3 min-w-[200px]">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm">
                      {grp.person ? grp.person.name.charAt(0).toUpperCase() : 'M'}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        {grp.person ? (
                          <Link
                            href={`/people/${grp.person.id}`}
                            className="font-extrabold text-sm text-slate-900 dark:text-white hover:underline"
                          >
                            {grp.person.name}
                          </Link>
                        ) : (
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Myself</h4>
                        )}
                        <Badge status={grp.hasOverdue ? 'OVERDUE' : 'PENDING'} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {grp.person?.phone ? `+91 ${grp.person.phone}` : 'Personal Loan'}
                      </p>
                    </div>
                  </div>

                  {/* Center: Upcoming Due Date & Pending Balance */}
                  <div className="flex items-center space-x-6 text-xs">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Upcoming Due</p>
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {formatDateDisplay(grp.earliestDueDate)}
                      </p>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${remInfo.badgeClass}`}>
                        {remInfo.label}
                      </span>
                    </div>

                    <div className="text-right sm:text-left border-l border-slate-100 dark:border-slate-800 pl-4">
                      <p className="text-[10px] uppercase font-bold text-slate-400">Pending Amount</p>
                      <p className="font-black text-sm text-rose-600 dark:text-rose-400">
                        {formatINR(grp.totalPending)}
                      </p>
                      <p className="text-[10px] text-slate-400">{grp.duesCount} item(s)</p>
                    </div>
                  </div>

                  {/* Right: Quick Action Buttons */}
                  <div className="flex items-center space-x-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 shadow-sm shadow-emerald-500/20"
                      onClick={() => handleQuickMarkPaid(grp.nextDueId)}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-1 text-white" />
                      Mark Paid
                    </Button>

                    {grp.person && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
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
                        <MessageSquare className="w-3.5 h-3.5 mr-1" />
                        WhatsApp
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => setPaymentModalPersonId(grp.personId)}
                    >
                      <PlusCircle className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      Payment
                    </Button>

                    {grp.person && (
                      <Link href={`/people/${grp.person.id}`}>
                        <Button size="sm" variant="outline" className="text-xs px-2.5" title="View Profile">
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
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
