import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full max-w-full space-y-1 box-border">
        {label && (
          <label htmlFor={inputId} className="block text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 truncate max-w-full" title={label}>
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          step={props.type === 'number' && props.step === undefined ? 'any' : props.step}
          className={`w-full max-w-full rounded-xl border px-3 py-2 sm:px-3.5 sm:py-2.5 text-xs sm:text-sm box-border transition-colors focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:focus:ring-slate-400 dark:bg-[#131b2e] dark:text-white ${
            error
              ? 'border-rose-500 focus:ring-rose-500'
              : 'border-slate-200 dark:border-slate-800'
          } ${className}`}
          {...props}
        />
        {error ? (
          <p className="text-xs font-medium text-rose-500">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
