import type { AutoFixResult } from '@/types';
import { Sparkles } from 'lucide-react';

export function AutoFixPanel({ result }: { result: AutoFixResult | null }) {
  if (!result) return null;
  return (
    <section className="glass-panel rounded-[24px] p-6 border border-[rgba(176,122,77,0.14)] bg-[#f5efe7]/45 shadow-sm space-y-5">
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#93ab68]/15 flex items-center justify-center border border-[#93ab68]/20 shrink-0">
            <Sparkles className="w-5 h-5 text-[#68823c]" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">Autofix Proposal</h3>
            <p className="text-xs text-slate-500 font-bold mt-0.5">AI-backed repair candidate for the selected vulnerability.</p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-[#fffdf9] border border-[rgba(176,122,77,0.1)] rounded-2xl px-4 py-2.5 shadow-sm">
          <div className="text-right">
            <div className="text-2xl font-black text-[#9a6a43] font-mono leading-none">{Math.round(result.confidence * 100)}%</div>
            <div className="text-[8px] font-black uppercase tracking-wider text-slate-400 mt-1">Confidence</div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div className="text-right">
            <div className="text-2xl font-black text-[#93ab68] font-mono leading-none">{Math.round(result.estimatedRiskReduction)}</div>
            <div className="text-[8px] font-black uppercase tracking-wider text-[#68823c] mt-1">Risk Reduction</div>
          </div>
        </div>
      </div>

      {/* Summary Box */}
      <div className="text-xs text-slate-700 leading-relaxed font-bold bg-[#fffdf9]/70 border border-[rgba(176,122,77,0.1)] rounded-2xl p-4">
        <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#9a6a43] block mb-1">PROPOSAL SUMMARY</span>
        {result.summary}
      </div>

      {/* Code Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Before (Vulnerable Code) */}
        <div className="flex flex-col rounded-2xl border border-red-200 bg-red-50/10 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-red-50/60 border-b border-red-100">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-700">Original Vulnerable Code</span>
            </div>
            <span className="text-[9px] font-black text-red-400 uppercase font-mono">Before</span>
          </div>
          {/* Code */}
          <pre className="p-4 overflow-auto text-[11px] font-mono leading-relaxed text-red-950 bg-[#fffcfb] h-[320px]">
            <code>{result.beforeCode}</code>
          </pre>
        </div>

        {/* After (Remediated Code) */}
        <div className="flex flex-col rounded-2xl border border-[#93ab68]/20 bg-[#93ab68]/5 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#93ab68]/10 border-b border-[#93ab68]/15">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#93ab68]" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#68823c]">Suggested Remediation</span>
            </div>
            <span className="text-[9px] font-black text-[#68823c] uppercase font-mono">After</span>
          </div>
          {/* Code */}
          <pre className="p-4 overflow-auto text-[11px] font-mono leading-relaxed text-slate-800 bg-[#f9fbf7] h-[320px]">
            <code>{result.afterCode}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
