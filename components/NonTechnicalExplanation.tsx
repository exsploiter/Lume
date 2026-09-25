import type { BusinessTranslationResult } from '@/types';

export function NonTechnicalExplanation({ translation }: { translation: BusinessTranslationResult | null }) {
  if (!translation) return null;

  return (
    <section className="glass-panel rounded-[24px] p-6 border border-[rgba(176,123,79,0.22)] bg-[#f5efe7]/45 shadow-sm space-y-4">
      <div>
        <h4 className="text-base font-extrabold text-[#2b2622]">Business explanation</h4>
        <p className="text-sm text-[#8f8175] font-semibold">Plain language summary for non-technical stakeholders.</p>
      </div>
      <p className="text-sm text-[#6b5b4d] leading-relaxed font-semibold">{translation.executiveSummary}</p>
      
      <div className="grid gap-3 text-sm text-[#6b5b4d] md:grid-cols-2">
        <Line label="Customer impact" value={translation.customerImpact} />
        <Line label="Operational risk" value={translation.operationalRisk} />
        <Line label="Financial risk" value={translation.financialRisk} />
        <Line label="Recommended action" value={translation.recommendedAction} />
      </div>
    </section>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#efe8de]/60 border border-[rgba(176,122,77,0.08)] p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#8f8175] font-extrabold">{label}</div>
      <div className="mt-1 text-[#6b5b4d] font-bold leading-relaxed">{value}</div>
    </div>
  );
}
