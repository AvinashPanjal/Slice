'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Person, ReminderTemplate } from '@/lib/types';
import { buildReminderMessage, generateWhatsAppLink } from '@/lib/whatsapp';
import { MessageSquare, ExternalLink } from 'lucide-react';
import { getCurrentMonthStr } from '@/lib/utils/date';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: Person | null;
  dueAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate?: string;
  templates?: ReminderTemplate[];
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  person,
  dueAmount,
  paidAmount,
  remainingAmount,
  dueDate,
  templates = [],
}) => {
  const [selectedTemplateType, setSelectedTemplateType] = useState<'NORMAL' | 'UPCOMING' | 'OVERDUE' | 'PARTIAL'>('NORMAL');
  const [message, setMessage] = useState('');

  const currentMonth = getCurrentMonthStr();

  useEffect(() => {
    if (person) {
      const found = templates.find((t) => t.type === selectedTemplateType);
      const customTpl = found?.template;

      const built = buildReminderMessage({
        phone: person.phone,
        countryCode: person.country_code,
        name: person.name,
        month: currentMonth,
        dueAmount,
        paidAmount,
        remainingAmount,
        dueDate,
        template: customTpl,
      });

      setMessage(built);
    }
  }, [person, dueAmount, paidAmount, remainingAmount, dueDate, selectedTemplateType, templates, currentMonth, isOpen]);

  if (!person) return null;

  const handleOpenWhatsApp = () => {
    const link = generateWhatsAppLink(person.phone, person.country_code, message);
    window.open(link, '_blank');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`WhatsApp Reminder for ${person.name}`}
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Template Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
            Select Reminder Tone / Template
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['NORMAL', 'UPCOMING', 'OVERDUE', 'PARTIAL'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedTemplateType(type)}
                className={`py-1.5 px-2 rounded-xl text-xs font-semibold border transition-all ${
                  selectedTemplateType === type
                    ? 'bg-[#0b1c30] text-white border-[#0b1c30] dark:bg-slate-700'
                    : 'bg-white dark:bg-[#131b2e] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
            Message Preview (Editable)
          </label>
          <textarea
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0b1c30] dark:bg-[#131b2e] dark:text-white"
            rows={7}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>
            Clicking send will launch WhatsApp Web or Mobile App with your prefilled text. You must manually press Send in WhatsApp.
          </span>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleOpenWhatsApp} variant="success">
            <ExternalLink className="w-4 h-4 mr-1.5" />
            Open WhatsApp
          </Button>
        </div>
      </div>
    </Modal>
  );
};
