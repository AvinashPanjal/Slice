'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { createClient } from '@/lib/supabase/client';
import { Profile, ReminderTemplate } from '@/lib/types';
import { Settings as SettingsIcon, Save, MessageSquare, ShieldCheck } from 'lucide-react';
import { requestNotificationPermission, sendLocalNotification } from '@/lib/utils/notifications';

export default function SettingsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);

  const [fullName, setFullName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [countryCode, setCountryCode] = useState('+91');
  const [upiId, setUpiId] = useState('avinashpanjal5@okhdfcbank');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUpi = localStorage.getItem('lendwise_upi_id') || 'avinashpanjal5@okhdfcbank';
      setUpiId(savedUpi);

      if ('Notification' in window && Notification.permission === 'granted') {
        setNotifGranted(true);
      }

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
      });

      window.addEventListener('appinstalled', () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
      });
    }
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const [{ data: prof }, { data: tpls }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userData.user.id).single(),
        supabase.from('reminder_templates').select('*').eq('user_id', userData.user.id),
      ]);

      if (prof) {
        setProfile(prof);
        setFullName(prof.full_name || '');
        setCurrency(prof.default_currency || 'INR');
        setCountryCode(prof.default_country_code || '+91');
        if (prof.default_upi_id) {
          setUpiId(prof.default_upi_id);
          if (typeof window !== 'undefined') {
            localStorage.setItem('lendwise_upi_id', prof.default_upi_id);
          }
        }
      }
      if (tpls) setTemplates(tpls);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      if (typeof window !== 'undefined') {
        localStorage.setItem('lendwise_upi_id', upiId.trim());
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          default_currency: currency,
          default_country_code: countryCode,
          default_upi_id: upiId.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userData.user.id);

      if (error) throw error;
      alert('Profile preferences & UPI settings saved successfully!');
    } catch (err: any) {
      alert(err.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleNotifications = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotifGranted(true);
      sendLocalNotification('🔔 LendWise Notifications Enabled!', {
        body: 'You will now receive alerts for 5th-of-the-month EMI due dates & pending repayments.',
      });
      alert('Notification permissions granted! Test alert sent.');
    } else {
      alert('Notification permissions were not granted. Please allow notifications in your browser settings.');
    }
  };

  const handleInstallPWA = async () => {
    if (!deferredPrompt) {
      alert('To add LendWise to your Home Screen: Tap your browser menu (⋮ or share icon) and select "Add to Home Screen" or "Install App".');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleUpdateTemplate = async (templateId: string, text: string) => {
    try {
      await supabase
        .from('reminder_templates')
        .update({ template: text, updated_at: new Date().toISOString() })
        .eq('id', templateId);
    } catch (err: any) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-10 w-64" />
        <LoadingSkeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          Application Preferences & Settings
        </h1>
        <p className="text-xs text-slate-500">Configure profile, default currency, UPI address, and PWA installation</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Add to Home Screen (PWA) Card */}
        <Card className="p-5 space-y-3 border-l-4 border-l-indigo-500">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center">
              📱 Install App (Add to Home Screen)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Runs full-screen as a native mobile app without the browser address bar.
            </p>
          </div>

          <Button onClick={handleInstallPWA} variant="primary" size="sm" className="shadow-md w-full">
            {isInstalled ? '✓ App Installed' : '📲 Add to Home Screen'}
          </Button>
        </Card>

        {/* Due Date Push Notifications Card */}
        <Card className="p-5 space-y-3 border-l-4 border-l-emerald-500">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center">
              🔔 Mobile & Desktop Push Notifications
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Get automatic OS push alerts for upcoming 5th EMI due dates & pending dues.
            </p>
          </div>

          <Button onClick={handleToggleNotifications} variant={notifGranted ? 'outline' : 'primary'} size="sm" className="shadow-md w-full">
            {notifGranted ? '✓ Notifications Active' : '🔔 Enable Notifications'}
          </Button>
        </Card>
      </div>

      {/* Profile Preferences */}
      <Card className="p-6 space-y-6">
        <div className="flex items-center space-x-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <SettingsIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            User Profile & UPI Payment Defaults
          </h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Default Currency
              </label>
              <select
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="INR">₹ INR (Indian Rupee)</option>
                <option value="USD">$ USD (US Dollar)</option>
                <option value="EUR">€ EUR (Euro)</option>
              </select>
            </div>

            <Input
              label="Default Country Code"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
            />
          </div>

          <Input
            label="Default UPI VPA Address (For GPay / PhonePe / Paytm)"
            placeholder="e.g. 9847812409@okicici or user@upi"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            helperText="Saved UPI ID will automatically generate upi://pay links in WhatsApp reminders"
          />

          <div className="flex justify-end pt-2">
            <Button type="submit" isLoading={saving}>
              <Save className="w-4 h-4 mr-1.5" />
              Save Preferences
            </Button>
          </div>
        </form>
      </Card>

      {/* WhatsApp Templates Editor */}
      <Card className="p-6 space-y-6">
        <div className="flex items-center space-x-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <MessageSquare className="w-5 h-5 text-emerald-500" />
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            WhatsApp Reminder Templates
          </h2>
        </div>

        <div className="space-y-6">
          {templates.map((tpl) => (
            <div key={tpl.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {tpl.name} ({tpl.type})
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  Placeholders: {'{name}'}, {'{month}'}, {'{due_amount}'}, {'{paid_amount}'}, {'{remaining_amount}'}, {'{due_date}'}, {'{upi_link}'}
                </span>
              </div>
              <textarea
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white"
                rows={4}
                value={tpl.template}
                onChange={(e) => {
                  const val = e.target.value;
                  setTemplates((prev) =>
                    prev.map((t) => (t.id === tpl.id ? { ...t, template: val } : t))
                  );
                }}
                onBlur={(e) => handleUpdateTemplate(tpl.id, e.target.value)}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
