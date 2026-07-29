'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Building2,
  Menu,
  X,
  Receipt,
  AlertCircle,
  Calendar,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const MAIN_MOBILE_NAV = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'People', href: '/people', icon: Users },
  { label: 'Loans', href: '/loans', icon: CreditCard },
  { label: 'Sources', href: '/loan-sources', icon: Building2 },
];

const ALL_MENU_NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, desc: 'Overview & metrics' },
  { label: 'People Ledger', href: '/people', icon: Users, desc: 'Borrowers & history' },
  { label: 'Individual Loans', href: '/loans', icon: CreditCard, desc: 'Active & closed loans' },
  { label: 'Loan Sources & Apps', href: '/loan-sources', icon: Building2, desc: 'Slice, Navi, Custom sources' },
  { label: 'Payments', href: '/payments', icon: Receipt, desc: 'Allocations & receipts' },
  { label: 'Overdue Dues', href: '/overdue', icon: AlertCircle, desc: 'Pending overdue alerts' },
  { label: 'Calendar', href: '/calendar', icon: Calendar, desc: 'Monthly repayment timeline' },
  { label: 'Reports', href: '/reports', icon: BarChart3, desc: 'Analytics & insights' },
  { label: 'Settings', href: '/settings', icon: Settings, desc: 'Preferences & profile' },
];

export const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <>
      {/* Slide-Up Mobile Full Navigation Drawer */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div
            className="fixed inset-0"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="relative z-10 w-full bg-white dark:bg-[#131b2e] rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 dark:border-slate-800 max-h-[85vh] flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3 shrink-0">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  LW
                </div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">All Menu Pages</h3>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Items List */}
            <div className="overflow-y-auto space-y-1.5 flex-1 pr-1 py-1">
              {ALL_MENU_NAV.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center space-x-3.5 p-3 rounded-2xl transition-all ${
                      isActive
                        ? 'bg-[#0b1c30] text-white dark:bg-slate-700 shadow-md font-bold'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold">{item.label}</p>
                      <p className={`text-[11px] ${isActive ? 'text-slate-200' : 'text-slate-400'}`}>{item.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Logout Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 mt-2 shrink-0">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 text-xs font-extrabold hover:bg-rose-100 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sticky Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#131b2e]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-3 py-1.5 shadow-lg">
        <div className="flex items-center justify-between max-w-md mx-auto">
          {MAIN_MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center py-1 px-2.5 rounded-2xl transition-all ${
                  isActive
                    ? 'text-[#0b1c30] dark:text-white font-extrabold'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'scale-110 text-indigo-600 dark:text-indigo-400' : ''}`} />
                <span className="text-[10px] mt-0.5 whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}

          {/* More Menu Button */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className={`flex flex-col items-center py-1 px-2.5 rounded-2xl transition-all ${
              isMenuOpen ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-slate-400 hover:text-slate-600 font-semibold'
            }`}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">More</span>
          </button>
        </div>
      </div>
    </>
  );
};
