'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Github, Radar, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/');
      setChecking(false);
    });
  }, [router]);

  const signInWithGitHub = async () => {
    setLoading(true);
    const supabase = createClient();
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo,
        scopes: 'repo',
      },
    });
    if (error) {
      alert(error.message);
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#b07b4f]" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-24 fade-in-up">
      <div className="glass-panel rounded-3xl p-8 text-center border border-[rgba(176,123,79,0.12)] shadow-md bg-white/40">
        <Radar className="w-12 h-12 text-[#b07b4f] mx-auto mb-4" />
        <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Sign in to DebtRadar</h1>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed font-semibold">
          Connect your GitHub account via Supabase OAuth to save analyses and
          access private repositories.
        </p>
        <button
          type="button"
          onClick={signInWithGitHub}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#b07b4f] to-[#8c6239] hover:from-[#8c6239] hover:to-[#5f5348] text-white py-3.5 px-6 rounded-xl font-bold transition-all shadow-[0_4px_12px_rgba(176,123,79,0.15)] hover:shadow-[0_6px_16px_rgba(176,123,79,0.25)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Github className="w-5 h-5" />
          )}
          <span>Continue with GitHub</span>
        </button>
        <p className="text-[11px] text-slate-400 font-medium mt-6 leading-normal">
          Configure GitHub provider in Supabase Dashboard → Authentication → Providers
        </p>
      </div>
    </div>
  );
}
