'use client';

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Map, Download, AlertCircle, Radar, Github, Sparkles, FileCode, Activity, ShieldAlert, AlertTriangle, Home, FileText, Network, Milestone } from 'lucide-react';
import { HeatMap } from '@/components/HeatMap';
import { NodeSidebar } from '@/components/NodeSidebar';
import { FilterBar } from '@/components/FilterBar';
import { FingerprintCard } from '@/components/FingerprintCard';
import { LoadingState } from '@/components/LoadingState';
import { ProgressBar } from '@/components/ProgressBar';
import { SecurityCollapseBanner } from '@/components/SecurityCollapseBanner';
import { SecurityOverview } from '@/components/SecurityOverview';
import { AttackPropagationGraph } from '@/components/AttackPropagationGraph';
import { CollapsePredictionPanel } from '@/components/CollapsePredictionPanel';
import { AutoFixPanel } from '@/components/AutoFixPanel';
import { ExploitabilityBadge } from '@/components/ExploitabilityBadge';
import { ExecutiveRiskCard } from '@/components/ExecutiveRiskCard';
import { TrustScoreCard } from '@/components/TrustScoreCard';
import { DeploymentConfidenceCard } from '@/components/DeploymentConfidenceCard';
import { BusinessImpactPanel } from '@/components/BusinessImpactPanel';
import { ConsequenceForecast } from '@/components/ConsequenceForecast';
import { ExecutiveCommandCenter } from '@/components/business/ExecutiveCommandCenter';
import { FinancialImpactCard } from '@/components/business/FinancialImpactCard';
import { ComplianceScoreCard } from '@/components/business/ComplianceScoreCard';
import { ComplianceRiskCenter } from '@/components/business/ComplianceRiskCenter';
import { RiskTimeline } from '@/components/business/RiskTimeline';
import BoardReportCard from '@/components/business/BoardReportCard';
import { useViewMode } from '@/contexts/ViewModeContext';
import { buildBusinessImpactFromNode } from '@/lib/business-intelligence/business-impact';
import type {
  AnalysisRecord,
  DebtNode,
  GraphLink,
  FilterState,
  AutoFixResult,
  TrustScoreResult,
  DeploymentConfidenceResult,
  ConsequencePredictionResult,
  ViewMode,
} from '@/types';

interface AnalyzeClientProps {
  view?: ViewMode;
}

