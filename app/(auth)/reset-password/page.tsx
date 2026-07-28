'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Wallet } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push('/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error setting new password');
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
            Set New Password
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enter your new secure password below
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-600 font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-4">
          <Input
            label="New Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" isLoading={loading} className="w-full" size="lg">
            Update Password
          </Button>
        </form>
      </div>
    </div>
  );
}
