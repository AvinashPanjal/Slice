'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  let widthClasses = 'max-w-md';
  if (maxWidth === 'sm') widthClasses = 'max-w-sm';
  if (maxWidth === 'lg') widthClasses = 'max-w-lg';
  if (maxWidth === 'xl') widthClasses = 'max-w-xl';
  if (maxWidth === '2xl') widthClasses = 'max-w-2xl';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className={`relative w-full ${widthClasses} max-w-[calc(100vw-1rem)] bg-white dark:bg-[#131b2e] rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-2xl border border-slate-100 dark:border-slate-800 z-10 my-auto mb-16 sm:mb-auto max-h-[82vh] sm:max-h-[90vh] flex flex-col box-border overflow-hidden`}
      >
        <div className="flex items-center justify-between pb-2.5 sm:pb-4 border-b border-slate-100 dark:border-slate-800 mb-3 sm:mb-4 shrink-0">
          <h3 className="text-sm sm:text-lg font-extrabold text-slate-900 dark:text-white pr-2 truncate">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
        <div className="overflow-y-auto pr-0.5 sm:pr-1 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};
