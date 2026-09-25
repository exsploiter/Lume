import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  
  try {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  } catch (err) {
    console.error('[SignOut] Error signing out of Supabase:', err);
  }

  const response = NextResponse.redirect(origin, { status: 303 });
  
  // Clear the GitHub provider token cookie
  response.cookies.set('sb-provider-token', '', {
    path: '/',
    maxAge: 0,
  });

  return response;
}
