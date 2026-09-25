'use client';

import { ShieldOff, Waves, TriangleAlert } from 'lucide-react';
import type { SecurityCollapseResult } from '@/types';

interface SecurityCollapseBannerProps {
  collapse: SecurityCollapseResult | null | undefined;
  criticalFindings: number;
}

export function SecurityCollapseBanner({ collapse, criticalFindings }: SecurityCollapseBannerProps) {
  if (!collapse?.isCollapsed) return null;

  return (
    <div className="glass-panel rounded-[28px] p-6 border border-[#c84a4a]/30 bg-gradient-to-br from-[#fff4f4] via-[#fff] to-[#ffe9e9] shadow-[0_16px_40px_rgba(200,74,74,0.12)] overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(200,74,74,0.12),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(224,176,75,0.08),transparent_40%)]" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#8f1d1d] text-white flex items-center justify-center shadow-lg animate-pulse">
            <ShieldOff className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-[#8f1d1d] flex items-center gap-2">
              <TriangleAlert className="w-4 h-4" />
              Security Collapse Detected
            </p>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-1">Repository security posture has crossed the collapse threshold.</h2>
            <p className="text-sm text-slate-600 mt-2 max-w-3xl leading-relaxed">
              {collapse.reasons.join(' ')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-[320px]">
          <Metric label="Severity" value={collapse.severity} />
          <Metric label="Propagation" value={`${collapse.propagationRisk}/100`} />
          <Metric label="Critical" value={criticalFindings} />
          <Metric label="Modules" value={collapse.affectedCoreModules.length} />
        </div>
      </div>

      {collapse.affectedCoreModules.length > 0 && (
        <div className="relative mt-5 flex flex-wrap gap-2">
          {collapse.affectedCoreModules.slice(0, 8).map((module) => (
            <span
              key={module}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#fff] border border-[#c84a4a]/20 text-xs font-bold text-[#8f1d1d] shadow-sm"
            >
              <Waves className="w-3.5 h-3.5" />
              {module}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white/80 border border-[#c84a4a]/15 p-3 shadow-sm">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="text-sm font-extrabold text-slate-900 mt-1 break-all">{value}</p>
    </div>
  );
}
