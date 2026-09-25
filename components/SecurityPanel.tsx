'use client';

import type { DebtNode } from '@/types';
import { SecurityBadge } from '@/components/SecurityBadge';
import { VulnerabilityTable } from '@/components/VulnerabilityTable';

interface SecurityPanelProps {
  node: DebtNode;
}

export function SecurityPanel({ node }: SecurityPanelProps) {
  const findings = node.security_findings ?? [];
  const securityScore = Number.isFinite(node.security_score) ? node.security_score : 0;
  const securityWeightedScore = Number.isFinite(node.security_weighted_score) ? node.security_weighted_score : 0;
  const vulnerabilityCount = Number.isFinite(node.vulnerability_count) ? node.vulnerability_count : 0;
  const blastRadius = Number.isFinite(node.blast_radius) ? node.blast_radius : 0;
  const owaspCategories = node.owasp_categories ?? [];
  const cweCategories = node.cwe_categories ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#c84a4a]/15 bg-[#fff5f5] p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-400">Security Score</p>
            <p className="text-3xl font-extrabold text-[#8f1d1d] mt-1">{securityScore}</p>
          </div>
          <SecurityBadge severity={node.security_risk_level} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs font-bold text-slate-500">
          <Stat label="Vulnerabilities" value={vulnerabilityCount} />
          <Stat label="Critical" value={node.has_critical_security ? 'Yes' : 'No'} />
          <Stat label="Weighted" value={securityWeightedScore.toFixed(1)} />
          <Stat label="Blast + Risk" value={`${blastRadius}/${securityScore}`} />
        </div>
      </div>

      <div className="rounded-2xl border border-[rgba(176,123,79,0.08)] bg-white/60 p-4 space-y-3">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-400">OWASP / CWE</p>
        <div className="flex flex-wrap gap-2">
          {owaspCategories.length > 0 ? owaspCategories.map((category) => (
            <span key={category} className="px-2.5 py-1 rounded-full bg-[#f5efe7] border border-[rgba(176,123,79,0.08)] text-xs font-bold text-slate-700">{category}</span>
          )) : <span className="text-sm text-slate-500">No OWASP mapping</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {cweCategories.length > 0 ? cweCategories.map((category) => (
            <span key={category} className="px-2.5 py-1 rounded-full bg-[#f5efe7] border border-[rgba(176,123,79,0.08)] text-xs font-bold text-slate-700">{category}</span>
          )) : <span className="text-sm text-slate-500">No CWE mapping</span>}
        </div>
      </div>

      <VulnerabilityTable findings={findings} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/70 border border-[rgba(176,123,79,0.08)] p-3">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-extrabold">{label}</p>
      <p className="text-sm text-slate-800 font-extrabold mt-1">{value}</p>
    </div>
  );
}
