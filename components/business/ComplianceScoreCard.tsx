import type { AnalysisRecord, DebtNode } from '@/types';
import { calculateComplianceReadinessScore } from '@/lib/business-intelligence/compliance-score';

export function ComplianceScoreCard({ analysis, nodes }: { analysis: AnalysisRecord | null; nodes: DebtNode[] }) {
  if (!analysis) return null;

  const securityFindings = nodes.flatMap((node) => node.security_findings ?? []);
  const readiness = calculateComplianceReadinessScore({
    securityFindings,
    vulnerabilityCount: analysis.security_summary?.totalVulnerabilities ?? securityFindings.length,
    exploitabilityScore: analysis.repo_exploitability_score ?? 0,
    trustScore: analysis.trustScore ?? analysis.repo_security_score ?? 0,
    deploymentConfidence: analysis.deploymentConfidence ?? 0,
    criticalVulnerabilityCount: analysis.critical_vulnerabilities ?? 0,
  });

  return (
    <section className="rounded-[24px] border border-[rgba(176,123,79,0.2)] bg-[#fffaf5]/70 p-6 shadow-sm space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#8f8175] font-black">Compliance Readiness</p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-[#2b2622]">Compliance readiness score</h3>
          <p className="mt-1 text-sm font-semibold text-[#8f8175]">Executive-friendly governance posture derived from current findings.</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-black text-[#2b2622]">{readiness.score}%</div>
          <div className="text-xs uppercase tracking-[0.22em] text-[#8f8175] font-black">{readiness.grade}</div>
        </div>
      </div>

      <p className="text-sm leading-relaxed font-medium text-[#6b5b4d]">{readiness.status}</p>
    </section>
  );
}