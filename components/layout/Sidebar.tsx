'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  AlertCircle,
  Calendar as CalendarIcon,
  BarChart3,
  Building2,
  Settings,
  Wallet,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'People', href: '/people', icon: Users },
  { label: 'Loans', href: '/loans', icon: CreditCard },
  { label: 'Payments', href: '/payments', icon: Receipt },
  { label: 'Overdue', href: '/overdue', icon: AlertCircle },
  { label: 'Calendar', href: '/calendar', icon: CalendarIcon },
  { label: 'Reports', href: '/reports', icon: BarChart3 },
  { label: 'Loan Sources', href: '/loan-sources', icon: Building2 },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-[#000000] border-r border-slate-200/80 dark:border-[#1f1f23] min-h-screen p-5 sticky top-0 h-screen overflow-y-auto">
      {/* Brand Header */}
      <div className="flex items-center space-x-3 px-2 py-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-[#0b1c30] dark:bg-indigo-600 text-white flex items-center justify-center font-black shadow-md">
          <Wallet className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">LendWise</h1>
          <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Personal Ledger</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-[#0b1c30] text-white dark:bg-[#0d1322] dark:text-white dark:border dark:border-indigo-500/30 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer info */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 px-2 text-xs text-slate-400">
        <p className="font-semibold">LendWise v1.0</p>
        <p className="text-[10px] text-slate-500">PostgreSQL RLS Secured</p>
      </div>
    </aside>
  );
};
