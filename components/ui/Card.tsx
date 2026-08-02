import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-white/60 dark:bg-[#0b101d]/65 backdrop-blur-2xl backdrop-saturate-150 border border-slate-200/60 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.04)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] hover:border-indigo-500/30 dark:hover:border-white/20 transition-all duration-300 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
