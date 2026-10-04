'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, ShieldAlert, CheckCircle2, AlertTriangle, Layers, Flame } from 'lucide-react';
import { DEMO_PRESETS, DemoPresetMeta } from '@/lib/demo/demo-types';

export function SampleRepoSelector() {
  const router = useRouter();
  const [loadingPreset, setLoadingPreset] = useState<string | null>(null);

  async function handleSelectPreset(presetId: DemoPresetMeta['id']) {
    try {
      setLoadingPreset(presetId);
      const res = await fetch(`/api/demo/preset/${presetId}`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to load demo preset');
      const data = await res.json();
      router.push(data.redirectUrl || `/analyze/${data.analysisId}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error loading demo');
      setLoadingPreset(null);
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 space-y-4">
      <div className="flex items-center justify-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">
        <Sparkles className="w-4 h-4 text-[#9a6a43]" />
        <span>Or Explore Pre-Analyzed Interactive Repositories (1-Click Demo)</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {DEMO_PRESETS.map((preset) => {
          const isLoading = loadingPreset === preset.id;
          const Icon =
            preset.id === 'fintech-core-banking'
              ? ShieldAlert
              : preset.id === 'cloud-native-saas'
              ? AlertTriangle
              : CheckCircle2;

          return (
            <button
              key={preset.id}
              onClick={() => handleSelectPreset(preset.id)}
              disabled={loadingPreset !== null}
              className={`p-4 rounded-2xl border text-left transition-all duration-200 bg-white/80 hover:bg-white hover:border-[#9a6a43]/50 hover:shadow-md active:scale-[0.98] group flex flex-col justify-between ${
                isLoading ? 'opacity-75 ring-2 ring-[#9a6a43]' : 'border-slate-200/80'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${preset.badgeColor}`}>
                    {preset.badge}
                  </span>
                  <Icon className={`w-4 h-4 ${
                    preset.id === 'fintech-core-banking'
                      ? 'text-rose-500'
                      : preset.id === 'cloud-native-saas'
                      ? 'text-amber-500'
                      : 'text-emerald-500'
                  }`} />
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-900 group-hover:text-[#9a6a43] transition-colors">
                    {preset.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5 line-clamp-2">
                    {preset.tagline}
                  </p>
                </div>

                <div className="space-y-1 pt-1">
                  {preset.highlightFeatures.slice(0, 2).map((feat, i) => (
                    <div key={i} className="text-[10px] text-slate-600 font-semibold flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-[#9a6a43]" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#9a6a43]">
                <span>{isLoading ? 'Loading Demo...' : 'Launch Analysis'}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
