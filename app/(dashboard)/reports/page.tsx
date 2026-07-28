'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { createClient } from '@/lib/supabase/client';
import { Loan, Person, LoanSource, PaymentAllocation, Adjustment, MonthlyDue } from '@/lib/types';
import { calculateTotalBorrowed, calculateLoanRemaining } from '@/lib/calculations';
import { formatINR } from '@/lib/utils/currency';
import { BarChart3, Building2, Users } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function ReportsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  const [people, setPeople] = useState<Person[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [sources, setSources] = useState<LoanSource[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);

  const fetchReportsData = async () => {
    setLoading(true);
    try {
      const [
        { data: p },
        { data: l },
        { data: s },
        { data: a },
        { data: adj },
      ] = await Promise.all([
        supabase.from('people').select('*'),
        supabase.from('loans').select('*'),
        supabase.from('loan_sources').select('*'),
        supabase.from('payment_allocations').select('*'),
        supabase.from('adjustments').select('*'),
      ]);

      if (p) setPeople(p);
      if (l) setLoans(l);
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
    fetchReportsData();
  }, []);

  // Compute breakdown by person
  const personReportData = people.map((person) => {
    const pLoans = loans.filter((l) => l.person_id === person.id);
    const borrowed = calculateTotalBorrowed(pLoans);
    const pAllocations = allocations.filter((a) => pLoans.some((l) => l.id === a.loan_id));
    const paid = pAllocations.reduce((acc, a) => acc + Number(a.amount), 0);
    const outstanding = Math.max(borrowed - paid, 0);

    return {
      name: person.name,
      borrowed,
      paid,
      outstanding,
    };
  });

  // Compute breakdown by loan source
  const sourceReportData = sources.map((source) => {
    const sLoans = loans.filter((l) => l.loan_source_id === source.id);
    const borrowed = calculateTotalBorrowed(sLoans);
    const sAllocations = allocations.filter((a) => sLoans.some((l) => l.id === a.loan_id));
    const paid = sAllocations.reduce((acc, a) => acc + Number(a.amount), 0);
    const outstanding = Math.max(borrowed - paid, 0);

    return {
      name: source.name,
      borrowed,
      paid,
      outstanding,
    };
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-10 w-64" />
        <LoadingSkeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          Financial Portfolio Reports
        </h1>
        <p className="text-xs text-slate-500">Comprehensive breakdown by borrower and lending source platform</p>
      </div>

      {/* Person Breakdown Report */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-blue-500" />
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            Borrower Breakdown Report
          </h2>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={personReportData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip formatter={(val: any) => formatINR(Number(val))} />
              <Bar dataKey="borrowed" fill="#3b82f6" name="Total Borrowed" radius={[4, 4, 0, 0]} />
              <Bar dataKey="outstanding" fill="#f59e0b" name="Outstanding" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Loan Source Breakdown Report */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center space-x-2">
          <Building2 className="w-5 h-5 text-indigo-500" />
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            Loan Source Platform Breakdown
          </h2>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sourceReportData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip formatter={(val: any) => formatINR(Number(val))} />
              <Bar dataKey="borrowed" fill="#6366f1" name="Borrowed from App" radius={[4, 4, 0, 0]} />
              <Bar dataKey="outstanding" fill="#e11d48" name="Current Outstanding" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
