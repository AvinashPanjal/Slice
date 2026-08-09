import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin/server client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, customApiKey, language = 'ml-IN' } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const apiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    // Fetch current financial state from Supabase to provide context to Gemini
    const { data: people } = await supabase.from('people').select('*');
    const { data: loans } = await supabase.from('loans').select('*');
    const { data: dues } = await supabase.from('monthly_dues').select('*');
    const { data: allocations } = await supabase.from('payment_allocations').select('*');

    const contextData = {
      peopleList: (people || []).map((p) => ({ id: p.id, name: p.name, phone: p.phone })),
      loansSummary: (loans || []).map((l) => ({ id: l.id, person_id: l.person_id, amount: l.original_amount, status: l.status })),
      activeDues: (dues || []).map((d) => ({
        id: d.id,
        person_id: d.person_id,
        loan_id: d.loan_id,
        due_month: d.due_month,
        due_date: d.due_date,
        original_amount: d.original_amount,
        current_amount: d.current_amount,
        status: d.status,
      })),
    };

    let actionTaken: string | null = null;
    let actionDetails: any = null;

    // Direct Intent Parsing for Financial Actions (e.g. "Abin 100 rs paid", "Mark Abin due paid", etc.)
    const cleanPrompt = prompt.toLowerCase().trim();
    
    // Check if user is asking to record a payment or mark due paid
    const isPaymentAction =
      cleanPrompt.includes('paid') ||
      cleanPrompt.includes('pay') ||
      cleanPrompt.includes('തന്നു') ||
      cleanPrompt.includes('അടച്ചു') ||
      cleanPrompt.includes('നൽകി') ||
      cleanPrompt.includes('ക അടച്ചു') ||
      cleanPrompt.includes('rs');

    // Extract person name from prompt
    let matchedPerson = (people || []).find((p) =>
      cleanPrompt.includes(p.name.toLowerCase())
    );

    // Extract amount if present
    const amountMatch = cleanPrompt.match(/(\d+)\s*(rs|rupees|രൂപ)?/i) || cleanPrompt.match(/(rs|rupees|രൂപ)\s*(\d+)/i);
    let extractedAmount = amountMatch ? parseFloat(amountMatch[1] || amountMatch[2]) : null;

    if (isPaymentAction && matchedPerson) {
      // Find active due/loan for this person
      const personDues = (dues || []).filter(
        (d) => d.person_id === matchedPerson.id && d.status !== 'PAID' && d.status !== 'WAIVED'
      );
      const personLoans = (loans || []).filter((l) => l.person_id === matchedPerson.id && l.status === 'ACTIVE');

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
The user speaks to you in Malayalam, Manglish (Malayalam written in Latin script), or English.
Analyze the user's input: "${prompt}".
Current Ledger Database Context: ${JSON.stringify(contextData)}
${actionTaken ? `An action was ALREADY executed in the system: ${JSON.stringify(actionDetails)}.` : ''}

Instructions:
1. Provide a helpful, clear, and polite response in Malayalam (and optionally Manglish/English).
2. If an action was taken (e.g. payment recorded for Abin), confirm it clearly in Malayalam (e.g., "${matchedPerson?.name || 'ആബിൻ'}ന്റെ ₹${actionDetails?.amount || 100} അടവ് രേഖപ്പെടുത്തി. നന്ദി!").
3. If the user asked about due amount (e.g. "Abin eethra tharaan und?"), extract their exact due amount from context and state it clearly.
4. Keep the response concise, friendly, and under 3 sentences for natural speech synthesis.`;

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: systemInstruction }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 250 },
            }),
          }
        );

        const resData = await response.json();
        aiResponseText =
          resData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch (geminiErr) {
        console.error('Gemini API call failed:', geminiErr);
      }
    }

    // Fallback response if Gemini API key was not provided or returned empty
    if (!aiResponseText) {
      if (actionTaken === 'RECORD_PAYMENT' && actionDetails) {
        aiResponseText = `${actionDetails.personName}ന്റെ ₹${actionDetails.amount} തുക പേയ്‌മെന്റായി വിജയകരമായി രേഖപ്പെടുത്തി. (${actionDetails.isFull ? 'പൂർണ്ണമായി അടച്ചു' : 'ഭാഗികമായി അടച്ചു'})`;
      } else if (matchedPerson) {
        const personDues = (dues || []).filter(
          (d) => d.person_id === matchedPerson.id && d.status !== 'PAID'
        );
        const totalPending = personDues.reduce((sum, d) => sum + Number(d.current_amount), 0);
        aiResponseText = `${matchedPerson.name}ന് നിലവിൽ ₹${totalPending} ആണ് ഈ മാസത്തെ ബാക്കി കുടിശ്ശിക തുക.`;
      } else {
        const totalDue = (dues || [])
          .filter((d) => d.status !== 'PAID')
          .reduce((sum, d) => sum + Number(d.current_amount), 0);
        aiResponseText = `ഈ മാസത്തെ ആകെ വരാനുള്ള കുടിശ്ശിക ₹${totalDue} ആണ്. കൂടുതൽ വിവരങ്ങൾക്ക് ആളുടെ പേര് പറയൂ.`;
      }
    }

    return NextResponse.json({
      success: true,
      prompt,
      response: aiResponseText,
      actionTaken,
      actionDetails,
    });
  } catch (err: any) {
    console.error('AI Assistant API Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process AI query' },
      { status: 500 }
    );
  }
}
