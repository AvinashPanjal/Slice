'use client';

import React, { useState } from 'react';
import { ActivityLog } from '@/lib/types';
import { formatDateDisplay } from '@/lib/utils/date';
import { History, Receipt, Calendar, CreditCard, Sliders, CheckCircle2 } from 'lucide-react';

interface ActivityTimelineProps {
  logs: ActivityLog[];
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ logs }) => {
  const [filter, setFilter] = useState<'ALL' | 'PAYMENT' | 'MONTHLY_DUE' | 'LOAN' | 'ADJUSTMENT'>('ALL');

  const filteredLogs = logs.filter((log) => {
    if (filter === 'ALL') return true;
    return log.entity_type === filter;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'PAYMENT':
        return <Receipt className="w-4 h-4 text-emerald-500" />;
      case 'MONTHLY_DUE':
        return <Calendar className="w-4 h-4 text-amber-500" />;
      case 'LOAN':
        return <CreditCard className="w-4 h-4 text-blue-500" />;
      case 'ADJUSTMENT':
        return <Sliders className="w-4 h-4 text-purple-500" />;
      default:
        return <History className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Chips */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
        {(['ALL', 'PAYMENT', 'MONTHLY_DUE', 'LOAN', 'ADJUSTMENT'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              filter === cat
                ? 'bg-[#0b1c30] text-white dark:bg-slate-700'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {cat === 'ALL' ? 'All Activity' : cat.replace('_', ' ')}
          </button>
        ))}
      </div>

      {filteredLogs.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">No activity history recorded yet.</p>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
          {filteredLogs.map((log) => (
            <div key={log.id} className="relative flex items-start space-x-3">
              <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-white dark:bg-[#131b2e] border-2 border-slate-300 dark:border-slate-700 flex items-center justify-center">
                {getIcon(log.entity_type)}
              </div>
              <div className="flex-1 bg-white dark:bg-[#131b2e] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-sm text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    {log.action.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {formatDateDisplay(log.created_at.split('T')[0])}
                  </span>
                </div>
                {log.reason && (
                  <p className="text-slate-600 dark:text-slate-300 mt-1 font-medium">{log.reason}</p>
                )}
                {log.old_values && log.new_values && (
                  <div className="mt-1.5 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-[11px] font-mono text-slate-500 flex items-center space-x-2">
                    <span>{JSON.stringify(log.old_values)}</span>
                    <span>→</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{JSON.stringify(log.new_values)}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
