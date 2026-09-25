'use client';

import { useViewMode } from '@/contexts/ViewModeContext';

export function RiskTranslationToggle() {
  const { mode, setMode } = useViewMode();

  return (
    <div className="inline-flex items-center rounded-2xl border border-[rgba(176,123,79,0.16)] bg-white/70 p-1 shadow-sm backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setMode('technical')}
        className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${mode === 'technical' ? 'bg-[#8c6239] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
      >
        Technical View
      </button>
      <button
        type="button"
        onClick={() => setMode('business')}
        className={`rounded-xl px-3 py-2 text-xs font-bold transition-all ${mode === 'business' ? 'bg-[#8c6239] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
      >
        Business View
      </button>
    </div>
  );
}
