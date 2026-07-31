'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Sun, Moon, LogOut, Calendar as CalendarIcon, Maximize, Minimize } from 'lucide-react';
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const currentMonth = formatMonthDisplay(getCurrentMonthStr());
  const supabase = createClient();

  useEffect(() => {
    // Sync dark mode from document class
    if (typeof window !== 'undefined') {
      const isDark = document.documentElement.classList.contains('dark');
      setDarkMode(isDark);
      setIsFullscreen(!!document.fullscreenElement);
    }

    const handleFSChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFSChange);
    document.addEventListener('webkitfullscreenchange', handleFSChange);

    // Auto-enter fullscreen on first touch/click gesture if not already fullscreen
    const handleFirstUserGesture = () => {
      if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
        const elem = document.documentElement as any;
        if (elem.requestFullscreen) {
          elem.requestFullscreen().catch(() => {});
        } else if (elem.webkitRequestFullscreen) {
          elem.webkitRequestFullscreen();
        }
      }
    };
    window.addEventListener('touchstart', handleFirstUserGesture, { once: true });
    window.addEventListener('click', handleFirstUserGesture, { once: true });

    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUserEmail(data.user.email || 'User');
      }
    };
    fetchUser();

    return () => {
      document.removeEventListener('fullscreenchange', handleFSChange);
      document.removeEventListener('webkitfullscreenchange', handleFSChange);
      window.removeEventListener('touchstart', handleFirstUserGesture);
      window.removeEventListener('click', handleFirstUserGesture);
    };
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      const elem = document.documentElement as any;
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    } else {
      const doc = document as any;
      if (doc.exitFullscreen) {
        doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#0b1c30]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-3 sm:px-8 py-3.5 flex items-center justify-between w-full max-w-full overflow-x-hidden box-border">
      <div className="min-w-0 shrink">
        <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
          {title}
        </h1>
        <div className="hidden xs:flex items-center space-x-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{currentMonth}</span>
        </div>
      </div>

      <div className="flex items-center space-x-1 sm:space-x-3 shrink-0">
        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Toggle Dark Mode"
        >
          {darkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
        </button>

        {/* Quick Add Button */}
        {onOpenQuickAdd && (
          <Button onClick={onOpenQuickAdd} size="sm" className="shadow-md px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs">
            <Plus className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Quick Add</span>
          </Button>
        )}

        {/* User logout button */}
        <button
          onClick={handleLogout}
          className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          title="Log out"
        >
          <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </header>
  );
};
