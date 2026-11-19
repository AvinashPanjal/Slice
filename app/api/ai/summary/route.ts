import { NextResponse } from 'next/server';
import { validateAiAuth } from '@/lib/ai/auth';
import { getDashboardSummary } from '@/lib/ai/data-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = validateAiAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  try {
    const summary = await getDashboardSummary();
    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
