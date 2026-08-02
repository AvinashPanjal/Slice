import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`bg-white dark:bg-[#070708] border border-slate-200/80 dark:border-[#1f1f23] rounded-3xl p-5 sm:p-6 shadow-sm dark:shadow-none transition-colors duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