function AnalyzeContent({ view }: AnalyzeClientProps) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode } = useViewMode();
  const effectiveMode = view ?? mode;
  const analysisId = params.id as string;

  const [analysis, setAnalysis] = useState<AnalysisRecord | null>(null);
  const [nodes, setNodes] = useState<DebtNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [selected, setSelected] = useState<DebtNode | null>(null);
  const [autofixResult, setAutofixResult] = useState<AutoFixResult | null>(null);
  const [autofixLoading, setAutofixLoading] = useState(false);
  const [trustScore, setTrustScore] = useState<TrustScoreResult | null>(null);
  const [deploymentConfidence, setDeploymentConfidence] = useState<DeploymentConfidenceResult | null>(null);
  const [consequenceForecast, setConsequenceForecast] = useState<ConsequencePredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterState>({
    minScore: 0,
    maxScore: 100,
    nodeTypes: ['function', 'class', 'module', 'variable'],
    search: '',
    criticalSecurityOnly: false,
    owaspCategories: [],
    cweCategories: [],
    securityScoreThreshold: 0,
    secretLeaksOnly: false,
    injectionOnly: false,
    exploitableOnly: false,
    collapseCriticalOnly: false,
    attackPathOnly: false,
    publicExposureOnly: false,
    autofixAvailableOnly: false,
  });

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/analysis/${analysisId}?t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');

      console.log("Analysis API response:", data);
      if (data.analysis) {
        console.log("Polling update:", data.analysis.status, data.analysis.progress);
      }

      setAnalysis(data.analysis);
      setNodes(data.nodes ?? []);
      setLinks(data.links ?? []);
      setTrustScore(data.trustScore ?? null);
      setDeploymentConfidence(data.deploymentConfidence ?? null);
      setConsequenceForecast(data.consequenceForecast ?? null);

      if (data.analysis.status === 'failed') {
        setError(data.analysis.error_message ?? 'Analysis failed');
        return false;
      }
      return data.analysis.status !== 'complete';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed');
      return false;
    }
  }, [analysisId]);

  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout>;
    let currentDelay = 3000; // Start at 3 seconds (Requirement 6)

    const tick = async () => {
      if (!active) return;
      const shouldContinue = await poll();
      if (!active) return;
      if (shouldContinue) {
        // Exponential backoff: scale polling interval up to 15s max (Requirement 6)
        currentDelay = Math.min(currentDelay * 1.25, 15000);
        timeoutId = setTimeout(tick, currentDelay);
      }
    };

    tick();
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [poll]);

  useEffect(() => {
    const nodeId = searchParams.get('node');
    if (nodeId && nodes.length > 0) {
      const found = nodes.find((n) => n.id === nodeId);
      if (found) setSelected(found);
    }
  }, [searchParams, nodes]);

  useEffect(() => {
    setAutofixResult(null);
  }, [selected?.id]);

  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (n.debt_score > filter.maxScore) return false;
      if (n.debt_score < filter.minScore) return false;
      if (n.security_score < filter.securityScoreThreshold) return false;
      if (!filter.nodeTypes.includes(n.node_type)) return false;
      if (filter.criticalSecurityOnly && !n.has_critical_security) return false;
      if (filter.exploitableOnly && (n.exploitability_score ?? 0) < 55) return false;
      if (filter.publicExposureOnly && !n.public_exposure) return false;
      if (filter.autofixAvailableOnly && !n.autofix_available) return false;
      if (filter.collapseCriticalOnly && (n.collapse_risk ?? 0) < 70) return false;
      if (filter.attackPathOnly && (n.critical_attack_paths?.length ?? 0) === 0) return false;
      if (filter.owaspCategories.length > 0 && !n.owasp_categories.some((category) => filter.owaspCategories.includes(category))) return false;
      if (filter.cweCategories.length > 0 && !n.cwe_categories.some((category) => filter.cweCategories.includes(category))) return false;
      if (filter.secretLeaksOnly && !n.security_findings.some((finding) => finding.category === 'Secrets')) return false;
      if (filter.injectionOnly && !n.security_findings.some((finding) => finding.category === 'Injection' || finding.owaspIds.includes('A03'))) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        if (
          !n.symbol_name.toLowerCase().includes(q) &&
          !n.file_path.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [nodes, filter]);

  const filteredLinks = useMemo(() => {
    const ids = new Set(filteredNodes.map((n) => n.id));
    return links.filter(
      (l) => ids.has(l.source as string) && ids.has(l.target as string)
    );
  }, [links, filteredNodes]);

  const availableOwaspCategories = useMemo(
    () => [...new Set(nodes.flatMap((node) => node.owasp_categories ?? []))].sort(),
    [nodes]
  );

  const availableCweCategories = useMemo(
    () => [...new Set(nodes.flatMap((node) => node.cwe_categories ?? []))].sort(),
    [nodes]
  );

  const securityFindings = useMemo(
    () => nodes.flatMap((node) => node.security_findings ?? []),
    [nodes]
  );

  const businessRisks = analysis?.businessRisks ?? [];
  const operationalRisks = analysis?.operationalRisks ?? [];
  const customerImpact = analysis?.customerImpact ?? [];
  const ignoreConsequences = analysis?.ignoreConsequences ?? [];
  const businessTranslations = useMemo(() => nodes.slice(0, 5).map((node) => buildBusinessImpactFromNode(node)), [nodes]);

  const handleGenerateAutofix = useCallback(async () => {
    if (!selected || autofixLoading) return;
    setAutofixLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/autofix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId, nodeId: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Autofix failed');
      setAutofixResult(data.autofix ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Autofix failed');
    } finally {
      setAutofixLoading(false);
    }
  }, [analysisId, autofixLoading, selected]);

  const collapseBanner = useMemo(() => {
    if (!analysis?.security_collapse) return null;
    const affectedCoreModules = [...new Set(nodes.filter((node) => node.has_critical_security).map((node) => node.file_path))].slice(0, 8);
    const reasons = [
      `Critical vulnerabilities: ${analysis.critical_vulnerabilities}`,
      `Repository security score: ${analysis.repo_security_score.toFixed(1)}/100`,
      `Affected modules: ${affectedCoreModules.length}`,
    ];
    const severity: 'critical' | 'high' | 'moderate' = analysis.repo_security_score > 85 ? 'critical' : 'high';
    return {
      isCollapsed: true,
      severity,
      reasons,
      affectedCoreModules,
      propagationRisk: Math.min(100, Math.round(analysis.repo_security_score * 0.8 + analysis.critical_vulnerabilities * 6)),
    };
  }, [analysis, nodes]);

  const isLoading =
    !analysis ||
    (analysis.status !== 'complete' && analysis.status !== 'failed');

  if (error) {
    const isRateLimit = error.toLowerCase().includes('rate limit') || error.toLowerCase().includes('quota');
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center glass-panel rounded-[24px] border border-[rgba(176,122,77,0.12)] p-8 shadow-sm bg-[#f5efe7]/45">
        <AlertCircle className={`w-12 h-12 ${isRateLimit ? 'text-amber-500' : 'text-accent-rose'} mx-auto mb-4 animate-pulse`} />
        <h2 className="text-xl font-extrabold mb-2 text-[#2b2622]">
          {isRateLimit ? 'GitHub Quota Paused' : 'Analysis Failed'}
        </h2>
        <p className="text-[#8f8175] text-sm mb-6 leading-relaxed font-medium">{error}</p>

        {isRateLimit ? (
          <div className="flex flex-col gap-3 items-center">
            <button
              type="button"
              onClick={() => {
                setError(null);
                // Perform a reload or dynamic fetch retry
                window.location.reload();
              }}
              className="px-6 py-2.5 bg-[#8c6239] hover:bg-[#6b4b2a] text-[#fffdf9] rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            >
              Check Quota & Resume Job
            </button>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-[#8f8175] hover:text-[#2b2622] text-xs transition-colors mt-2 font-bold"
            >
              Analyze another repository
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-accent-cyan hover:underline text-sm font-bold"
          >
            Try another repo
          </button>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 flex items-center justify-center min-h-[80vh]">
        <LoadingState
          progress={analysis?.progress ?? 0}
          message={analysis?.progress_message}
          title={`Analyzing ${analysis?.repo_owner ?? ''}/${analysis?.repo_name ?? 'repository'}`}
        />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-6 flex gap-6 min-h-[calc(100vh-8rem)] fade-in-up">
      {/* Left Floating Vertical Sidebar */}
      <aside className="hidden md:flex w-20 bg-[#f5efe7]/65 backdrop-blur border border-[rgba(176,122,77,0.14)] rounded-[32px] py-8 flex-col items-center gap-6 shadow-sm shrink-0 sticky top-24 h-[calc(100vh-10rem)]">
        {/* Home - goes to root */}
        <Link 
          href="/" 
          className="w-16 h-16 flex flex-col items-center justify-center bg-[#efe8de] text-[#9a6a43] rounded-[20px] shadow-inner hover:scale-105 active:scale-95 transition-all gap-1.5" 
          aria-label="Home"
        >
          <Home className="w-5 h-5 shrink-0" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Home</span>
        </Link>

        {/* Heatmap - scrolls to heatmap section */}
        <button
          type="button"
          onClick={() => {
            const el = document.getElementById('heatmap');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
          className="w-16 h-16 flex flex-col items-center justify-center text-[#8f8175] hover:text-[#2b2622] hover:bg-[#f5eee6]/50 rounded-[20px] cursor-pointer transition-all gap-1.5"
          aria-label="Heatmap"
        >
          <Network className="w-5 h-5 shrink-0" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Heatmap</span>
        </button>

        {/* Executive Report - scrolls to executive report section */}
        <Link 
          href="#executive-report" 
          className="w-16 h-16 flex flex-col items-center justify-center text-[#8f8175] hover:text-[#2b2622] hover:bg-[#f5eee6]/50 rounded-[20px] cursor-pointer transition-all gap-1.5" 
          aria-label="Executive report"
        >
          <FileText className="w-5 h-5 shrink-0" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Report</span>
        </Link>
      </aside>

      {/* Main content grid area */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        {/* Repository Header Section */}
        <div className="glass-panel rounded-[24px] p-6 flex flex-wrap items-center justify-between gap-4 border border-[rgba(176,122,77,0.14)] bg-[#f5efe7]/45 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#181717] flex items-center justify-center shadow-md shrink-0 border border-slate-800 hover:scale-105 active:scale-95 transition-all">
              <Github className="w-5.5 h-5.5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-extrabold text-2xl text-slate-900 tracking-tight leading-tight">
                  {analysis.repo_owner}/{analysis.repo_name}
                </h1>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#fffdf9] border border-[rgba(176,122,77,0.14)] rounded-full text-xs font-bold text-[#93ab68] shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#93ab68] inline-block animate-pulse" />
                  <span>Analyzed</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 font-bold mt-1.5 flex items-center gap-2">
                <span>{analysis.total_nodes} nodes</span>
                <span className="text-slate-300">•</span>
                <span>avg score <span className="text-[#9a6a43] font-mono font-bold">{analysis.avg_debt_score}</span></span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/roadmap/${analysisId}`}
              className="group flex items-center gap-2.5 bg-[#efe8de]/80 hover:bg-[#e2d7c7]/95 border border-[rgba(176,122,77,0.18)] hover:border-[rgba(176,122,77,0.32)] px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider text-[#6b5b4d] hover:text-[#2b2622] shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              <Milestone className="w-4 h-4 text-[#9a6a43] group-hover:scale-110 group-hover:rotate-6 transition-all duration-300" />
              <span>Roadmap</span>
            </Link>
            <a
              href={`/api/export/${analysisId}`}
              download
              className="group flex items-center gap-2.5 bg-[#efe8de]/80 hover:bg-[#e2d7c7]/95 border border-[rgba(176,122,77,0.18)] hover:border-[rgba(176,122,77,0.32)] px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider text-[#6b5b4d] hover:text-[#2b2622] shadow-sm backdrop-blur-sm transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              <Download className="w-4 h-4 text-[#9a6a43] group-hover:translate-y-0.5 transition-transform duration-300" />
              <span>CSV</span>
            </a>
          </div>
        </div>

        {/* Animated Overview Stats Container */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <OverviewMetricCard
            label="Total Files"
            value={nodes.length}
            subtext="Codebase modules parsed"
            icon={FileCode}
            color="text-[#b07b4f]"
          />
          <OverviewMetricCard
            label="Avg Debt Score"
            value={(analysis.avg_debt_score || 0).toFixed(1)}
            subtext="Rating: B- Good"
            icon={Activity}
            color="text-amber-600"
          />
          <OverviewMetricCard
            label="Total Vulnerabilities"
            value={analysis.security_summary?.totalVulnerabilities ?? securityFindings.length}
            subtext={`${analysis.critical_vulnerabilities ?? 0} critical findings`}
            icon={ShieldAlert}
            color="text-rose-600"
          />
          <OverviewMetricCard
            label="Collapse Risk"
            value={`${Math.round(analysis.collapse_score || 0)}%`}
            subtext="Architectural instability"
            icon={AlertTriangle}
            color="text-[#8c6239]"
          />
        </div>

        {effectiveMode === 'technical' && collapseBanner && (
          <SecurityCollapseBanner collapse={collapseBanner} criticalFindings={analysis.critical_vulnerabilities} />
        )}

        {effectiveMode === 'business' && (
          <ExecutiveCommandCenter
            analysis={analysis}
            trust={trustScore}
            deploymentConfidence={deploymentConfidence}
            businessTranslations={businessTranslations}
            consequenceForecast={consequenceForecast}
          />
        )}

        {effectiveMode === 'business' && (
          <div className="grid xl:grid-cols-[1.1fr_0.9fr] gap-6">
            <ExecutiveRiskCard analysis={analysis} />
            <TrustScoreCard trust={trustScore} />
          </div>
        )}

        {effectiveMode === 'business' && (
          <div className="grid xl:grid-cols-2 gap-6">
            <DeploymentConfidenceCard confidence={deploymentConfidence} />
            <ConsequenceForecast forecast={consequenceForecast} />
          </div>
        )}

        {effectiveMode === 'business' && (
          <BusinessImpactPanel
            risks={businessTranslations}
            operationalRisks={operationalRisks}
            customerImpact={customerImpact}
            ignoreConsequences={ignoreConsequences}
          />
        )}

        {effectiveMode === 'business' && (
          <div className="grid xl:grid-cols-2 gap-6">
            <FinancialImpactCard analysis={analysis} nodes={nodes} />
            <RiskTimeline analysis={analysis} />
          </div>
        )}

        {effectiveMode === 'business' && (
          <div className="grid xl:grid-cols-2 gap-6">
            <ComplianceScoreCard analysis={analysis} nodes={nodes} />
            <ComplianceRiskCenter analysis={analysis} nodes={nodes} />
          </div>
        )}

        {effectiveMode === 'business' && (
          <div id="executive-report" className="grid xl:grid-cols-2 gap-6">
            <BoardReportCard analysis={analysis} />
            <div />
          </div>
        )}

        <SecurityOverview analysis={analysis} nodes={nodes} />

        {effectiveMode === 'technical' && (
          <div className="grid xl:grid-cols-2 gap-6">
            <CollapsePredictionPanel prediction={analysis.collapse_prediction} />
            <AttackPropagationGraph graph={analysis.attack_graph} />
          </div>
        )}

        <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <div className="space-y-6">
            {effectiveMode === 'technical' && selected && (
              <div className="bg-[#f5efe7]/50 backdrop-blur-md rounded-3xl p-6 border border-[rgba(176,122,77,0.12)] space-y-4 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-extrabold text-[#2b2622] tracking-tight">Selected node risk</h3>
                    <p className="text-sm text-[#8f8175] font-medium">Combined debt, security, and exploitability view.</p>
                  </div>
                  <ExploitabilityBadge score={selected.exploitability_score} publicExposure={selected.public_exposure} />
                </div>
                <div className="grid gap-3 md:grid-cols-4 text-sm text-[#6b5b4d] font-bold">
                  <div className="rounded-2xl bg-[#efe8de]/70 border border-[rgba(176,122,77,0.06)] p-3">Collapse risk <span className="font-extrabold text-[#9a6a43]">{Math.round(selected.collapse_risk || 0)}</span></div>
                  <div className="rounded-2xl bg-[#efe8de]/70 border border-[rgba(176,122,77,0.06)] p-3">Attack surface <span className="font-extrabold text-[#9a6a43]">{Math.round(selected.attack_surface_score || 0)}</span></div>
                  <div className="rounded-2xl bg-[#efe8de]/70 border border-[rgba(176,122,77,0.06)] p-3">Propagation <span className="font-extrabold text-[#9a6a43]">{Math.round(selected.propagation_risk || 0)}</span></div>
                  <div className="rounded-2xl bg-[#efe8de]/70 border border-[rgba(176,122,77,0.06)] p-3">Autofix <span className="font-extrabold text-[#9a6a43]">{selected.autofix_available ? 'available' : 'pending'}</span></div>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAutofix}
                  disabled={autofixLoading}
                  className="rounded-2xl bg-[#8c6239] hover:bg-[#6b4b2a] text-[#fffdf9] px-5 py-3 text-sm font-bold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {autofixLoading ? 'Generating autofix...' : 'Generate autofix'}
                </button>
              </div>
            )}
            <AutoFixPanel result={autofixResult} />
          </div>
          <div />
        </div>

        {/* Dynamic visual graph and filters block */}
        <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
          <div className="lg:w-[70%] flex flex-col gap-6 min-h-0">
            <div id="heatmap" className="flex-1 min-h-[480px] relative">
              <HeatMap
                nodes={filteredNodes}
                links={filteredLinks}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
              />
            </div>
            <div className="lg:hidden">
              <NodeSidebar
                node={selected}
                analysisId={analysisId}
                repoOwner={analysis?.repo_owner}
                repoName={analysis?.repo_name}
                onClose={() => setSelected(null)}
              />
            </div>
          </div>

          <div className="lg:w-[30%] flex flex-col gap-6 min-h-0 overflow-y-auto scrollbar-thin">
            <FingerprintCard
              label={analysis.fingerprint_label}
              confidence={analysis.fingerprint_confidence}
            />
            <FilterBar
              filter={filter}
              onChange={setFilter}
              nodeCount={filteredNodes.length}
              availableOwaspCategories={availableOwaspCategories}
              availableCweCategories={availableCweCategories}
            />
            <div className="hidden lg:block flex-1 min-h-[200px]">
              <NodeSidebar
                node={selected}
                analysisId={analysisId}
                repoOwner={analysis?.repo_owner}
                repoName={analysis?.repo_name}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AnalyzeClient({ view }: AnalyzeClientProps) {
  return (
    <Suspense fallback={<RouteSpinner /> }>
      <AnalyzeContent view={view} />
    </Suspense>
  );
}

function RouteSpinner() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <div className="w-10 h-10 rounded-full border-4 border-[#efe8de] border-t-[#8c6239] animate-spin" />
        <p className="text-sm font-semibold">Loading view...</p>
      </div>
    </div>
  );
}

function OverviewMetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="glass-panel rounded-3xl p-5 border border-[rgba(176,123,79,0.12)] bg-gradient-to-br from-white/60 to-[#f5efe7]/40 shadow-sm hover-lift flex items-center justify-between gap-4 transition-all duration-300">
      <div className="space-y-1 min-w-0">
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-2xl font-black text-slate-800 truncate">{value}</p>
        <p className="text-xs text-slate-500 font-semibold truncate">{subtext}</p>
      </div>
      <div className={`p-3 rounded-2xl bg-[#efe8de]/50 border border-[rgba(176,123,79,0.06)] shadow-inner shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  );
}
