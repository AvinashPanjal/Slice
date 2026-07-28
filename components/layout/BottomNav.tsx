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
} from 'lucide-react';

const MOBILE_NAV = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'People', href: '/people', icon: Users },
  { label: 'Loans', href: '/loans', icon: CreditCard },
  { label: 'Payments', href: '/payments', icon: Receipt },
  { label: 'Overdue', href: '/overdue', icon: AlertCircle },
];

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#131b2e]/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 py-2">
      <div className="flex items-center justify-around">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-1 px-3 rounded-2xl transition-all ${
                isActive
                  ? 'text-[#0b1c30] dark:text-white font-bold'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
