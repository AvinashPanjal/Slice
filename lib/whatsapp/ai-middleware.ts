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

    if (financialInfo && financialInfo.person) {
      contextPrompt = `
You are Lendwise AI Assistant, representing lender Avinash.
The borrower contacting you is:
- Name: ${financialInfo.person.name}
- Phone: ${financialInfo.person.phone}
- Month: ${financialInfo.dueMonth}
- Scheduled EMI / Due Amount: ₹${financialInfo.totalDueAmount}
- Amount Paid So Far: ₹${financialInfo.totalPaidAmount}
- Remaining Balance Due: ₹${financialInfo.remainingAmount}
- Due Date: ${financialInfo.dueDate || '1st of the month'}
- Payment UPI ID: ${financialInfo.upiId}

Borrower asked: "${userMessage}"

INSTRUCTIONS:
1. Be polite, friendly, and professional.
2. Directly answer their question using the factual details above.
3. Show their remaining due amount and due date clearly.
4. Include the UPI ID (${financialInfo.upiId}) if they ask about payment or how to pay.
5. Keep response concise for WhatsApp. Use clear formatting and emojis.
`;
    } else {
      contextPrompt = `
You are Lendwise AI Assistant, representing lender Avinash.
A contact with phone number ${senderPhone} sent a message: "${userMessage}"

However, their phone number is NOT listed in the active borrower database.

INSTRUCTIONS:
1. Politely inform them that their phone number (${senderPhone}) is not registered in our Lendwise borrower records.
2. Provide Avinash's contact info or ask them to confirm if they are messaging from a different registered mobile number.
3. Keep response concise, friendly, and helpful for chat.
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
      return `Hi *${financialInfo.person.name}* 👋\n\nYour current due summary for *${financialInfo.dueMonth}*:\n• Total Due: ₹${financialInfo.totalDueAmount}\n• Paid: ₹${financialInfo.totalPaidAmount}\n• *Remaining Balance:* ₹${financialInfo.remainingAmount}\n• Due Date: ${financialInfo.dueDate || '1st of the month'}\n\n💳 UPI ID: \`${financialInfo.upiId}\``;
    }
    return `Hi! Thank you for reaching out to Lendwise. Please contact Avinash to verify your registered mobile number.`;
  } catch (error: any) {
    console.error('Error in handleBorrowerAIQuery:', error);
    return `⚠️ Sorry, I encountered an issue retrieving your due information. Please try again shortly.`;
  }
}
