import type { TrustScoreResult } from '@/types';

export function TrustScoreCard({ trust }: { trust: TrustScoreResult | null }) {
  if (!trust) return null;

  return (
    <section className="glass-panel rounded-[24px] p-6 border border-[rgba(176,123,79,0.22)] bg-[#f5efe7]/45 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-[#2b2622]">Trust score</h3>
          <p className="text-sm text-[#8f8175] font-semibold">How trustworthy the repository is for production use.</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-[#2b2622]">{Math.round(trust.trustScore)}</div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#8f1d1d] font-black">{trust.recommendation}</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm text-[#6b5b4d]">
        <Metric label="Deployment confidence" value={Math.round(trust.deploymentConfidence)} />
        <Metric label="Operational stability" value={Math.round(trust.operationalStability)} />
        <Metric label="Security exposure" value={Math.round(trust.securityExposure)} />
        <Metric label="Architecture health" value={Math.round(trust.architectureHealth)} />
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-[#6b5b4d]">
        {trust.reasons.map((reason) => (
          <span key={reason} className="rounded-full bg-[#efe8de]/80 border-2 border-[rgba(176,122,77,0.25)] px-3 py-1 font-bold shadow-sm">
            {reason}
          </span>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-[#efe8de]/60 border border-[rgba(176,122,77,0.08)] p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#8f8175] font-extrabold">{label}</div>
      <div className="mt-1 text-lg font-black text-[#9a6a43]">{value}</div>
    </div>
  );
}
