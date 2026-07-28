import React from 'react';

export const LoadingSkeleton: React.FC<{ className?: string }> = ({ className = 'h-6 w-full' }) => {
  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-xl ${className}`}
    />
  );
};
