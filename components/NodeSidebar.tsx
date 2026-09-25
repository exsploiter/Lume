'use client';

import { useState, useEffect } from 'react';
import {
  FileCode,
  AlertTriangle,
  Network,
  Copy,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type { DebtNode } from '@/types';
import { formatScore, scoreColor, truncate } from '@/lib/utils';
import { SecurityPanel } from '@/components/SecurityPanel';
import { useViewMode } from '@/contexts/ViewModeContext';
import { buildBusinessImpactFromNode } from '@/lib/business-intelligence/business-impact';
import { predictConsequences } from '@/lib/business-intelligence/consequence-engine';
import { NonTechnicalExplanation } from '@/components/NonTechnicalExplanation';
import { ConsequenceForecast } from '@/components/ConsequenceForecast';
import { CreatePRButton } from './CreatePRButton';

interface NodeSidebarProps {
  node: DebtNode | null;
  analysisId: string;
  repoOwner?: string;
  repoName?: string;
  onClose?: () => void;
}

export function NodeSidebar({ node, analysisId, repoOwner, repoName, onClose }: NodeSidebarProps) {
  const { mode } = useViewMode();
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset explanation and error state when selected node or view mode changes.
  useEffect(() => {
    setExplanation(null);
    setError(null);
    setExplaining(false);
  }, [node?.id, mode]);

  if (!node) {
    return (
      <div className="glass-panel rounded-3xl p-6 h-full flex items-center justify-center border border-[rgba(176,123,79,0.12)] bg-white/40 shadow-md">
        <p className="text-slate-500 text-sm text-center font-medium leading-relaxed">
          Select a node on the graph to view debt details
        </p>
      </div>
    );
  }

  const handleExplain = async () => {
    setExplaining(true);
    setExplanation(null);
    setError(null);

    if (mode === 'business') {
      const businessTranslation = buildBusinessImpactFromNode(node);
      const consequenceForecast = predictConsequences({
        vulnerabilityType: node.security_findings?.[0]?.title ?? node.symbol_name,
        exploitabilityScore: node.exploitability_score ?? node.security_score ?? 0,
        blastRadius: node.blast_radius ?? 0,
        systemCriticality: node.security_weighted_score ?? 0,
        architectureRisk: node.collapse_risk ?? 0,
      });

      setExplanation(buildBusinessExplanation(node, businessTranslation, consequenceForecast));
      setExplaining(false);
      return;
    }

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: node.id,
          analysisId,
          node,
          codeSnippet: `// ${node.symbol_name} in ${node.file_path}\n// Lines ${node.line_start}-${node.line_end}`,
          filePath: node.file_path,
          debtScore: node.debt_score,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to generate explanation.');
      }

      if (data.explanation) {
        setExplanation(data.explanation);
      }
    } catch (err) {
      console.error("[Sidebar Error] AI Explain failed:", err);
      const errMsg = err instanceof Error ? err.message : 'AI explanation unavailable temporarily.';
      setError(errMsg);
      alert(`Error generating explanation: ${errMsg}`); // Toast notification
    } finally {
      setExplaining(false);
    }
  };

  const persistedExplanation = mode === 'technical' && node.explanation && !/(Business:|Executive:|If ignored:)/i.test(node.explanation)
    ? node.explanation
    : null;
  const displayExplanation = explanation ?? persistedExplanation;
  const explainButtonLabel = mode === 'business' ? 'Business AI Explain' : 'Technical AI Explain (Mistral)';
  const explanationCardLabel = mode === 'business' ? 'Business Insights' : 'Technical Insights';
  const businessTranslation = buildBusinessImpactFromNode(node);
  const consequenceForecast = predictConsequences({
    vulnerabilityType: node.security_findings?.[0]?.title ?? node.symbol_name,
    exploitabilityScore: node.exploitability_score ?? node.security_score ?? 0,
    blastRadius: node.blast_radius ?? 0,
    systemCriticality: node.security_weighted_score ?? 0,
    architectureRisk: node.collapse_risk ?? 0,
  });

  return (
    <div className="glass-panel rounded-3xl p-5 h-full overflow-y-auto scrollbar-thin space-y-5 border border-[rgba(176,123,79,0.12)] shadow-md bg-white/40">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-800 lg:hidden font-bold transition-colors"
        >
          ✕ Close
        </button>
      )}

      <div>
        <h3 className="font-black text-2xl text-slate-800 tracking-tight leading-tight">{node.symbol_name}</h3>
        <div className="flex items-center gap-1.5 mt-2.5 overflow-hidden bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 font-mono text-[10px] text-slate-300 shadow-inner">
          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mr-1.5" />
          <span className="truncate select-all select-none opacity-85">{node.file_path}</span>
        </div>
      </div>

      <div>
        <span className="text-xs text-slate-500 font-bold block mb-1.5">Technical Debt Score</span>
        <div
          className="text-4xl font-extrabold tracking-tight flex items-baseline"
          style={{ color: scoreColor(node.debt_score) }}
        >
          {formatScore(node.debt_score)}
          <span className="text-sm text-slate-400 font-bold ml-1">/ 100</span>
        </div>
      </div>

      {/* Comparative Debt Metrics breakdown bar */}
      <div className="space-y-3 bg-[#fdfbf7]/60 border border-[rgba(176,123,79,0.12)] p-4.5 rounded-2xl shadow-sm">
        <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Debt Breakdown</h4>
        <div className="space-y-3">
          <ProgressBarMini label="Complexity" value={Math.min(100, node.complexity * 3.5)} displayVal={node.complexity} color="bg-[#b07b4f]" />
          <ProgressBarMini label="Code Duplication" value={node.duplication_score * 100} displayVal={`${(node.duplication_score * 100).toFixed(0)}%`} color="bg-amber-500" />
          <ProgressBarMini label="Security Exposure" value={node.security_score} displayVal={`${node.security_score.toFixed(0)}/100`} color="bg-rose-500" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric icon={AlertTriangle} label="Complexity" value={node.complexity} />
        <Metric icon={Network} label="Blast Radius" value={node.blast_radius} />
        <Metric
          icon={Copy}
          label="Duplication"
          value={`${(node.duplication_score * 100).toFixed(0)}%`}
        />
        <Metric icon={FileCode} label="Type" value={node.node_type} />
      </div>

      {mode === 'business' && (
        <div className="space-y-4">
          <NonTechnicalExplanation translation={businessTranslation} />
          <ConsequenceForecast forecast={consequenceForecast} />
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-[0.18em]">Security</span>
          <span className="text-xs font-mono text-slate-500">
            {(node.security_risk_level ?? 'none').toUpperCase()}
          </span>
        </div>
        <SecurityPanel node={node} />
      </div>

      <div className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
        <span>Code scope:</span>
        <span className="font-mono text-slate-600">Lines {node.line_start}–{node.line_end}</span>
      </div>

      {node.fingerprint_tag && (
        <div className="text-xs bg-[#b07b4f]/10 border border-[#b07b4f]/20 rounded-xl px-3 py-2.5 text-[#b07b4f] font-bold font-mono tracking-wide text-center capitalize shadow-sm">
          {node.fingerprint_tag.replace(/-/g, ' ')}
        </div>
      )}

      <button
        type="button"
        onClick={handleExplain}
        disabled={explaining}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#b07b4f] to-[#8c6239] hover:from-[#8c6239] hover:to-[#5f5348] text-white py-3.5 rounded-xl font-bold transition-all shadow-[0_4px_12px_rgba(176,123,79,0.15)] hover:shadow-[0_6px_16px_rgba(176,123,79,0.25)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {explaining ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        <span>{explainButtonLabel}</span>
      </button>

      {repoOwner && repoName && (
        <CreatePRButton node={node} repoOwner={repoOwner} repoName={repoName} />
      )}

      {error && (
        <div className="bg-[#c44d4d]/10 border border-[#c44d4d]/20 rounded-xl p-4 text-sm text-[#c44d4d] shadow-sm">
          <p className="font-bold mb-1">AI Explanation Failed</p>
          <p className="text-xs text-[#c44d4d]/85 font-medium leading-relaxed">{error}</p>
        </div>
      )}

      {displayExplanation && (
        <div className="bg-gradient-to-br from-[#fffaf5] to-[#f5efe7]/60 border border-[rgba(176,123,79,0.15)] rounded-2xl p-5 text-sm text-slate-700 leading-relaxed shadow-sm font-medium relative overflow-hidden">
          <div className="flex items-center gap-1.5 text-[#b07b4f] font-bold text-xs mb-2.5 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>{explanationCardLabel}</span>
          </div>
          <p className="leading-relaxed">{displayExplanation}</p>
        </div>
      )}
    </div>
  );
}

