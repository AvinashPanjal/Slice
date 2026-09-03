import cron from 'node-cron';
import { getAllDueBorrowers } from './db-readonly';
import { buildReminderMessage } from './index';

interface DispatchReport {
  timestamp: string;
  isTestMode: boolean;
  totalDueBorrowersCount: number;
  dispatchedCount: number;
  targetPhoneUsed: string;
  messagesSent: Array<{
    borrowerName: string;
    originalPhone: string;
    targetPhone: string;
    preview: string;
  }>;
}

/**
 * Runs due reminder batch for 1st & 4th of every month.
 * Supports Dry-Run / Test Mode targeting +91 6238851129.
 */
export async function runDueRemindersBatch(
  sendWhatsAppMessageFn: (phone: string, text: string) => Promise<boolean>,
  customTestPhone?: string
): Promise<DispatchReport> {
  const isTestMode = process.env.TEST_MODE !== 'false';
  const targetPhone = customTestPhone || process.env.TEST_PHONE_NUMBER || '+916238851129';

  console.log(`\n📅 Starting Due Reminders Batch [Test Mode: ${isTestMode}] [Target Phone: ${targetPhone}]`);

  const dueBorrowers = await getAllDueBorrowers();
  const report: DispatchReport = {
    timestamp: new Date().toISOString(),
    isTestMode,
    totalDueBorrowersCount: dueBorrowers.length,
    dispatchedCount: 0,
    targetPhoneUsed: targetPhone,
    messagesSent: []
  };

  for (const item of dueBorrowers) {
    const messageText = buildReminderMessage({
      phone: item.person.phone,
      countryCode: item.person.country_code,
      name: item.person.name,
      month: item.dueMonth || new Date().toISOString().slice(0, 7),
      dueAmount: item.totalDueAmount,
      paidAmount: item.totalPaidAmount,
      remainingAmount: item.remainingAmount,
      dueDate: item.dueDate,
      upiId: item.upiId
    });

    const recipientPhone = isTestMode ? targetPhone : item.person.phone;
    
    console.log(`📤 Dispatching reminder for ${item.person.name} -> ${recipientPhone}`);
    
    const success = await sendWhatsAppMessageFn(recipientPhone, messageText);

    if (success) {
      report.dispatchedCount++;
    }

    report.messagesSent.push({
      borrowerName: item.person.name,
      originalPhone: item.person.phone,
      targetPhone: recipientPhone,
      preview: messageText
    });

    // Small delay between dispatches
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`✅ Completed Due Reminders Batch. Dispatched: ${report.dispatchedCount}/${report.totalDueBorrowersCount}\n`);
  return report;
}

/**
 * Initializes cron schedule for 1st & 4th of every month at 9:00 AM (0 9 1,4 * *)
 */
export function initMonthlyReminderScheduler(
  sendWhatsAppMessageFn: (phone: string, text: string) => Promise<boolean>
) {
  // Cron pattern: at 09:00 AM on day-of-month 1 and 4
  const cronSchedule = process.env.REMINDER_CRON_SCHEDULE || '0 9 1,4 * *';

  console.log(`⏰ Initializing Monthly Reminder Cron Scheduler (${cronSchedule})`);

  cron.schedule(cronSchedule, async () => {
    const enableAuto = process.env.ENABLE_AUTO_REMINDERS === 'true';
    if (!enableAuto && process.env.TEST_MODE === 'false') {
      console.log('⚠️ Monthly reminder cron triggered, but ENABLE_AUTO_REMINDERS is set to false. Skipping live dispatch.');
      return;
    }
    await runDueRemindersBatch(sendWhatsAppMessageFn);
  });
}
