'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { Payment, MonthlyDue, PaymentAllocation, Person, Loan } from '@/lib/types';
import { formatINR } from '@/lib/utils/currency';
import { formatDateDisplay, formatMonthDisplay, getCurrentMonthStr } from '@/lib/utils/date';
import { calculateDuePaid, calculateDueRemaining } from '@/lib/calculations';
import { PaymentFormModal } from '@/components/payments/PaymentFormModal';
import { Receipt, Plus, Calendar as CalendarIcon, Filter, Trash2, Eye } from 'lucide-react';

export default function PaymentsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [dues, setDues] = useState<MonthlyDue[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'PARTIALLY_PAID' | 'OVERDUE'>('ALL');

  // Modals
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<Payment | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: d },
        { data: p },
        { data: a },
        { data: pe },
        { data: l },
      ] = await Promise.all([
        supabase.from('monthly_dues').select('*, person:people(*), loan:loans(*)').eq('due_month', selectedMonth),
        supabase.from('payments').select('*, person:people(*), loan:loans(*)').order('payment_date', { ascending: false }),
        supabase.from('payment_allocations').select('*'),
        supabase.from('people').select('*'),
        supabase.from('loans').select('*'),
      ]);

      if (d) setDues(d);
      if (p) setPayments(p);
      if (a) setAllocations(a);
      if (pe) setPeople(pe);
      if (l) setLoans(l);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth]);

  // Compute month summary statistics
  const expectedMonth = dues.reduce((acc, d) => acc + Number(d.current_amount), 0);
  const receivedMonth = dues.reduce((acc, d) => acc + calculateDuePaid(d, allocations), 0);
  const pendingMonth = Math.max(expectedMonth - receivedMonth, 0);

  const filteredDues = dues.filter((d) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PAID') return d.status === 'PAID';
    if (statusFilter === 'PENDING') return d.status === 'PENDING';
    if (statusFilter === 'PARTIALLY_PAID') return d.status === 'PARTIALLY_PAID';
    if (statusFilter === 'OVERDUE') return d.status === 'OVERDUE';
    return true;
  });

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete/void this payment? Financial totals will be recalculated.')) {
      return;
    }
    await supabase.from('payments').delete().eq('id', paymentId);
    fetchData();
    setSelectedPaymentDetail(null);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-10 w-64" />
        <LoadingSkeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Monthly Payments & Dues
          </h1>
          <p className="text-xs text-slate-500">Track expected dues, received payments, and allocations for {formatMonthDisplay(selectedMonth)}</p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="month"
            className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold focus:outline-none dark:bg-[#131b2e] dark:text-white"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <Button onClick={() => setIsRecordPaymentOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Month Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#0b1c30] text-white dark:bg-slate-800">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Expected for {formatMonthDisplay(selectedMonth)}</p>
          <h3 className="text-2xl font-black mt-1 tracking-tight">{formatINR(expectedMonth)}</h3>
        </Card>

        <Card className="border-emerald-200 dark:border-emerald-900/40 bg-emerald-500/5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Total Received</p>
          <h3 className="text-2xl font-black mt-1 tracking-tight text-emerald-600 dark:text-emerald-400">{formatINR(receivedMonth)}</h3>
        </Card>

        <Card className="border-amber-200 dark:border-amber-900/40 bg-amber-500/5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Total Pending</p>
          <h3 className="text-2xl font-black mt-1 tracking-tight text-amber-600 dark:text-amber-400">{formatINR(pendingMonth)}</h3>
        </Card>
      </div>

      {/* Dues Filter Bar */}
      <Card className="p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 overflow-x-auto">
          <Filter className="w-4 h-4 text-slate-400 mr-1" />
          {(['ALL', 'PAID', 'PENDING', 'PARTIALLY_PAID', 'OVERDUE'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === st
                  ? 'bg-[#0b1c30] text-white dark:bg-slate-700'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
              }`}
            >
              {st === 'ALL' ? 'All Dues' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </Card>

      {/* Monthly Dues List */}
      {filteredDues.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-6 h-6 text-slate-400" />}
          title="No Monthly Dues Found"
          description={`No monthly dues recorded for ${formatMonthDisplay(selectedMonth)}.`}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDues.map((due) => {
            const paid = calculateDuePaid(due, allocations);
            const remaining = calculateDueRemaining(due, allocations);

            return (
              <Card key={due.id} className="flex flex-col justify-between space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                      {due.person ? due.person.name : 'Myself'}
                    </h4>
                    <p className="text-xs text-slate-500">Due Date: {formatDateDisplay(due.due_date)}</p>
                  </div>
                  <Badge status={due.status} />
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Target Amount:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{formatINR(due.current_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Paid:</span>
                    <span className="font-bold text-emerald-600">{formatINR(paid)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1">
                    <span className="text-slate-500">Remaining:</span>
                    <span className="font-extrabold text-amber-600">{formatINR(remaining)}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Recent Recorded Payments Log */}
      <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Recent Payment Transactions</h2>

        <div className="bg-white dark:bg-[#131b2e] rounded-3xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {payments.slice(0, 10).map((pay) => (
            <div key={pay.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  ₹
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">
                    {pay.person ? pay.person.name : 'Myself'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDateDisplay(pay.payment_date)} • {pay.payment_method}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className="font-extrabold text-base text-emerald-600 dark:text-emerald-400">
                  +{formatINR(pay.amount)}
                </span>
                <button
                  onClick={() => setSelectedPaymentDetail(pay)}
                  title="View Payment Detail"
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeletePayment(pay.id)}
                  title="Delete / Void Payment"
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Detail Modal */}
      {selectedPaymentDetail && (
        <Modal
          isOpen={!!selectedPaymentDetail}
          onClose={() => setSelectedPaymentDetail(null)}
          title="Payment Record Detail"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Borrower:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedPaymentDetail.person ? selectedPaymentDetail.person.name : 'Myself'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-extrabold text-emerald-600 text-sm">{formatINR(selectedPaymentDetail.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Date:</span>
                <span className="font-bold">{formatDateDisplay(selectedPaymentDetail.payment_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Method:</span>
                <span className="font-bold">{selectedPaymentDetail.payment_method}</span>
              </div>
              {selectedPaymentDetail.notes && (
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
                  <span className="text-slate-500">Notes:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{selectedPaymentDetail.notes}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDeletePayment(selectedPaymentDetail.id)}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Void / Delete Payment
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Record Payment Modal */}
      <PaymentFormModal
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        people={people}
        loans={loans}
        dues={dues}
        allocations={allocations}
        onSuccess={fetchData}
      />
    </div>
  );
}
