'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { createClient } from '@/lib/supabase/client';
import { LoanSource, Loan, PaymentAllocation, Adjustment } from '@/lib/types';
import { calculateTotalBorrowed, calculateLoanRemaining } from '@/lib/calculations';
import { formatINR } from '@/lib/utils/currency';
import { Building2, Plus, Trash2, CreditCard } from 'lucide-react';

export default function LoanSourcesPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);

  const [sources, setSources] = useState<LoanSource[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);

  // Modal State
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: s },
        { data: l },
        { data: a },
        { data: adj },
      ] = await Promise.all([
        supabase.from('loan_sources').select('*').order('name'),
        supabase.from('loans').select('*'),
        supabase.from('payment_allocations').select('*'),
        supabase.from('adjustments').select('*'),
      ]);

      if (s) setSources(s);
      if (l) setLoans(l);
      if (a) setAllocations(a);
      if (adj) setAdjustments(adj);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error } = await supabase.from('loan_sources').insert({
        user_id: userData.user.id,
        name: name.trim(),
        notes: notes.trim() || null,
      });

      if (error) throw error;
      setName('');
      setNotes('');
      setIsAddSourceOpen(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error creating loan source');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSource = async (id: string, sourceName: string) => {
    if (!confirm(`Are you sure you want to delete loan source "${sourceName}"?`)) return;
    await supabase.from('loan_sources').delete().eq('id', id);
    fetchData();
  };

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
            Loan Sources & Apps
          </h1>
          <p className="text-xs text-slate-500">Manage borrowing platforms (e.g. Slice, Navi, Bank, Custom)</p>
        </div>

        <Button onClick={() => setIsAddSourceOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add Custom Loan Source
        </Button>
      </div>

      {/* Sources Grid */}
      {sources.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-6 h-6 text-slate-400" />}
          title="No Loan Sources Added"
          description="Add loan sources such as Slice, Navi, or banks to track platform borrowing."
          actionLabel="Add Loan Source"
          onAction={() => setIsAddSourceOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map((source) => {
            const sLoans = loans.filter((l) => l.loan_source_id === source.id);
            const totalBorrowed = calculateTotalBorrowed(sLoans);
            const outstanding = sLoans.reduce(
              (acc, l) => acc + calculateLoanRemaining(l, allocations, adjustments),
              0
            );

            return (
              <Card key={source.id} className="flex flex-col justify-between space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                      {source.name}
                    </h3>
                    {source.notes && <p className="text-xs text-slate-500 mt-0.5">{source.notes}</p>}
                  </div>
                  <button
                    onClick={() => handleDeleteSource(source.id, source.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Loans</p>
                    <p className="font-bold text-slate-900 dark:text-white">{sLoans.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Total Borrowed</p>
                    <p className="font-bold text-slate-900 dark:text-white">{formatINR(totalBorrowed)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase">Outstanding</p>
                    <p className="font-extrabold text-amber-600">{formatINR(outstanding)}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isAddSourceOpen}
        onClose={() => setIsAddSourceOpen(false)}
        title="Add Loan Source App"
      >
        <form onSubmit={handleCreateSource} className="space-y-4">
          <Input
            label="Source Name *"
            placeholder="e.g. Slice, Navi, KreditBee"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
              Notes (Optional)
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white"
              rows={2}
              placeholder="Account reference info or notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsAddSourceOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              Create Source
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
