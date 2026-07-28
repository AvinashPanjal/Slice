'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Wallet } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign up');
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
            Create LendWise Account
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Start tracking personal loans, dues, and WhatsApp reminders
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-600 font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="Rahul Sharma"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

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
            placeholder="Minimum 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button type="submit" isLoading={loading} className="w-full" size="lg">
            Create Account
          </Button>
        </form>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-xs text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="font-bold text-[#0b1c30] dark:text-white hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
