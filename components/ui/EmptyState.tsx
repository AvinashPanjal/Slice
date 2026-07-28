import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-[#131b2e] rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 my-4">
      {icon && (
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 mb-4">
          {icon}
        </div>
      )}
      <h4 className="text-base font-bold text-slate-900 dark:text-white">{title}</h4>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-5" size="sm">
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
