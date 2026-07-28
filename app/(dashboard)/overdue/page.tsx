'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { createClient } from '@/lib/supabase/client';
import { Person, MonthlyDue, PaymentAllocation, ReminderTemplate } from '@/lib/types';
import { calculateDueRemaining } from '@/lib/calculations';
import { formatINR } from '@/lib/utils/currency';
import { formatDateDisplay, getTodayStr } from '@/lib/utils/date';
import { WhatsAppModal } from '@/components/people/WhatsAppModal';
import { AlertCircle, MessageSquare, CheckCircle, ShieldAlert } from 'lucide-react';

interface GroupedOverdue {
  person: Person;
  totalOverdue: number;
  dues: MonthlyDue[];
}

export default function OverduePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  const [people, setPeople] = useState<Person[]>([]);
  const [dues, setDues] = useState<MonthlyDue[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);

  const [selectedOverdueForWhatsApp, setSelectedOverdueForWhatsApp] = useState<GroupedOverdue | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: p },
        { data: d },
        { data: a },
        { data: t },
      ] = await Promise.all([
        supabase.from('people').select('*'),
        supabase.from('monthly_dues').select('*'),
        supabase.from('payment_allocations').select('*'),
        supabase.from('reminder_templates').select('*'),
      ]);

      if (p) setPeople(p);
      if (d) setDues(d);
      if (a) setAllocations(a);
      if (t) setTemplates(t);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const today = getTodayStr();

  // Group overdue dues by person
  const groupedOverdueMap = new Map<string, GroupedOverdue>();

  dues.forEach((due) => {
    if (due.status === 'WAIVED' || due.status === 'SKIPPED') return;
    const remaining = calculateDueRemaining(due, allocations);
    if (due.due_date < today && remaining > 0) {
      const person = people.find((p) => p.id === due.person_id);
      if (!person) return;

      if (!groupedOverdueMap.has(person.id)) {
        groupedOverdueMap.set(person.id, {
          person,
          totalOverdue: 0,
          dues: [],
        });
      }

      const group = groupedOverdueMap.get(person.id)!;
      group.totalOverdue += remaining;
      group.dues.push(due);
    }
  });

  const groupedOverdues = Array.from(groupedOverdueMap.values());
  const grandTotalOverdue = groupedOverdues.reduce((acc, g) => acc + g.totalOverdue, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-10 w-64" />
        <LoadingSkeleton className="h-36 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Overdue Dues Ledger
          </h1>
          <p className="text-xs text-slate-500">All past-due payments grouped by person for quick WhatsApp reminder follow-ups</p>
        </div>

        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center space-x-3 text-rose-600 dark:text-rose-400">
          <ShieldAlert className="w-5 h-5" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider">Total Overdue Portfolio</p>
            <p className="text-lg font-black">{formatINR(grandTotalOverdue)}</p>
          </div>
        </div>
      </div>

      {/* Grouped Overdue Cards */}
      {groupedOverdues.length === 0 ? (
        <EmptyState
          icon={<CheckCircle className="w-6 h-6 text-emerald-500" />}
          title="No Overdue Accounts!"
          description="Great job! All borrowers are currently up to date on their loan repayments."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupedOverdues.map((group) => (
            <Card key={group.person.id} className="border-rose-200 dark:border-rose-900/40 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    {group.person.name}
                  </h3>
                  <p className="text-xs text-slate-500">+91 {group.person.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Total Overdue</p>
                  <p className="font-black text-lg text-rose-600 dark:text-rose-400">
                    {formatINR(group.totalOverdue)}
                  </p>
                </div>
              </div>

              {/* Individual Overdue Dues */}
              <div className="space-y-2">
                {group.dues.map((due) => {
                  const rem = calculateDueRemaining(due, allocations);
                  return (
                    <div
                      key={due.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between text-xs border border-slate-200/60 dark:border-slate-700"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">
                          Due Date: {formatDateDisplay(due.due_date)} ({due.due_month})
                        </p>
                        <p className="text-slate-500 text-[11px]">Original: {formatINR(due.current_amount)}</p>
                      </div>
                      <span className="font-extrabold text-rose-600 dark:text-rose-400">
                        {formatINR(rem)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Combined WhatsApp Reminder Action */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="success"
                  size="sm"
                  className="w-full"
                  onClick={() => setSelectedOverdueForWhatsApp(group)}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send Combined WhatsApp Reminder
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* WhatsApp Modal */}
      {selectedOverdueForWhatsApp && (
        <WhatsAppModal
          isOpen={!!selectedOverdueForWhatsApp}
          onClose={() => setSelectedOverdueForWhatsApp(null)}
          person={selectedOverdueForWhatsApp.person}
          dueAmount={selectedOverdueForWhatsApp.totalOverdue}
          paidAmount={0}
          remainingAmount={selectedOverdueForWhatsApp.totalOverdue}
          templates={templates}
        />
      )}
    </div>
  );
}
