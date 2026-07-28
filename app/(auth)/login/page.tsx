'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Wallet, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-[#f8f9ff] dark:bg-[#0b1c30]">
      <div className="w-full max-w-md bg-white dark:bg-[#131b2e] rounded-3xl p-8 shadow-xl border border-slate-100 dark:border-slate-800 space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#0b1c30] text-white flex items-center justify-center shadow-lg">
            <Wallet className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Welcome to LendWise
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Sign in to access your personal financial ledger
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-600 font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="flex items-center justify-between text-xs">
            <Link
              href="/forgot-password"
              className="text-slate-600 dark:text-slate-400 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" isLoading={loading} className="w-full" size="lg">
            Sign In
          </Button>
        </form>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500">
          Don't have an account?{' '}
          <Link href="/signup" className="font-bold text-[#0b1c30] dark:text-white hover:underline">
            Sign Up
          </Link>
        </div>

        <div className="flex items-center justify-center space-x-1.5 text-[10px] text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Protected by Supabase Row Level Security</span>
        </div>
      </div>
    </div>
  );
}
