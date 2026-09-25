import type { AnalysisRecord } from '@/types';

export function ExecutiveRiskCard({ analysis }: { analysis: AnalysisRecord | null }) {
  if (!analysis) return null;

  return (
    <section className="glass-panel rounded-[24px] p-6 border border-[rgba(176,123,79,0.22)] bg-[#f5efe7]/45 shadow-sm space-y-4">
      <div>
        <h3 className="text-lg font-extrabold text-[#2b2622]">Executive risk summary</h3>
        <p className="text-sm text-[#8f8175] font-semibold">A concise trust and deployment view for decision makers.</p>
      </div>
      <p className="text-sm text-[#6b5b4d] leading-relaxed font-semibold">{analysis.executiveSummary ?? 'Executive summary not yet available.'}</p>
      
      <div className="grid gap-3 md:grid-cols-4 text-sm text-[#6b5b4d]">
        <Metric label="Trust score" value={analysis.trustScore ?? 0} />
        <Metric label="Deployment confidence" value={analysis.deploymentConfidence ?? 0} />
        <Metric label="Operational risks" value={analysis.operationalRisks?.length ?? 0} />
        <Metric label="Customer impact" value={analysis.customerImpact?.length ?? 0} />
      </div>

      {analysis.deploymentRecommendation && (
        <div className="rounded-2xl bg-[#efe8de]/70 border border-[rgba(176,122,77,0.12)] px-4 py-3 text-sm font-bold text-[#6b5b4d]">
          Deployment recommendation: <span className="text-[#8f1d1d] font-black uppercase ml-1 tracking-wider">{analysis.deploymentRecommendation}</span>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-[#efe8de]/60 border border-[rgba(176,122,77,0.08)] p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#8f8175] font-extrabold">{label}</div>
      <div className="mt-1 text-[#9a6a43] font-black text-lg">{value}</div>
    </div>
  );
}
