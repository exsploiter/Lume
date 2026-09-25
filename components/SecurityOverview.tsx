'use client';

import type { AnalysisRecord, DebtNode, SecurityFinding } from '@/types';
import { SecurityBadge } from '@/components/SecurityBadge';
import { OWASPChart } from '@/components/OWASPChart';
import { VulnerabilityTable } from '@/components/VulnerabilityTable';
import { useViewMode } from '@/contexts/ViewModeContext';

interface SecurityOverviewProps {
  analysis: AnalysisRecord | null;
  nodes: DebtNode[];
}

export function SecurityOverview({ analysis, nodes }: SecurityOverviewProps) {
  const { mode } = useViewMode();
  const securitySummary = analysis?.security_summary;
  const findings = nodes.flatMap((node) => node.security_findings ?? [] as SecurityFinding[]);
  const topModules = [...nodes]
    .sort((a, b) => b.security_score - a.security_score || b.vulnerability_count - a.vulnerability_count)
    .slice(0, 5);

  return (
    <div className="glass-panel rounded-[32px] p-6 border border-[rgba(176,123,79,0.24)] bg-[#f5efe7]/35 shadow-sm space-y-6">
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Metric label="Repo Security Score" value={analysis?.repo_security_score ?? securitySummary?.score ?? 0} accent />
        <Metric label="Critical Vulns" value={analysis?.critical_vulnerabilities ?? securitySummary?.critical ?? 0} danger />
        <Metric label="Collapse Status" value={analysis?.security_collapse ? 'Collapsed' : 'Stable'} danger={Boolean(analysis?.security_collapse)} />
        {mode === 'business' ? (
          <>
            <Metric label="Trust Score" value={analysis?.trustScore ?? 0} />
            <Metric label="Deployment Confidence" value={analysis?.deploymentConfidence ?? 0} />
          </>
        ) : (
          <>
            <Metric label="Exploitability" value={analysis?.repo_exploitability_score ?? 0} />
            <Metric label="Collapse Score" value={analysis?.collapse_score ?? 0} danger={Boolean((analysis?.collapse_score ?? 0) >= 70)} />
          </>
        )}
        <Metric label="Total Findings" value={securitySummary?.totalVulnerabilities ?? findings.length} />
      </div>

      <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <OWASPChart summary={securitySummary} findings={findings} />
        <div className="glass-panel rounded-3xl p-5 border border-[rgba(176,123,79,0.24)] shadow-md bg-[#f5efe7]/45 space-y-4">
          <div>
            <h3 className="font-extrabold text-slate-800">Top Vulnerable Modules</h3>
            <p className="text-xs text-slate-500 font-semibold mt-1">Ranked by security score and vulnerability concentration</p>
          </div>
          <div className="space-y-3">
            {topModules.length === 0 && <p className="text-sm text-slate-500 font-medium">No vulnerable modules found.</p>}
            {topModules.map((node) => (
              <div key={node.id} className="rounded-2xl border border-[rgba(176,123,79,0.14)] bg-[#efe8de]/40 p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{node.symbol_name}</p>
                    <p className="text-xs text-slate-500 font-mono truncate">{node.file_path}</p>
                  </div>
                  <SecurityBadge severity={node.security_risk_level} />
                </div>
                <div className="flex items-center gap-2 text-xs font-bold flex-wrap">
                  <span className="px-2.5 py-1 rounded-full bg-[#efe8de]/80 border-2 border-[rgba(176,122,77,0.35)] text-[#6b5b4d] shadow-sm">Security {node.security_score}</span>
                  <span className="px-2.5 py-1 rounded-full bg-[#efe8de]/80 border-2 border-[rgba(176,122,77,0.35)] text-[#6b5b4d] shadow-sm">Critical {node.vulnerability_count}</span>
                  <span className="px-2.5 py-1 rounded-full bg-[#efe8de]/80 border-2 border-[rgba(176,122,77,0.35)] text-[#6b5b4d] shadow-sm">Blast {node.blast_radius}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {mode === 'technical' && <VulnerabilityTable findings={findings} />}
    </div>
  );
}

function Metric({ label, value, accent = false, danger = false }: { label: string; value: string | number; accent?: boolean; danger?: boolean }) {
  return (
    <div className={`glass-panel rounded-3xl p-5 border shadow-sm ${danger ? 'border-[#8f1d1d]/45 bg-[#fcdcd7]/70' : 'border-[rgba(176,123,79,0.24)] bg-[#f5efe7]/45'}`}>
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#8f8175]">{label}</p>
      <p className={`text-2xl font-extrabold mt-2 ${accent ? 'text-[#8c6239]' : danger ? 'text-[#8f1d1d]' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}
