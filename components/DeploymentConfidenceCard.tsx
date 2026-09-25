import type { DeploymentConfidenceResult } from '@/types';

export function DeploymentConfidenceCard({ confidence }: { confidence: DeploymentConfidenceResult | null }) {
  if (!confidence) return null;

  return (
    <section className="glass-panel rounded-[24px] p-6 border border-[rgba(176,123,79,0.22)] bg-[#f5efe7]/45 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-[#2b2622]">Deployment confidence</h3>
          <p className="text-sm text-[#8f8175] font-semibold">Decision support for shipping safely.</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-[#2b2622]">{Math.round(confidence.deploymentConfidence)}</div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#8f1d1d] font-black">{confidence.deploymentRecommendation}</div>
        </div>
      </div>
      
      <div className="grid gap-3 md:grid-cols-2 text-sm text-[#6b5b4d]">
        <Info label="Production readiness" value={confidence.productionReadiness} />
        <Info label="Customer risk" value={confidence.customerRiskLevel} />
        <Info label="Operational stability" value={confidence.operationalStability} />
        <Info label="Architecture health" value={confidence.architectureHealth} />
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-[#6b5b4d]">
        {confidence.factors.map((factor) => (
          <span key={factor} className="rounded-full bg-[#efe8de]/80 border-2 border-[rgba(176,122,77,0.25)] px-3 py-1 font-bold shadow-sm">
            {factor}
          </span>
        ))}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#efe8de]/60 border border-[rgba(176,122,77,0.08)] p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#8f8175] font-extrabold">{label}</div>
      <div className="mt-1 text-[#6b5b4d] font-bold">{value}</div>
    </div>
  );
}
