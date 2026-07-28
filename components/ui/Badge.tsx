import React from 'react';
import { DueStatus } from '@/lib/types';

interface BadgeProps {
  status: DueStatus | 'NO_DUE' | 'ACTIVE' | 'PAUSED' | 'CLOSED' | 'ARCHIVED' | string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, className = '' }) => {
  let bgClasses = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  let label = status.replace('_', ' ');

  switch (status) {
    case 'PAID':
    case 'CLOSED':
      bgClasses = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
      break;
    case 'PARTIALLY_PAID':
      bgClasses = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20';
      break;
    case 'PENDING':
    case 'UPCOMING':
    case 'ACTIVE':
      bgClasses = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20';
      break;
    case 'OVERDUE':
      bgClasses = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse';
      break;
    case 'WAIVED':
    case 'SKIPPED':
    case 'PAUSED':
    case 'ARCHIVED':
      bgClasses = 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20';
      break;
    case 'NO_DUE':
      bgClasses = 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400';
      label = 'No Due';
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${bgClasses} ${className}`}
    >
      {label}
    </span>
  );
};
