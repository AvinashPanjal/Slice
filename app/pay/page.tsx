'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatINR } from '@/lib/utils/currency';
import { Wallet, Check, Copy, ArrowRight, ShieldCheck, QrCode, Smartphone } from 'lucide-react';

function PayPageContent() {
  const searchParams = useSearchParams();

  const pa = searchParams.get('pa') || 'avinashpanjal5@okhdfcbank';
  const am = parseFloat(searchParams.get('am') || '0');
  const pn = searchParams.get('pn') || 'Avinash';

  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const cleanAmount = am > 0 ? am.toFixed(2) : '0.00';
  const cleanName = encodeURIComponent(pn.replace(/[^a-zA-Z0-9 ]/g, '').trim());

  // Standard Generic P2P UPI URI
  const upiUri = `upi://pay?pa=${pa}&pn=${cleanName}&am=${cleanAmount}&cu=INR`;

  // Native Android Package Intent URIs (Direct App Launchers for Android)
  const gpayIntent = `intent://pay?pa=${pa}&pn=${cleanName}&am=${cleanAmount}&cu=INR#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
  const phonepeIntent = `intent://pay?pa=${pa}&pn=${cleanName}&am=${cleanAmount}&cu=INR#Intent;scheme=upi;package=com.phonepe.app;end`;
  const paytmIntent = `intent://pay?pa=${pa}&pn=${cleanName}&am=${cleanAmount}&cu=INR#Intent;scheme=upi;package=net.one97.paytm;end`;
  const bhimIntent = `intent://pay?pa=${pa}&pn=${cleanName}&am=${cleanAmount}&cu=INR#Intent;scheme=in.org.npci.upiapp;package=in.org.npci.upiapp;end`;

  // QR Code URL
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}`;

  const launchApp = (intentUrl: string) => {
    // If on Android, Intent URI launches installed app natively
    window.location.href = intentUrl;
  };

  const handleCopyUPI = () => {
    navigator.clipboard.writeText(pa);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0b1c30] text-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-5">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/20">
            <Wallet className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">LendWise Instant Pay</h1>
          <p className="text-xs text-slate-400">1-Tap Direct Payment to {pn}</p>
        </div>

        {/* Main Payment Card */}
        <Card className="p-6 bg-[#131b2e] border-slate-800 space-y-5 shadow-2xl rounded-3xl">
          {/* Amount Display */}
          <div className="bg-[#0b1c30] p-5 rounded-2xl text-center border border-slate-800/80 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Amount to Transfer</p>
            <p className="text-3xl font-black text-emerald-400 tracking-tight">
              {formatINR(am)}
            </p>
          </div>

          {/* Payee Info */}
          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800 text-xs flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-[10px] uppercase font-bold">UPI ID (VPA)</p>
              <p className="font-mono font-bold text-indigo-300 text-sm">{pa}</p>
            </div>
            <button
              onClick={handleCopyUPI}
              className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all flex items-center space-x-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Direct App Launchers (Android Intent URIs) */}
          <div className="space-y-3 pt-1">
            <p className="text-xs font-bold text-slate-300 text-center uppercase tracking-wider">
              Select Your Installed UPI App:
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => launchApp(gpayIntent)}
                className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-left transition-all flex items-center space-x-3 group"
              >
                <div className="w-8 h-8 rounded-xl bg-white text-slate-900 flex items-center justify-center font-black text-xs shrink-0 shadow-md">
                  G
                </div>
                <div>
                  <p className="font-extrabold text-xs text-white group-hover:text-indigo-300">Google Pay</p>
                  <p className="text-[10px] text-slate-400">Launch GPay</p>
                </div>
              </button>

              <button
                onClick={() => launchApp(phonepeIntent)}
                className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-left transition-all flex items-center space-x-3 group"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-md">
                  Pe
                </div>
                <div>
                  <p className="font-extrabold text-xs text-white group-hover:text-indigo-300">PhonePe</p>
                  <p className="text-[10px] text-slate-400">Launch PhonePe</p>
                </div>
              </button>

              <button
                onClick={() => launchApp(paytmIntent)}
                className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-left transition-all flex items-center space-x-3 group"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-md">
                  Paytm
                </div>
                <div>
                  <p className="font-extrabold text-xs text-white group-hover:text-indigo-300">Paytm</p>
                  <p className="text-[10px] text-slate-400">Launch Paytm</p>
                </div>
              </button>

              <button
                onClick={() => launchApp(bhimIntent)}
                className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-left transition-all flex items-center space-x-3 group"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-md">
                  BHIM
                </div>
                <div>
                  <p className="font-extrabold text-xs text-white group-hover:text-indigo-300">BHIM / Any</p>
                  <p className="text-[10px] text-slate-400">Launch BHIM</p>
                </div>
              </button>
            </div>

            {/* Standard Generic Fallback Button */}
            <Button
              onClick={() => launchApp(upiUri)}
              size="lg"
              className="w-full py-3 text-xs sm:text-sm font-extrabold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl shadow-xl shadow-emerald-900/30 flex items-center justify-center space-x-2 mt-2"
            >
              <Smartphone className="w-4 h-4" />
              <span>Choose Other Bank UPI App</span>
            </Button>
          </div>

          {/* QR Code Collapsible Section */}
          <div className="pt-2 border-t border-slate-800 text-center">
            {showQR ? (
              <div className="bg-white p-4 rounded-2xl flex flex-col items-center space-y-2 shadow-inner mt-2">
                <img src={qrCodeUrl} alt="UPI QR Code" className="w-44 h-44 rounded-lg" />
                <p className="text-slate-800 text-[11px] font-extrabold">Scan using another phone</p>
                <button onClick={() => setShowQR(false)} className="text-xs text-indigo-600 font-bold hover:underline">
                  Hide QR Code
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowQR(true)}
                className="text-xs text-indigo-400 hover:underline inline-flex items-center font-bold"
              >
                <QrCode className="w-3.5 h-3.5 mr-1" /> Show QR Code for desktop scanning
              </button>
            )}
          </div>
        </Card>

        {/* Security Footer */}
        <div className="flex items-center justify-center space-x-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>NPCI Direct Android Native Intent Gateway</span>
        </div>
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0b1c30] text-white flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading LendWise Instant Pay...</p>
      </div>
    }>
      <PayPageContent />
    </Suspense>
  );
}
