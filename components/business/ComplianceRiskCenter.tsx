import type { AnalysisRecord, DebtNode } from '@/types';
import { buildComplianceRisk } from '@/lib/business-intelligence/compliance-risk';

export function ComplianceRiskCenter({ analysis, nodes }: { analysis: AnalysisRecord | null; nodes: DebtNode[] }) {
  if (!analysis) return null;

  const risk = buildComplianceRisk({ analysis, nodes });
  const toneClass =
    risk.overallRisk === 'LOW'
      ? 'text-emerald-700'
      : risk.overallRisk === 'MODERATE'
        ? 'text-amber-700'
        : risk.overallRisk === 'HIGH'
          ? 'text-orange-700'
          : 'text-rose-700';

  return (
    <section className="rounded-[24px] border border-[rgba(176,123,79,0.2)] bg-[#fffaf5]/70 p-6 shadow-sm space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-[#8f8175] font-black">Compliance Risk Center</p>
        <h3 className="mt-2 text-2xl font-black tracking-tight text-[#2b2622]">Governance exposure summary</h3>
        <p className="mt-1 text-sm font-semibold text-[#8f8175]">Risk mapping based on existing OWASP, CERT-In, DPDP, and governance signals.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr] items-start">
        <div className="rounded-2xl border border-[rgba(176,123,79,0.08)] bg-[#efe8de]/65 p-5 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#8f8175] font-extrabold">Overall Compliance Risk</div>
          <div className={`text-3xl font-black ${toneClass}`}>{risk.overallRisk}</div>
          <div className="text-xs uppercase tracking-[0.18em] text-[#8f8175] font-black">Compliance readiness score {risk.complianceReadinessScore}%</div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#8f8175] font-extrabold mb-2">Affected Categories</div>
            <div className="grid gap-3 md:grid-cols-2">
              {risk.complianceCategories.map((category) => (
                <div key={`${category.framework}-${category.exposure}`} className="rounded-2xl bg-[#efe8de]/65 border border-[rgba(176,123,79,0.08)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-black text-[#2b2622]">{category.framework}</div>
                    <div className={`text-[10px] uppercase tracking-[0.18em] font-black ${riskTone(category.risk)}`}>{category.risk}</div>
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[#8f8175] font-black">{category.exposure}</div>
                  <p className="mt-2 text-sm font-medium leading-relaxed text-[#6b5b4d]">{category.impact}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DetailBlock title="Critical Risks" items={risk.criticalComplianceRisks} emptyLabel="No critical compliance risks detected." />
        <DetailBlock title="Recommendations" items={risk.recommendations} emptyLabel="No additional recommendations." />
      </div>
    </section>
  );
}

function riskTone(risk: string): string {
  return risk === 'LOW'
    ? 'text-emerald-700'
    : risk === 'MODERATE'
      ? 'text-amber-700'
      : risk === 'HIGH'
        ? 'text-orange-700'
        : 'text-rose-700';
}

function DetailBlock({ title, items, emptyLabel }: { title: string; items: string[]; emptyLabel: string }) {
  return (
    <div className="rounded-2xl bg-[#efe8de]/65 border border-[rgba(176,123,79,0.08)] p-4 space-y-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#8f8175] font-extrabold">{title}</div>
      <div className="space-y-2">
        {items.length > 0 ? items.map((item) => (
          <div key={item} className="rounded-xl border border-[rgba(176,123,79,0.06)] bg-[#fffdf9]/80 px-3 py-2 text-sm font-medium text-[#6b5b4d]">
            {item}
          </div>
        )) : <div className="text-sm font-medium text-[#8f8175]">{emptyLabel}</div>}
      </div>
    </div>
  );
}