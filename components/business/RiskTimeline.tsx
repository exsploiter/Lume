import type { AnalysisRecord } from '@/types';
import { buildRiskTimeline } from '@/lib/business-intelligence/risk-timeline';

export function RiskTimeline({ analysis }: { analysis: AnalysisRecord | null }) {
  if (!analysis) return null;

  const timeline = buildRiskTimeline({
    trustScore: analysis.trustScore ?? analysis.repo_security_score ?? 0,
    securityScore: analysis.repo_security_score ?? 0,
    exploitabilityScore: analysis.repo_exploitability_score ?? 0,
    collapseRisk: analysis.collapse_prediction?.collapseProbability ?? analysis.collapse_score ?? 0,
    criticalVulnerabilityCount: analysis.critical_vulnerabilities ?? 0,
    deploymentConfidence: analysis.deploymentConfidence ?? 0,
  });

  return (
    <section className="rounded-[24px] border border-[rgba(176,123,79,0.2)] bg-[#fffaf5]/70 p-6 shadow-sm space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-[#8f8175] font-black">Risk Evolution Timeline</p>
        <h3 className="mt-2 text-2xl font-black tracking-tight text-[#2b2622]">Future risk without action</h3>
        <p className="mt-1 text-sm font-semibold text-[#8f8175]">Deterministic scenario progression derived from current repository signals.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <TimelineBlock label="Today" milestone={timeline.today} />
        <TimelineBlock label="30 Days" milestone={timeline.day30} />
        <TimelineBlock label="60 Days" milestone={timeline.day60} />
        <TimelineBlock label="90 Days" milestone={timeline.day90} />
      </div>
    </section>
  );
}

function TimelineBlock({ label, milestone }: { label: string; milestone: { statement: string; severity: string } }) {
  const severityClass =
    milestone.severity === 'LOW'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : milestone.severity === 'MEDIUM'
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : milestone.severity === 'HIGH'
          ? 'text-orange-700 bg-orange-50 border-orange-200'
          : 'text-rose-700 bg-rose-50 border-rose-200';

  return (
    <div className="rounded-2xl bg-[#efe8de]/65 border border-[rgba(176,123,79,0.08)] p-4 space-y-3">
      <div className="text-[10px] uppercase tracking-[0.22em] text-[#8f8175] font-black">{label}</div>
      <p className="text-sm font-semibold leading-relaxed text-[#2b2622]">{milestone.statement}</p>
      <div className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${severityClass}`}>
        {milestone.severity}
      </div>
    </div>
  );
}