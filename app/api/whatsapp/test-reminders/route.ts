import { NextResponse } from 'next/server';
import { getAllDueBorrowers } from '@/lib/whatsapp/db-readonly';
import { buildReminderMessage } from '@/lib/whatsapp';

export async function GET() {
  try {
    const isTestMode = process.env.TEST_MODE !== 'false';
    const targetPhone = process.env.TEST_PHONE_NUMBER || '+916238851129';

    // READ-ONLY query to fetch due borrowers
    const dueBorrowers = await getAllDueBorrowers();
    
    const previewBatch = dueBorrowers.map(item => ({
      borrowerName: item.person.name,
      registeredPhone: item.person.phone,
      targetTestPhone: targetPhone,
      dueMonth: item.dueMonth,
      dueAmount: item.totalDueAmount,
      paidAmount: item.totalPaidAmount,
      remainingAmount: item.remainingAmount,
      dueDate: item.dueDate,
      reminderMessagePreview: buildReminderMessage({
        phone: item.person.phone,
        countryCode: item.person.country_code,
        name: item.person.name,
        month: item.dueMonth || new Date().toISOString().slice(0, 7),
        dueAmount: item.totalDueAmount,
        paidAmount: item.totalPaidAmount,
        remainingAmount: item.remainingAmount,
        dueDate: item.dueDate,
        upiId: item.upiId
      })
    }));

    return NextResponse.json({
      success: true,
      testMode: isTestMode,
      targetTestPhone: targetPhone,
      totalDueBorrowers: previewBatch.length,
      previews: previewBatch
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
