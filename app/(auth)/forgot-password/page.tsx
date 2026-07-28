'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Wallet } from 'lucide-react';

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      setMessage('Password reset instructions sent to your email.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error sending reset email');
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
            Forgot Password
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter your email to receive password recovery instructions
          </p>
        </div>

        {message && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-700 font-medium">
            {message}
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-600 font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleReset} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Button type="submit" isLoading={loading} className="w-full" size="lg">
            Send Reset Instructions
          </Button>
        </form>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500">
          Remembered your password?{' '}
          <Link href="/login" className="font-bold text-[#0b1c30] dark:text-white hover:underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
