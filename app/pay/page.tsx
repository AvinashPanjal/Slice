'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatINR } from '@/lib/utils/currency';
import { Wallet, Check, Copy, ArrowRight, ShieldCheck, QrCode, Download, Share2, Smartphone } from 'lucide-react';

function PayPageContent() {
  const searchParams = useSearchParams();

  const pa = searchParams.get('pa') || 'avinashpanjal5@okhdfcbank';
  const am = parseFloat(searchParams.get('am') || '0');
  const pn = searchParams.get('pn') || 'Avinash';

  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(true); // Default show QR for instant scanning

  const cleanAmount = am > 0 ? am.toFixed(2) : '0.00';
  const cleanName = encodeURIComponent(pn.replace(/[^a-zA-Z0-9 ]/g, '').trim());

  // Standard Generic P2P UPI URI
  const upiUri = `upi://pay?pa=${pa}&pn=${cleanName}&am=${cleanAmount}&cu=INR`;

  // Native Android Package Intent URIs
  const gpayIntent = `intent://pay?pa=${pa}&pn=${cleanName}&am=${cleanAmount}&cu=INR#Intent;scheme=upi;package=com.google.android.apps.nbu.paisa.user;end`;
  const phonepeIntent = `intent://pay?pa=${pa}&pn=${cleanName}&am=${cleanAmount}&cu=INR#Intent;scheme=upi;package=com.phonepe.app;end`;
  const paytmIntent = `intent://pay?pa=${pa}&pn=${cleanName}&am=${cleanAmount}&cu=INR#Intent;scheme=upi;package=net.one97.paytm;end`;

  // Dynamic QR Code image URL
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUri)}`;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleCopyUPI = () => {
    navigator.clipboard.writeText(pa);
    setCopied(true);
    showToast('✓ UPI ID copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // 1-Tap Copy & Launch App: Copies VPA and opens app
  const handleCopyAndLaunch = (appName: string, intentUrl: string) => {
    navigator.clipboard.writeText(pa);
    setCopied(true);
    showToast(`✓ UPI ID Copied! Opening ${appName}...`);
    setTimeout(() => {
      setCopied(false);
      window.location.href = intentUrl;
    }, 400);
  };

  // Download QR Code to Phone Gallery
  const handleDownloadQR = async () => {
    try {
      showToast('Downloading QR Code image...');
      const res = await fetch(qrCodeUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LendWise_UPI_QR_${pa}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('✓ QR Code saved to Gallery! Open GPay -> Upload from Gallery');
    } catch (err) {
      showToast('Long-press the QR Code image to save to Gallery.');
    }
  };

  // Web Share API
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Pay ₹${cleanAmount} to ${pn}`,
          text: `Pay ₹${cleanAmount} to ${pn}\nUPI ID: ${pa}`,
          url: window.location.href,
        });
      } catch (e) {}
    } else {
      handleCopyUPI();
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1c30] text-white flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Floating Toast Notification */}
      {toastMsg && (
        <div className="fixed top-5 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-2xl text-xs shadow-2xl animate-bounce border border-emerald-300 flex items-center space-x-2">
          <Check className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="w-full max-w-md space-y-4">
        {/* Header Branding */}
        <div className="text-center space-y-1.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/20">
            <Wallet className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black tracking-tight">LendWise Instant Pay</h1>
          <p className="text-[11px] text-slate-400">Personal UPI Payment Portal for {pn}</p>
        </div>

        {/* Main Payment Card */}
        <Card className="p-5 bg-[#131b2e] border-slate-800 space-y-4 shadow-2xl rounded-3xl">
          {/* Amount Display */}
          <div className="bg-[#0b1c30] p-4 rounded-2xl text-center border border-slate-800/80 space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Transfer Amount</p>
            <p className="text-3xl font-black text-emerald-400 tracking-tight">
              {formatINR(am)}
            </p>
          </div>

          {/* Payee Info & Copy Bar */}
          <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800 text-xs flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <p className="text-slate-400 text-[9px] uppercase font-bold">Payee UPI ID</p>
              <p className="font-mono font-bold text-indigo-300 text-xs truncate">{pa}</p>
            </div>
            <button
              onClick={handleCopyUPI}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shrink-0 flex items-center space-x-1 shadow-md"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy ID'}</span>
            </button>
          </div>

          {/* Instant Scan & Pay QR Section */}
          <div className="bg-white p-4 rounded-2xl flex flex-col items-center space-y-2 shadow-lg">
            <img src={qrCodeUrl} alt="UPI QR Code" className="w-48 h-48 rounded-xl border border-slate-100" />
            <div className="text-center space-y-1 w-full">
              <p className="text-slate-900 text-xs font-black">
                Scan via GPay / PhonePe / Paytm
              </p>
              <div className="flex justify-center space-x-2 pt-1">
                <button
                  onClick={handleDownloadQR}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-extrabold transition-all flex items-center space-x-1 shadow-md"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Save QR to Gallery</span>
                </button>
                <button
                  onClick={handleShare}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[11px] font-extrabold transition-all flex items-center space-x-1"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>

          {/* Automated Copy & App Launchers */}
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-bold text-slate-400 text-center uppercase tracking-wider">
              1-Tap Copy & Open App:
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleCopyAndLaunch('Google Pay', gpayIntent)}
                className="py-2.5 px-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-center border border-slate-700 transition-all group"
              >
                <div className="w-7 h-7 rounded-xl bg-white text-slate-900 flex items-center justify-center font-black text-xs mx-auto shadow-md mb-1">
                  G
                </div>
                <p className="font-bold text-[11px] text-white group-hover:text-indigo-300">Google Pay</p>
              </button>

              <button
                onClick={() => handleCopyAndLaunch('PhonePe', phonepeIntent)}
                className="py-2.5 px-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-center border border-slate-700 transition-all group"
              >
                <div className="w-7 h-7 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-xs mx-auto shadow-md mb-1">
                  Pe
                </div>
                <p className="font-bold text-[11px] text-white group-hover:text-indigo-300">PhonePe</p>
              </button>

              <button
                onClick={() => handleCopyAndLaunch('Paytm', paytmIntent)}
                className="py-2.5 px-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-center border border-slate-700 transition-all group"
              >
                <div className="w-7 h-7 rounded-xl bg-sky-500 text-white flex items-center justify-center font-black text-xs mx-auto shadow-md mb-1">
                  Pay
                </div>
                <p className="font-bold text-[11px] text-white group-hover:text-indigo-300">Paytm</p>
              </button>
            </div>

            <Button
              onClick={() => handleCopyAndLaunch('UPI App', upiUri)}
              size="sm"
              className="w-full py-2.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl mt-1 flex items-center justify-center space-x-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Copy ID & Open Any Bank App</span>
            </Button>
          </div>
        </Card>

        {/* Instructions Card */}
        <div className="bg-[#131b2e]/60 p-3 rounded-2xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
          <p className="font-bold text-slate-300 flex items-center">
            💡 How to Pay on HDFC Personal Handles:
          </p>
          <ol className="list-decimal list-inside space-y-0.5 text-[10px] text-slate-400">
            <li>Tap <b>Save QR to Gallery</b> OR <b>Google Pay</b> (copies UPI ID).</li>
            <li>In Google Pay: Tap <b>Scan QR code</b> -&gt; <b>Upload from Gallery</b> OR tap <b>Pay UPI ID</b> and paste!</li>
          </ol>
        </div>

        {/* Security Footer */}
        <div className="flex items-center justify-center space-x-1.5 text-[10px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>NPCI Standard Personal UPI Protocol</span>
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
