'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { MonthlyDue, PaymentAllocation, Person } from '@/lib/types';
import { formatINR } from '@/lib/utils/currency';
import { formatDateDisplay, getCurrentMonthStr, formatMonthDisplay, getTodayStr } from '@/lib/utils/date';
import { calculateDueRemaining, calculateDuePaid } from '@/lib/calculations';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

export default function CalendarPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  const [currentYearMonth, setCurrentYearMonth] = useState<string>(getCurrentMonthStr());
  const [dues, setDues] = useState<MonthlyDue[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [people, setPeople] = useState<Person[]>([]);

  const [selectedDue, setSelectedDue] = useState<MonthlyDue | null>(null);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const [
        { data: d },
        { data: a },
        { data: p },
      ] = await Promise.all([
        supabase.from('monthly_dues').select('*, person:people(*)').eq('due_month', currentYearMonth),
        supabase.from('payment_allocations').select('*'),
        supabase.from('people').select('*'),
      ]);

      if (d) setDues(d);
      if (a) setAllocations(a);
      if (p) setPeople(p);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendarData();
  }, [currentYearMonth]);

  const today = getTodayStr();

  // Days in month calculation for grid
  const [year, month] = currentYearMonth.split('-').map((v) => parseInt(v, 10));
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay(); // 0 = Sun

  const changeMonth = (delta: number) => {
    const date = new Date(year, month - 1 + delta, 1);
    const newY = date.getFullYear();
    const newM = String(date.getMonth() + 1).padStart(2, '0');
    setCurrentYearMonth(`${newY}-${newM}`);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-10 w-64" />
        <LoadingSkeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calendar Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Due Dates Calendar
          </h1>
          <p className="text-xs text-slate-500">Visual monthly schedule of expected payments and due dates</p>
        </div>

        <div className="flex items-center space-x-3 bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-sm">
          <button
            onClick={() => changeMonth(-1)}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-extrabold px-2 min-w-28 text-center text-slate-900 dark:text-white">
            {formatMonthDisplay(currentYearMonth)}
          </span>
          <button
            onClick={() => changeMonth(1)}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="p-4 sm:p-6 overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty slots before day 1 */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-28 bg-slate-50/50 dark:bg-slate-800/20 rounded-2xl" />
            ))}

            {/* Calendar Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${currentYearMonth}-${String(dayNum).padStart(2, '0')}`;
              const dayDues = dues.filter((d) => d.due_date === dateStr);
              const isToday = dateStr === today;

              return (
                <div
                  key={dayNum}
                  className={`h-28 p-2 rounded-2xl border transition-all flex flex-col justify-between ${
                    isToday
                      ? 'border-[#0b1c30] dark:border-white bg-blue-50/20 dark:bg-slate-800/60'
                      : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131b2e]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday ? 'bg-[#0b1c30] text-white dark:bg-white dark:text-slate-900' : 'text-slate-500'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {dayDues.length > 0 && (
                      <span className="text-[10px] font-extrabold text-slate-400">
                        {dayDues.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-16">
                    {dayDues.map((d) => {
                      const rem = calculateDueRemaining(d, allocations);
                      const isOverdue = d.due_date < today && rem > 0;

                      return (
                        <button
                          key={d.id}
                          onClick={() => setSelectedDue(d)}
                          className={`w-full text-left p-1.5 rounded-lg text-[10px] font-semibold truncate flex items-center justify-between border ${
                            isOverdue
                              ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                              : d.status === 'PAID'
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
                          }`}
                        >
                          <span className="truncate">{d.person ? d.person.name : 'Myself'}</span>
                          <span className="font-bold ml-1">{formatINR(d.current_amount)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Due Detail Dialog */}
      {selectedDue && (
        <Modal
          isOpen={!!selectedDue}
          onClose={() => setSelectedDue(null)}
          title="Due Details"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Borrower:</span>
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {selectedDue.person ? selectedDue.person.name : 'Myself'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Due Date:</span>
                <span className="font-bold">{formatDateDisplay(selectedDue.due_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target Amount:</span>
                <span className="font-bold">{formatINR(selectedDue.current_amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Paid Amount:</span>
                <span className="font-bold text-emerald-600">{formatINR(calculateDuePaid(selectedDue, allocations))}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                <span className="text-slate-500">Status:</span>
                <Badge status={selectedDue.status} />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
