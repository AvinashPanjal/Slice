'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatINR } from '@/lib/utils/currency';
import { Wallet, Check, Copy, ArrowRight, ShieldCheck, QrCode } from 'lucide-react';

function PayPageContent() {
  const searchParams = useSearchParams();

  const pa = searchParams.get('pa') || 'avinashpanjal5@okhdfcbank';
  const am = parseFloat(searchParams.get('am') || '0');
  const pn = searchParams.get('pn') || 'Avinash';

  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const cleanAmount = am > 0 ? am.toFixed(2) : '0.00';
  const cleanName = encodeURIComponent(pn.replace(/[^a-zA-Z0-9 ]/g, '').trim());

  // Standard P2P NPCI compliant UPI URI (strictly without tr/tn to avoid merchant lookup errors on personal VPAs)
  const upiUri = `upi://pay?pa=${pa}&pn=${cleanName}&am=${cleanAmount}&cu=INR`;

  // QR Code URL using standard QR API
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}`;

  const handlePay = () => {
    window.location.href = upiUri;
  };

  const handleCopyAndPay = () => {
    navigator.clipboard.writeText(pa);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      window.location.href = upiUri;
    }, 600);
  };

  const handleCopyUPI = () => {
    navigator.clipboard.writeText(pa);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0b1c30] text-white flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/20">
            <Wallet className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">LendWise UPI Payment</h1>
          <p className="text-xs text-slate-400">Direct Personal UPI Transfer for GPay, PhonePe, Paytm & BHIM</p>
        </div>

        {/* Main Payment Card */}
        <Card className="p-6 bg-[#131b2e] border-slate-800 space-y-6 shadow-2xl rounded-3xl">
          {/* Amount Display */}
          <div className="bg-[#0b1c30] p-5 rounded-2xl text-center border border-slate-800/80 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Due Amount</p>
            <p className="text-3xl font-black text-emerald-400 tracking-tight">
              {formatINR(am)}
            </p>
          </div>

          {/* QR Code / Details Toggle */}
          {showQR ? (
            <div className="bg-white p-4 rounded-2xl flex flex-col items-center space-y-3 shadow-inner">
              {/* Dynamic QR Code Image */}
              <img
                src={qrCodeUrl}
                alt="UPI Payment QR Code"
                className="w-48 h-48 rounded-lg"
              />
              <p className="text-slate-800 text-xs font-extrabold text-center">
                Scan using Google Pay, PhonePe, Paytm, or BHIM
              </p>
              <button
                onClick={() => setShowQR(false)}
                className="text-xs text-indigo-600 font-bold hover:underline"
              >
                Hide QR Code
              </button>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-2.5 border-b border-slate-800">
                <span className="text-slate-400 font-medium">Payee Name:</span>
                <span className="font-bold text-white text-sm">{pn}</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-slate-800">
                <span className="text-slate-400 font-medium">UPI VPA:</span>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-indigo-400 font-mono text-sm">{pa}</span>
                  <button
                    onClick={handleCopyUPI}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="Copy UPI VPA"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="pt-1 flex justify-center">
                <button
                  onClick={() => setShowQR(true)}
                  className="inline-flex items-center space-x-1.5 py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold transition-all border border-slate-700"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Show Scan & Pay QR Code</span>
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={handlePay}
              size="lg"
              className="w-full py-4 text-base font-extrabold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl shadow-xl shadow-emerald-900/30 flex items-center justify-center space-x-2"
            >
              <span>🚀 Open UPI App (GPay/PhonePe)</span>
              <ArrowRight className="w-5 h-5" />
            </Button>

            <button
              onClick={handleCopyAndPay}
              className="w-full py-3 px-4 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all flex items-center justify-center space-x-2"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? '✓ UPI ID Copied! Opening App...' : 'Copy UPI ID & Pay'}</span>
            </button>
          </div>
        </Card>

        {/* Security Footer */}
        <div className="flex items-center justify-center space-x-2 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>NPCI Compliant Personal UPI Transfer Protocol</span>
        </div>
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0b1c30] text-white flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading LendWise UPI Payment...</p>
      </div>
    }>
      <PayPageContent />
    </Suspense>
  );
}
