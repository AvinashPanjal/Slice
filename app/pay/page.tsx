'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatINR } from '@/lib/utils/currency';
import { Wallet, Check, Copy, ArrowRight, ShieldCheck } from 'lucide-react';

function PayPageContent() {
  const searchParams = useSearchParams();

  const pa = searchParams.get('pa') || 'avinashpanjal5@okhdfcbank';
  const am = parseFloat(searchParams.get('am') || '0');
  const pn = searchParams.get('pn') || 'LendWise';
  const tn = searchParams.get('tn') || 'EMIPayment';

  const [copied, setCopied] = useState(false);
  const [autoRedirected, setAutoRedirected] = useState(false);

  const cleanAmount = am > 0 ? am.toFixed(2) : '0.00';
  const cleanName = encodeURIComponent(pn.replace(/[^a-zA-Z0-9 ]/g, '').trim());
  const cleanNote = encodeURIComponent(tn.replace(/[^a-zA-Z0-9]/g, '').slice(0, 30));
  const tr = `LW${Date.now()}`;

  // Standard NPCI UPI URI
  const upiUri = `upi://pay?pa=${pa}&pn=${cleanName}&am=${cleanAmount}&cu=INR&tn=${cleanNote}&tr=${tr}`;

  // App-specific intent URIs for fallback direct launches
  const gpayUri = `gpay://upi/pay?pa=${pa}&pn=${cleanName}&am=${cleanAmount}&cu=INR&tn=${cleanNote}`;
  const phonepeUri = `phonepe://pay?pa=${pa}&pn=${cleanName}&am=${cleanAmount}&cu=INR&tn=${cleanNote}`;
  const paytmUri = `paytmmp://pay?pa=${pa}&pn=${cleanName}&am=${cleanAmount}&cu=INR&tn=${cleanNote}`;

  const handlePay = (targetUri?: string) => {
    const uriToOpen = targetUri || upiUri;
    window.location.href = uriToOpen;
  };

  const handleCopyUPI = () => {
    navigator.clipboard.writeText(pa);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Attempt auto-pay redirection once after 800ms if on mobile
  useEffect(() => {
    if (typeof window !== 'undefined' && am > 0 && !autoRedirected) {
      const timer = setTimeout(() => {
        setAutoRedirected(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [am, autoRedirected]);

  return (
    <div className="min-h-screen bg-[#0b1c30] text-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/20">
            <Wallet className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">LendWise Secure Pay</h1>
          <p className="text-xs text-slate-400">Direct UPI Payment Portal for GPay, PhonePe, Paytm & BHIM</p>
        </div>

        {/* Main Payment Card */}
        <Card className="p-6 bg-[#131b2e] border-slate-800 space-y-6 shadow-2xl rounded-3xl">
          {/* Amount Display */}
          <div className="bg-[#0b1c30] p-5 rounded-2xl text-center border border-slate-800/80 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Amount Dues</p>
            <p className="text-3xl font-black text-emerald-400 tracking-tight">
              {formatINR(am)}
            </p>
            <p className="text-[10px] text-slate-500 font-mono">Ref: {tr}</p>
          </div>

          {/* Payee Details */}
          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-slate-400 font-medium">Payee Name:</span>
              <span className="font-bold text-white">{pn}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-slate-400 font-medium">UPI VPA:</span>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-indigo-400 font-mono">{pa}</span>
                <button
                  onClick={handleCopyUPI}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Copy UPI VPA"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <span className="text-slate-400 font-medium">Payment Note:</span>
              <span className="font-semibold text-slate-300">{tn}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={() => handlePay(upiUri)}
              size="lg"
              className="w-full py-4 text-base font-extrabold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl shadow-xl shadow-emerald-900/30 flex items-center justify-center space-x-2"
            >
              <span>🚀 Open UPI App & Pay Now</span>
              <ArrowRight className="w-5 h-5" />
            </Button>

            {/* Direct App Fallback Buttons */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <button
                onClick={() => handlePay(gpayUri)}
                className="py-2.5 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-[11px] font-bold text-slate-200 border border-slate-700 flex flex-col items-center justify-center space-y-1 transition-all"
              >
                <span>Google Pay</span>
              </button>
              <button
                onClick={() => handlePay(phonepeUri)}
                className="py-2.5 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-[11px] font-bold text-slate-200 border border-slate-700 flex flex-col items-center justify-center space-y-1 transition-all"
              >
                <span>PhonePe</span>
              </button>
              <button
                onClick={() => handlePay(paytmUri)}
                className="py-2.5 px-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-[11px] font-bold text-slate-200 border border-slate-700 flex flex-col items-center justify-center space-y-1 transition-all"
              >
                <span>Paytm</span>
              </button>
            </div>
          </div>

          <div className="pt-2 text-center">
            <button
              onClick={handleCopyUPI}
              className="text-xs text-indigo-400 hover:underline inline-flex items-center font-medium"
            >
              {copied ? '✓ UPI ID Copied!' : 'Copy UPI VPA to pay manually from any bank app'}
            </button>
          </div>
        </Card>

        {/* Security Footer */}
        <div className="flex items-center justify-center space-x-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>NPCI Compliant UPI Standard Protocol</span>
        </div>
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0b1c30] text-white flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading LendWise Secure Pay...</p>
      </div>
    }>
      <PayPageContent />
    </Suspense>
  );
}
