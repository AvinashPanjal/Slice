'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { PersonFormModal } from '@/components/people/PersonFormModal';
import { LoanFormModal } from '@/components/loans/LoanFormModal';
import { PaymentFormModal } from '@/components/payments/PaymentFormModal';
import { AdjustmentFormModal } from '@/components/adjustments/AdjustmentFormModal';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Person, LoanSource, Loan, MonthlyDue, PaymentAllocation } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { UserPlus, CreditCard, Receipt, Sliders } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<'PERSON' | 'LOAN' | 'PAYMENT' | 'ADJUSTMENT' | null>(null);

  const [people, setPeople] = useState<Person[]>([]);
  const [sources, setSources] = useState<LoanSource[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [dues, setDues] = useState<MonthlyDue[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);

  const fetchGlobalData = async () => {
    const { data: p } = await supabase.from('people').select('*').order('name');
    if (p) setPeople(p);
    const { data: s } = await supabase.from('loan_sources').select('*').order('name');
    if (s) setSources(s);
    const { data: l } = await supabase.from('loans').select('*');
    if (l) setLoans(l);
    const { data: d } = await supabase.from('monthly_dues').select('*');
    if (d) setDues(d);
    const { data: a } = await supabase.from('payment_allocations').select('*');
    if (a) setAllocations(a);
  };

  useEffect(() => {
    fetchGlobalData();
  }, []);

  const handleOpenModal = (type: 'PERSON' | 'LOAN' | 'PAYMENT' | 'ADJUSTMENT') => {
    setIsQuickAddOpen(false);
    setActiveModal(type);
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9ff] dark:bg-[#0b1c30]">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        <Header
          title="LendWise"
          onOpenQuickAdd={() => setIsQuickAddOpen(true)}
        />
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Quick Add Menu Dialog */}
      <Modal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        title="Quick Financial Actions"
        maxWidth="sm"
      >
        <div className="grid grid-cols-1 gap-3">
          <Button
            variant="outline"
            className="justify-start text-left py-3 px-4 rounded-2xl border-slate-200 dark:border-slate-800"
            onClick={() => handleOpenModal('PERSON')}
          >
            <UserPlus className="w-5 h-5 text-blue-500 mr-3" />
            <div>
              <p className="font-bold text-sm text-slate-900 dark:text-white">Add Person</p>
              <p className="text-xs text-slate-500">Create new friend borrower profile</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start text-left py-3 px-4 rounded-2xl border-slate-200 dark:border-slate-800"
            onClick={() => handleOpenModal('LOAN')}
          >
            <CreditCard className="w-5 h-5 text-indigo-500 mr-3" />
            <div>
              <p className="font-bold text-sm text-slate-900 dark:text-white">Add Loan</p>
              <p className="text-xs text-slate-500">Record loan for friend or myself</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start text-left py-3 px-4 rounded-2xl border-slate-200 dark:border-slate-800"
            onClick={() => handleOpenModal('PAYMENT')}
          >
            <Receipt className="w-5 h-5 text-emerald-500 mr-3" />
            <div>
              <p className="font-bold text-sm text-slate-900 dark:text-white">Record Payment</p>
              <p className="text-xs text-slate-500">Log incoming payment & allocate</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start text-left py-3 px-4 rounded-2xl border-slate-200 dark:border-slate-800"
            onClick={() => handleOpenModal('ADJUSTMENT')}
          >
            <Sliders className="w-5 h-5 text-purple-500 mr-3" />
            <div>
              <p className="font-bold text-sm text-slate-900 dark:text-white">Add Adjustment</p>
              <p className="text-xs text-slate-500">Manual balance correction or waiver</p>
            </div>
          </Button>
        </div>
      </Modal>

      {/* Action Modals */}
      <PersonFormModal
        isOpen={activeModal === 'PERSON'}
        onClose={() => setActiveModal(null)}
        onSuccess={fetchGlobalData}
      />

      <LoanFormModal
        isOpen={activeModal === 'LOAN'}
        onClose={() => setActiveModal(null)}
        people={people}
        sources={sources}
        onSuccess={fetchGlobalData}
      />

      <PaymentFormModal
        isOpen={activeModal === 'PAYMENT'}
        onClose={() => setActiveModal(null)}
        people={people}
        loans={loans}
        dues={dues}
        allocations={allocations}
        onSuccess={fetchGlobalData}
      />

      <AdjustmentFormModal
        isOpen={activeModal === 'ADJUSTMENT'}
        onClose={() => setActiveModal(null)}
        people={people}
        loans={loans}
        onSuccess={fetchGlobalData}
      />
    </div>
  );
}
