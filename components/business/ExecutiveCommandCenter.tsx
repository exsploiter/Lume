import type { AnalysisRecord, BusinessTranslationResult, ConsequencePredictionResult, DeploymentConfidenceResult, TrustScoreResult } from '@/types';
import { SoftwareCreditRating } from '@/components/business/SoftwareCreditRating';
import { DeploymentGate } from '@/components/business/DeploymentGate';
import { calculateSoftwareCreditRating } from '@/lib/business-intelligence/software-credit-rating';
import { calculateDeploymentGate } from '@/lib/business-intelligence/deployment-gate';

type ExecutiveCommandCenterProps = {
  analysis: AnalysisRecord | null;
  trust: TrustScoreResult | null;
  deploymentConfidence: DeploymentConfidenceResult | null;
  businessTranslations: BusinessTranslationResult[];
  consequenceForecast?: ConsequencePredictionResult | null;
};

export function ExecutiveCommandCenter({
  analysis,
  trust,
  deploymentConfidence,
  businessTranslations,
  consequenceForecast,
}: ExecutiveCommandCenterProps) {
  if (!analysis) return null;

  const trustScore = trust?.trustScore ?? analysis.trustScore ?? analysis.repo_security_score ?? 0;
  const deploymentScore = deploymentConfidence?.deploymentConfidence ?? analysis.deploymentConfidence ?? 0;
  const exploitabilityScore = analysis.repo_exploitability_score ?? 0;
  const collapseRisk = analysis.collapse_prediction?.collapseProbability ?? analysis.collapse_score ?? 0;
  const criticalVulnerabilities = analysis.critical_vulnerabilities ?? 0;

  const rating = calculateSoftwareCreditRating({
    trustScore,
    deploymentConfidence: deploymentScore,
    exploitabilityScore,
    collapseRisk,
    criticalVulnerabilityCount: criticalVulnerabilities,
  });

  const gate = calculateDeploymentGate({
    deploymentConfidence: deploymentScore,
    criticalVulnerabilities,
    exploitabilityScore,
    collapseRisk,
  });

  const topBusinessRisk = determineTopBusinessRisk({
    analysis,
    businessTranslations,
    consequenceForecast,
    gateState: gate.state,
    exploitabilityScore,
    collapseRisk,
  });

  const executiveSummary = summarizeExecutiveMessage({
    analysis,
    trustScore,
    deploymentScore,
    topBusinessRisk,
    businessTranslations,
  });

  return (
    <section className="rounded-[28px] border border-[rgba(176,123,79,0.24)] bg-gradient-to-br from-[#fffaf5] via-[#f7f0e8] to-[#efe4d5] p-6 shadow-sm space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.24em] text-[#8f8175] font-black">Executive Command Center</p>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#2b2622]">Business View at a glance</h2>
          <p className="text-sm sm:text-base font-medium leading-relaxed text-[#6b5b4d]">
            {executiveSummary}
          </p>
        </div>
        <div className="rounded-2xl border border-[rgba(176,123,79,0.14)] bg-[#fffdf9]/80 px-4 py-3 text-right shadow-sm">
          <div className="text-xs uppercase tracking-[0.22em] text-[#8f8175] font-black">Trust Score</div>
          <div className="text-3xl font-black text-[#2b2622]">{Math.round(trustScore)}</div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr_0.95fr] items-start">
        <SoftwareCreditRating rating={rating} />

        <section className="rounded-[24px] border border-[rgba(176,123,79,0.2)] bg-[#fffaf5]/70 p-6 shadow-sm space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[#8f8175] font-black">Deployment Recommendation</p>
            <h3 className="mt-2 text-3xl font-black tracking-tight text-[#2b2622]">{deploymentConfidence?.deploymentRecommendation ?? gate.state}</h3>
            <p className="mt-1 text-sm font-bold text-[#8f8175]">{deploymentConfidence?.productionReadiness ?? 'Decision support based on current executive signals.'}</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 text-sm text-[#6b5b4d]">
            <Metric label="Trust score" value={Math.round(trustScore)} />
            <Metric label="Deployment confidence" value={Math.round(deploymentScore)} />
            <Metric label="Critical vulnerabilities" value={criticalVulnerabilities} />
            <Metric label="Collapse risk" value={Math.round(collapseRisk)} />
          </div>

          <div className="rounded-2xl border border-[rgba(176,123,79,0.08)] bg-[#efe8de]/65 px-4 py-3 text-sm font-semibold text-[#6b5b4d]">
            Top business risk: <span className="font-black text-[#2b2622]">{topBusinessRisk}</span>
          </div>
        </section>

        <DeploymentGate gate={gate} />
      </div>
    </section>
  );
}

function determineTopBusinessRisk({
  analysis,
  businessTranslations,
  consequenceForecast,
  gateState,
  exploitabilityScore,
  collapseRisk,
}: {
  analysis: AnalysisRecord;
  businessTranslations: BusinessTranslationResult[];
  consequenceForecast?: ConsequencePredictionResult | null;
  gateState: string;
  exploitabilityScore: number;
  collapseRisk: number;
}): string {
  const riskCandidates = [
    analysis.businessRisks?.[0],
    businessTranslations[0]?.customerImpact,
    businessTranslations[0]?.operationalRisk,
    consequenceForecast?.productionRisk,
    consequenceForecast?.customerRisk,
    gateState === 'DO NOT DEPLOY' || gateState === 'HIGH RISK' ? 'Service Outage Risk' : null,
    exploitabilityScore >= 70 ? 'High Exploitability' : null,
    collapseRisk >= 70 ? 'Security Collapse Risk' : null,
    analysis.critical_vulnerabilities > 0 ? 'Authentication Risk' : null,
    analysis.customerImpact?.[0],
    analysis.operationalRisks?.[0],
  ]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));

  return riskCandidates[0] ?? 'Operational Instability';
}

function summarizeExecutiveMessage({
  analysis,
  trustScore,
  deploymentScore,
  topBusinessRisk,
  businessTranslations,
}: {
  analysis: AnalysisRecord;
  trustScore: number;
  deploymentScore: number;
  topBusinessRisk: string;
  businessTranslations: BusinessTranslationResult[];
}): string {
  const source = analysis.executiveSummary ?? businessTranslations[0]?.executiveSummary ?? '';
  const sentences = source
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (sentences.length > 0) {
    return sentences.join(' ');
  }

  return `Repository health is currently ${trustScore >= 80 ? 'strong' : trustScore >= 60 ? 'steady' : 'under pressure'}, with ${topBusinessRisk.toLowerCase()} as the primary executive concern and deployment confidence at ${Math.round(deploymentScore)}/100.`;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-[#efe8de]/65 border border-[rgba(176,123,79,0.08)] p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#8f8175] font-extrabold">{label}</div>
      <div className="mt-1 text-lg font-black text-[#9a6a43]">{value}</div>
    </div>
  );
}