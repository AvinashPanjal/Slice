'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Sun, Moon, LogOut, Calendar as CalendarIcon, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatMonthDisplay, getCurrentMonthStr } from '@/lib/utils/date';
import { createClient } from '@/lib/supabase/client';

interface HeaderProps {
  title: string;
  onOpenQuickAdd?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onOpenQuickAdd }) => {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const currentMonth = formatMonthDisplay(getCurrentMonthStr());
  const supabase = createClient();

  useEffect(() => {
    // Sync dark mode from document class
    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark');
      setDarkMode(isDark);
    }
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserEmail(data.user.email || 'User');
      }
    };
    fetchUser();
  }, [supabase]);

  const toggleDarkMode = () => {
    if (darkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setDarkMode(true);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#0b1c30]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-8 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
          <span>{currentMonth}</span>
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Toggle Dark Mode"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Quick Add Button */}
        {onOpenQuickAdd && (
          <Button onClick={onOpenQuickAdd} size="sm" className="shadow-md">
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Quick Add</span>
          </Button>
        )}

        {/* User logout button */}
        <button
          onClick={handleLogout}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          title="Log out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
