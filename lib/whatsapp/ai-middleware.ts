import { GoogleGenAI } from '@google/genai';
import { getBorrowerDueByPhone } from './db-readonly';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables.');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

/**
 * Intelligent Middleware: Parses borrower query, fetches READ-ONLY due data, and drafts AI response.
 */
export async function handleBorrowerAIQuery(senderPhone: string, userMessage: string): Promise<string> {
  try {
    // 1. Fetch READ-ONLY financial details for sender
    const financialInfo = await getBorrowerDueByPhone(senderPhone);

    const ai = getAiClient();
    const modelsToTry = [
      process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest'
    ];
    const uniqueModels = [...new Set(modelsToTry)];

    let contextPrompt = '';

    const todayDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const currentMonthName = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

    if (financialInfo && financialInfo.person) {
      contextPrompt = `
You are Lendwise AI Assistant, representing lender Avinash.
TODAY'S REAL DATE: ${todayDate} (${currentMonthName})

The borrower contacting you is:
- Name: ${financialInfo.person.name}
- Phone: ${financialInfo.person.phone}
- Current Calendar Month: ${currentMonthName} (${financialInfo.currentMonth})
- Is Current Month (${currentMonthName}) Paid? ${financialInfo.isCurrentMonthPaid ? 'YES, All payments for current month are CLEARED! 🎉' : 'NO, Payment for current month is PENDING'}
- Has Overdue Payments from Previous Months? ${financialInfo.hasOverdue ? `YES (₹${financialInfo.overdueAmount} Overdue)` : 'NO Overdue'}
- Next Scheduled EMI / Payment: ₹${financialInfo.nextDueAmount || financialInfo.remainingAmount} due on ${financialInfo.nextDueDate || financialInfo.dueDate} (${financialInfo.nextDueMonth || financialInfo.dueMonth})
- Payment UPI ID: ${financialInfo.upiId}

Borrower asked: "${userMessage}"

INSTRUCTIONS:
1. Be polite, friendly, and professional.
2. Note today's real date (${todayDate}). If current month (${currentMonthName}) has NO pending due, explicitly inform them that their current month payments are 100% cleared!
3. Clearly state when their next upcoming payment is due (e.g. "Your next scheduled payment is ₹${financialInfo.nextDueAmount} due on ${financialInfo.nextDueDate}"). Do NOT present a future due date (like 2027) as if it were overdue for today's month.
4. Include the UPI ID (\`${financialInfo.upiId}\`) if they ask about payment or how to pay.
5. DO NOT invent or mention any fictional email addresses (like support@lendwise.com) or websites.
6. Keep response concise, friendly, and formatted cleanly for WhatsApp. Use emojis.
`;
    } else {
      contextPrompt = `
You are Lendwise AI Assistant, representing lender Avinash.
TODAY'S REAL DATE: ${todayDate} (${currentMonthName})

A contact with phone number ${senderPhone} sent a message: "${userMessage}"

However, their phone number is NOT listed in the active borrower database.

INSTRUCTIONS:
1. Politely inform them that their phone number is not registered in our Lendwise borrower records.
2. Ask them to confirm if they are messaging from a different mobile number or to reach out to Avinash directly.
3. DO NOT invent or mention any fictional email addresses (like support@lendwise.com) or websites.
4. Keep response concise, friendly, and helpful for chat.
`;
    }

    let lastError: any = null;
    for (const modelName of uniqueModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: contextPrompt,
        });

        if (response && response.text) {
          return response.text;
        }
      } catch (err) {
        lastError = err;
        console.warn(`Model ${modelName} error in AI middleware:`, err);
      }
    }

    // Fallback static summary if AI models fail
    if (financialInfo && financialInfo.person) {
      if (financialInfo.isCurrentMonthPaid) {
        return `Hi *${financialInfo.person.name}* 👋\n\nYour current month (*${currentMonthName}*) dues are completely cleared! 🎉\n\n• Next Scheduled EMI: ₹${financialInfo.nextDueAmount}\n• Next Due Date: ${financialInfo.nextDueDate}\n\n💳 UPI ID: \`${financialInfo.upiId}\``;
      }
      return `Hi *${financialInfo.person.name}* 👋\n\nYour due summary for *${currentMonthName}*:\n• *Remaining Balance:* ₹${financialInfo.remainingAmount}\n• Due Date: ${financialInfo.dueDate || '5th of the month'}\n\n💳 UPI ID: \`${financialInfo.upiId}\``;
    }
    return `Hi! Thank you for reaching out to Lendwise. Please contact Avinash directly to verify your registered mobile number.`;
  } catch (error: any) {
    console.error('Error in handleBorrowerAIQuery:', error);
    return `⚠️ Sorry, I encountered an issue retrieving your due information. Please try again shortly.`;
  }
}
