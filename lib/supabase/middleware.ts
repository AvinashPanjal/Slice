import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const pathname = request.nextUrl.pathname;

  // Fast-path bypass for static files, manifest, sw.js, and public assets
  const isPublicAsset =
    pathname === '/' ||
    pathname.startsWith('/pay') ||
    pathname.startsWith('/manifest') ||
    pathname.startsWith('/sw.js') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/_next') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.json') ||
    pathname.endsWith('.js');

  if (isPublicAsset) {
    return response;
  }

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  // Check if any Supabase session cookies exist
  const hasSupabaseCookie = request.cookies.getAll().some((c) => c.name.startsWith('sb-'));

  // Fast-path for unauthenticated users on protected routes (0ms delay, no network timeout)
  if (!hasSupabaseCookie && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Wrap Supabase Auth call with 2-second timeout guard to prevent Vercel 504 GATEWAY_TIMEOUT
  let user: any = null;
  try {
    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 2000));
    const userPromise = supabase.auth.getUser().then((res) => res.data?.user || null).catch(() => null);
    user = await Promise.race([userPromise, timeoutPromise]);
  } catch (e) {
    user = null;
  }

  // If user is not authenticated and trying to access protected routes
  if (!user && !isAuthRoute && hasSupabaseCookie) {
    // If auth call timed out or failed, allow request to continue so client-side Supabase auth can handle it without 504
    return response;
  }

  // If user is authenticated and trying to access login/signup
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}