function buildBusinessExplanation(
  node: DebtNode,
  translation: ReturnType<typeof buildBusinessImpactFromNode>,
  forecast: ReturnType<typeof predictConsequences>
) {
  return [
    translation.executiveSummary,
    `Business impact: ${translation.businessImpact}`,
    `Customer impact: ${translation.customerImpact}`,
    `Operational risk: ${translation.operationalRisk}`,
    `Financial risk: ${translation.financialRisk}`,
    `What happens if ignored: ${forecast.shortTermImpact} ${forecast.longTermImpact}`,
    `Recommended action: ${translation.recommendedAction}`,
  ].join(' ');
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-[#f5efe7]/40 border border-[rgba(176,123,79,0.08)] rounded-2xl p-3 shadow-sm hover:bg-[#efe8de]/50 transition-colors">
      <Icon className="w-4 h-4 text-[#b07b4f] mb-1.5" />
      <p className="text-xs text-slate-400 font-bold">{label}</p>
      <p className="text-sm font-extrabold text-slate-800 capitalize mt-0.5">{value}</p>
    </div>
  );
}

function ProgressBarMini({
  label,
  value,
  displayVal,
  color,
}: {
  label: string;
  value: number;
  displayVal: string | number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-bold text-slate-500">
        <span>{label}</span>
        <span className="font-mono text-slate-700">{displayVal}</span>
      </div>
      <div className="h-1.5 w-full bg-[#efe8de] rounded-full overflow-hidden border border-[rgba(176,123,79,0.04)] shadow-inner">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}
