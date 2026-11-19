import { NextResponse } from 'next/server';
import { validateAiAuth } from '@/lib/ai/auth';
import { searchPerson } from '@/lib/ai/data-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = validateAiAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dynamicKey = searchParams.get('supabase_key') || request.headers.get('x-supabase-key') || undefined;
    const query = searchParams.get('name') || searchParams.get('query') || searchParams.get('phone') || '';
    const result = await searchPerson(query, dynamicKey);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
