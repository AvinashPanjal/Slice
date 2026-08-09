import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to match person by name (English, Manglish, or Malayalam script)
function matchPersonByName(cleanText: string, peopleList: any[]) {
  if (!peopleList || peopleList.length === 0) return null;

  // 1. Direct exact or substring match
  let found = peopleList.find((p) => cleanText.includes(p.name.toLowerCase()));
  if (found) return found;

  // 2. First name match (e.g. "Abin" from "Abin V")
  found = peopleList.find((p) => {
    const firstName = p.name.split(' ')[0].toLowerCase();
    return firstName.length >= 3 && cleanText.includes(firstName);
  });
  if (found) return found;

  // 3. Common Malayalam transliterated script to English alias mapping
  const malayalamNameMap: Record<string, string[]> = {
    'ആബിൻ': ['abin', 'abhin'],
    'അബിൻ': ['abin', 'abhin'],
    'കൊച്ചു': ['kochu'],
    'ശിവൻ': ['sivan'],
    'ആനന്ദ്': ['anand'],
    'സുനിൽ': ['sunil'],
    'വിനോദ്': ['vinod'],
    'അരുൺ': ['arun'],
    'രാഹുൽ': ['rahul'],
    'വിഷ്ണു': ['vishnu'],
  };

  for (const p of peopleList) {
    const pLower = p.name.toLowerCase();
    for (const [mlScript, aliases] of Object.entries(malayalamNameMap)) {
      if (aliases.some((a) => pLower.includes(a)) && cleanText.includes(mlScript)) {
        return p;
      }
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, customApiKey, language = 'ml-IN', clientLedgerData } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    // Use client-provided live authenticated database records if available, otherwise fetch from Supabase
    let people = clientLedgerData?.people;
    let loans = clientLedgerData?.loans;
    let dues = clientLedgerData?.dues;

    if (!people || !loans || !dues) {
      const [{ data: dbPeople }, { data: dbLoans }, { data: dbDues }] = await Promise.all([
        supabase.from('people').select('*'),
        supabase.from('loans').select('*'),
        supabase.from('monthly_dues').select('*'),
      ]);
      people = people || dbPeople || [];
      loans = loans || dbLoans || [];
      dues = dues || dbDues || [];
    }

    const cleanPrompt = prompt.toLowerCase().trim();
    const matchedPerson = matchPersonByName(cleanPrompt, people);

    const contextData = {
      targetPerson: matchedPerson
        ? {
            id: matchedPerson.id,
            name: matchedPerson.name,
            phone: matchedPerson.phone,
            dues: dues.filter((d: any) => d.person_id === matchedPerson.id),
            loans: loans.filter((l: any) => l.person_id === matchedPerson.id),
          }
        : null,
      allPeople: people.map((p: any) => {
        const pDues = dues.filter((d: any) => d.person_id === p.id);
        const pLoans = loans.filter((l: any) => l.person_id === p.id);
        const totalDue = pDues.reduce((sum: number, d: any) => sum + Number(d.current_amount || 0), 0);
        return { id: p.id, name: p.name, phone: p.phone, totalPendingDue: totalDue, activeLoansCount: pLoans.length };
      }),
    };

    let actionTaken: string | null = null;
    let actionDetails: any = null;

    // Check if user is asking to record a payment or mark due paid
    const isPaymentAction =
      cleanPrompt.includes('paid') ||
      cleanPrompt.includes('pay') ||
      cleanPrompt.includes('തന്നു') ||
      cleanPrompt.includes('അടച്ചു') ||
      cleanPrompt.includes('നൽകി') ||
      cleanPrompt.includes('ക അടച്ചു') ||
      cleanPrompt.includes('rs');

    // Extract amount if present
    const amountMatch = cleanPrompt.match(/(\d+)\s*(rs|rupees|രൂപ)?/i) || cleanPrompt.match(/(rs|rupees|രൂപ)\s*(\d+)/i);
    let extractedAmount = amountMatch ? parseFloat(amountMatch[1] || amountMatch[2]) : null;

    if (isPaymentAction && matchedPerson) {
      // Find active due/loan for this person
      const personDues = dues.filter(
        (d: any) => d.person_id === matchedPerson.id && d.status !== 'PAID' && d.status !== 'WAIVED'
      );
      const personLoans = loans.filter((l: any) => l.person_id === matchedPerson.id && l.status === 'ACTIVE');

      const targetDue = personDues[0];
      const targetLoan = personLoans[0];

      if (targetDue || targetLoan) {
        const paymentAmount = extractedAmount || (targetDue ? Number(targetDue.current_amount) : Number(targetLoan?.original_amount || 0));
        const paymentDate = new Date().toISOString().split('T')[0];

        // Insert payment into Supabase
        const { data: newPayment, error: pError } = await supabase
          .from('payments')
          .insert({
            person_id: matchedPerson.id,
            loan_id: targetLoan?.id || targetDue?.loan_id,
            monthly_due_id: targetDue?.id || null,
            amount: paymentAmount,
            payment_date: paymentDate,
            payment_method: 'CASH',
            notes: `Recorded via Malayalam Voice AI (${prompt})`,
          })
          .select()
          .single();

        if (newPayment && !pError) {
          // Insert payment allocation
          await supabase.from('payment_allocations').insert({
            payment_id: newPayment.id,
            loan_id: targetLoan?.id || targetDue?.loan_id,
            monthly_due_id: targetDue?.id || null,
            amount: paymentAmount,
            allocation_type: targetDue ? 'DUE_PAYMENT' : 'PRINCIPAL_REDUCTION',
          });

          // Update Monthly Due status
          if (targetDue) {
            const isFull = paymentAmount >= Number(targetDue.current_amount);
            await supabase
              .from('monthly_dues')
              .update({
                status: isFull ? 'PAID' : 'PARTIALLY_PAID',
                current_amount: Math.max(0, Number(targetDue.current_amount) - paymentAmount),
              })
              .eq('id', targetDue.id);
          }

          actionTaken = 'RECORD_PAYMENT';
          actionDetails = {
            personName: matchedPerson.name,
            amount: paymentAmount,
            isFull: targetDue ? paymentAmount >= Number(targetDue.current_amount) : true,
          };
        }
      }
    }

    // Call Google Gemini API for natural Malayalam / Manglish response generation
    let aiResponseText = '';

    if (apiKey) {
      try {
        const systemInstruction = `You are LendWise Malayalam Voice AI Assistant, an expert personal ledger manager.
The user speaks to you in Malayalam, Manglish, or English.
User Question/Command: "${prompt}".
${matchedPerson ? `MATCHED PERSON IN LEDGER: Name: "${matchedPerson.name}" (ID: ${matchedPerson.id}).` : 'NO SPECIFIC PERSON MATCHED IN PROMPT.'}
Live Database Ledger Context: ${JSON.stringify(contextData)}
${actionTaken ? `ACTION ALREADY EXECUTED: ${JSON.stringify(actionDetails)}.` : ''}

Crucial Rules:
1. If a person was matched (e.g. "${matchedPerson?.name || 'Abin'}"), answer SPECIFICALLY about that person's due amount and status. DO NOT talk about total due unless explicitly asked for overall summary!
2. If payment action was taken (e.g. ₹100 for Abin), confirm it clearly in Malayalam: "${matchedPerson?.name || 'ആബിൻ'}ന്റെ ₹${actionDetails?.amount || 100} പേയ്‌മെന്റ് രേഖപ്പെടുത്തി. നന്ദി!".
3. Keep spoken responses short, friendly, and concise under 2 sentences in natural Malayalam.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemInstruction }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 250 },
            }),
          }
        );

        const resData = await response.json();
        aiResponseText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch (geminiErr) {
        console.error('Gemini API call failed:', geminiErr);
      }
    }

    // Fallback response generator if Gemini returned empty or key was omitted
    if (!aiResponseText) {
      if (actionTaken === 'RECORD_PAYMENT' && actionDetails) {
        aiResponseText = `${actionDetails.personName}ന്റെ ₹${actionDetails.amount} പേയ്‌മെന്റായി വിജയകരമായി രേഖപ്പെടുത്തി.`;
      } else if (matchedPerson) {
        const personDues = dues.filter(
          (d: any) => d.person_id === matchedPerson.id && d.status !== 'PAID' && d.status !== 'WAIVED'
        );
        const personLoans = loans.filter(
          (l: any) => l.person_id === matchedPerson.id && l.status === 'ACTIVE'
        );
        const totalPendingDue = personDues.reduce((sum: number, d: any) => sum + Number(d.current_amount || 0), 0);
        const totalLoanAmt = personLoans.reduce((sum: number, l: any) => sum + Number(l.original_amount || 0), 0);

        if (totalPendingDue > 0) {
          aiResponseText = `${matchedPerson.name}ന് നിലവിൽ ₹${totalPendingDue} ആണ് ഈ മാസത്തെ ബാക്കി കുടിശ്ശിക തുക.`;
        } else if (totalLoanAmt > 0) {
          aiResponseText = `${matchedPerson.name}ന്റെ ഈ മാസത്തെ കുടിശ്ശിക പൂർണ്ണമായി അടച്ചു തീർത്തിട്ടുണ്ട്.`;
        } else {
          aiResponseText = `${matchedPerson.name}ന് നിലവിൽ കുടിശ്ശികയൊന്നുമില്ല.`;
        }
      } else {
        const totalDue = dues
          .filter((d: any) => d.status !== 'PAID')
          .reduce((sum: number, d: any) => sum + Number(d.current_amount || 0), 0);
        aiResponseText = `ഈ മാസത്തെ ആകെ കുടിശ്ശിക തുക ₹${totalDue} ആണ്. നിർദ്ദിഷ്ട ആളുടെ വിവരം അറിയാൻ പേര് പറയൂ.`;
      }
    }

    return NextResponse.json({
      success: true,
      prompt,
      response: aiResponseText,
      actionTaken,
      actionDetails,
      matchedPerson: matchedPerson ? matchedPerson.name : null,
    });
  } catch (err: any) {
    console.error('AI Assistant API Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process AI query' },
      { status: 500 }
    );
  }
}
