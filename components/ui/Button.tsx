import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}) => {
  let baseClasses =
    'inline-flex items-center justify-center font-semibold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';

  let variantClasses = 'bg-[#0b1c30] text-white hover:bg-[#13253d] focus:ring-[#0b1c30] dark:bg-slate-700 dark:hover:bg-slate-600';

  if (variant === 'secondary') {
    variantClasses = 'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700';
  } else if (variant === 'outline') {
    variantClasses = 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800';
  } else if (variant === 'ghost') {
    variantClasses = 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800';
  } else if (variant === 'danger') {
    variantClasses = 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500';
  } else if (variant === 'success') {
    variantClasses = 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500';
  }

  let sizeClasses = 'px-4 py-2 text-sm';
  if (size === 'sm') sizeClasses = 'px-3 py-1.5 text-xs rounded-lg';
  if (size === 'lg') sizeClasses = 'px-6 py-3 text-base rounded-2xl';

  return (
    <button
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center space-x-2">
          <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Processing...</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
};
