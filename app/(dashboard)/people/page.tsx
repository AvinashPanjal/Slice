'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { createClient } from '@/lib/supabase/client';
import { Person, Loan, MonthlyDue, PaymentAllocation, Adjustment, PersonFinancialSummary, ReminderTemplate, LoanSource } from '@/lib/types';
import { aggregatePersonSummary } from '@/lib/calculations';
import { formatINR } from '@/lib/utils/currency';
import { getCurrentMonthStr, getTodayStr } from '@/lib/utils/date';
import { PersonFormModal } from '@/components/people/PersonFormModal';
import { WhatsAppModal } from '@/components/people/WhatsAppModal';
import { LoanFormModal } from '@/components/loans/LoanFormModal';
import { PaymentFormModal } from '@/components/payments/PaymentFormModal';
import {
  Users,
  Search,
  Plus,
  MessageSquare,
  Eye,
  Edit,
  CreditCard,
  Receipt,
  Trash2,
  Filter,
} from 'lucide-react';

export default function PeoplePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  const [people, setPeople] = useState<Person[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [dues, setDues] = useState<MonthlyDue[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);
  const [sources, setSources] = useState<LoanSource[]>([]);

  // Search, Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'HAS_DUE' | 'PAID' | 'PENDING' | 'OVERDUE'>('ALL');
  const [sortBy, setSortBy] = useState<'NAME' | 'HIGHEST_OUTSTANDING' | 'HIGHEST_CURRENT_DUE'>('NAME');

  // Modal State
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [isPersonModalOpen, setIsPersonModalOpen] = useState(false);
  const [whatsAppPerson, setWhatsAppPerson] = useState<PersonFinancialSummary | null>(null);
  const [addLoanPersonId, setAddLoanPersonId] = useState<string | null>(null);
  const [addPaymentPersonId, setAddPaymentPersonId] = useState<string | null>(null);

  const fetchPeopleData = async () => {
    setLoading(true);
    try {
      const [
        { data: p },
        { data: l },
        { data: d },
        { data: a },
        { data: adj },
        { data: t },
        { data: s },
      ] = await Promise.all([
        supabase.from('people').select('*').eq('is_archived', false).order('name'),
        supabase.from('loans').select('*'),
        supabase.from('monthly_dues').select('*'),
        supabase.from('payment_allocations').select('*'),
        supabase.from('adjustments').select('*'),
        supabase.from('reminder_templates').select('*'),
        supabase.from('loan_sources').select('*').order('name'),
      ]);

      if (p) setPeople(p);
      if (l) setLoans(l);
      if (d) setDues(d);
      if (a) setAllocations(a);
      if (adj) setAdjustments(adj);
      if (t) setTemplates(t);
      if (s) setSources(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeopleData();
  }, []);

  const currentMonth = getCurrentMonthStr();
  const today = getTodayStr();

  // Compute summary list for all people
  const summaries: PersonFinancialSummary[] = people.map((p) =>
    aggregatePersonSummary(p, loans, dues, allocations, adjustments, currentMonth, today)
  );

  // Filter & Search Logic
  const filteredSummaries = summaries
    .filter((s) => {
      const matchesSearch =
        s.person.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.person.phone.includes(searchQuery);

      if (!matchesSearch) return false;

      if (statusFilter === 'HAS_DUE') return s.current_month_due > 0 || s.outstanding > 0;
      if (statusFilter === 'PAID') return s.status === 'PAID';
      if (statusFilter === 'PENDING') return s.status === 'PENDING' || s.status === 'PARTIALLY_PAID';
      if (statusFilter === 'OVERDUE') return s.status === 'OVERDUE';

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'HIGHEST_OUTSTANDING') return b.outstanding - a.outstanding;
      if (sortBy === 'HIGHEST_CURRENT_DUE') return b.current_month_due - a.current_month_due;
      return a.person.name.localeCompare(b.person.name);
    });

  const handleDeletePerson = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to delete ${name}? WARNING: This action will also remove associated financial history records!`
      )
    ) {
      return;
    }
    await supabase.from('people').delete().eq('id', id);
    fetchPeopleData();
  };

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
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">People Ledger</h1>
          <p className="text-xs text-slate-500">Manage individual borrowers, loan breakdown, and payment status</p>
        </div>
        <Button
          onClick={() => {
            setEditingPerson(null);
            setIsPersonModalOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add New Person
        </Button>
      </div>

      {/* Search & Filter Controls */}
      <Card className="p-4 space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or phone number..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto">
          <select
            className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold focus:outline-none dark:bg-[#131b2e] dark:text-white"
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All People</option>
            <option value="HAS_DUE">Has Pending Due</option>
            <option value="PAID">Paid</option>
            <option value="PENDING">Pending</option>
            <option value="OVERDUE">Overdue</option>
          </select>

          <select
            className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold focus:outline-none dark:bg-[#131b2e] dark:text-white"
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
          >
            <option value="NAME">Sort by Name</option>
            <option value="HIGHEST_OUTSTANDING">Highest Outstanding</option>
            <option value="HIGHEST_CURRENT_DUE">Highest Current Due</option>
          </select>
        </div>
      </Card>

      {/* People Grid */}
      {filteredSummaries.length === 0 ? (
        <EmptyState
          icon={<Users className="w-6 h-6 text-slate-400" />}
          title="No People Found"
          description="Start tracking payments by adding your first borrower profile."
          actionLabel="Add Person"
          onAction={() => {
            setEditingPerson(null);
            setIsPersonModalOpen(true);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSummaries.map((s) => (
            <Card key={s.person.id} className="flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <Link href={`/people/${s.person.id}`} className="font-extrabold text-base text-slate-900 dark:text-white hover:underline">
                    {s.person.name}
                  </Link>
                  <p className="text-xs text-slate-500">+91 {s.person.phone}</p>
                </div>
                <Badge status={s.status} />
              </div>

              {/* Stats Summary */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-xs">
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Total Borrowed</p>
                  <p className="font-bold text-slate-900 dark:text-white">{formatINR(s.total_borrowed)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Total Paid</p>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatINR(s.total_paid)}</p>
                </div>
                <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Outstanding</p>
                  <p className="font-extrabold text-amber-600 dark:text-amber-400">{formatINR(s.outstanding)}</p>
                </div>
                <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-slate-400 text-[10px] uppercase font-bold">Active Loans</p>
                  <p className="font-bold text-slate-900 dark:text-white">{s.active_loans_count} Loans</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Link href={`/people/${s.person.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full text-xs">
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    View
                  </Button>
                </Link>

                <Button
                  variant="outline"
                  size="sm"
                  title="Add Loan"
                  onClick={() => setAddLoanPersonId(s.person.id)}
                >
                  <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  title="Add Payment"
                  onClick={() => setAddPaymentPersonId(s.person.id)}
                >
                  <Receipt className="w-3.5 h-3.5 text-emerald-500" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  title="WhatsApp Reminder"
                  onClick={() => setWhatsAppPerson(s)}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  title="Delete Person"
                  onClick={() => handleDeletePerson(s.person.id, s.person.name)}
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Person Form Modal */}
      <PersonFormModal
        isOpen={isPersonModalOpen}
        onClose={() => setIsPersonModalOpen(false)}
        person={editingPerson}
        onSuccess={fetchPeopleData}
      />

      {/* WhatsApp Modal */}
      {whatsAppPerson && (
        <WhatsAppModal
          isOpen={!!whatsAppPerson}
          onClose={() => setWhatsAppPerson(null)}
          person={whatsAppPerson.person}
          dueAmount={whatsAppPerson.current_month_due}
          paidAmount={whatsAppPerson.current_month_paid}
          remainingAmount={whatsAppPerson.current_month_pending}
          templates={templates}
        />
      )}

      {/* Add Loan Modal */}
      {addLoanPersonId && (
        <LoanFormModal
          isOpen={!!addLoanPersonId}
          onClose={() => setAddLoanPersonId(null)}
          defaultPersonId={addLoanPersonId}
          people={people}
          sources={sources}
          onSuccess={fetchPeopleData}
        />
      )}

      {/* Add Payment Modal */}
      {addPaymentPersonId && (
        <PaymentFormModal
          isOpen={!!addPaymentPersonId}
          onClose={() => setAddPaymentPersonId(null)}
          defaultPersonId={addPaymentPersonId}
          people={people}
          loans={loans}
          dues={dues}
          allocations={allocations}
          onSuccess={fetchPeopleData}
        />
      )}
    </div>
  );
}
