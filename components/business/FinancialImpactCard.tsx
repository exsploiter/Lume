import type { AnalysisRecord, DebtNode } from '@/types';
import { calculateFinancialImpact, formatIndianCurrency } from '@/lib/business-intelligence/financial-impact';

export function FinancialImpactCard({
  analysis,
  nodes,
}: {
  analysis: AnalysisRecord | null;
  nodes: DebtNode[];
}) {
  if (!analysis) return null;

  const blastRadius = nodes.length > 0
    ? Math.round(nodes.reduce((total, node) => total + node.blast_radius, 0) / nodes.length)
    : 0;

  const impact = calculateFinancialImpact({
    trustScore: analysis.trustScore ?? analysis.repo_security_score ?? 0,
    securityScore: analysis.repo_security_score ?? 0,
    exploitabilityScore: analysis.repo_exploitability_score ?? 0,
    collapseRisk: analysis.collapse_prediction?.collapseProbability ?? analysis.collapse_score ?? 0,
    blastRadius,
    criticalVulnerabilityCount: analysis.critical_vulnerabilities ?? 0,
    deploymentConfidence: analysis.deploymentConfidence ?? 0,
  });

  const toneClass =
    impact.riskLevel === 'LOW'
      ? 'text-emerald-700'
      : impact.riskLevel === 'MEDIUM'
        ? 'text-amber-700'
        : impact.riskLevel === 'HIGH'
          ? 'text-orange-700'
          : 'text-rose-700';

  return (
    <section className="rounded-[24px] border border-[rgba(176,123,79,0.2)] bg-[#fffaf5]/70 p-6 shadow-sm space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-[#8f8175] font-black">Financial Impact Analysis</p>
        <h3 className="mt-2 text-2xl font-black tracking-tight text-[#2b2622]">Rupee Impact Calculator</h3>
        <p className="mt-1 text-sm font-semibold text-[#8f8175]">Executive cost exposure based on current risk posture.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 text-sm text-[#6b5b4d]">
        <Metric label="Estimated Fix Cost" value={formatIndianCurrency(impact.estimatedFixCost)} />
        <Metric label="Potential Incident Exposure" value={formatIndianCurrency(impact.estimatedIncidentExposure)} />
        <Metric label="Operational Exposure" value={formatIndianCurrency(impact.estimatedOperationalExposure)} />
        <Metric label="Risk Level" value={impact.riskLevel} toneClass={toneClass} />
      </div>
    </section>
  );
}

function Metric({ label, value, toneClass }: { label: string; value: string; toneClass?: string }) {
  return (
    <div className="rounded-2xl bg-[#efe8de]/65 border border-[rgba(176,123,79,0.08)] p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#8f8175] font-extrabold">{label}</div>
      <div className={`mt-1 text-lg font-black ${toneClass ?? 'text-[#2b2622]'}`}>{value}</div>
    </div>
  );
}