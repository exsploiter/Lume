'use client';

import type { VulnerabilitySeverity } from '@/types';

const COLORS: Record<VulnerabilitySeverity, string> = {
  critical: 'text-[#fff] bg-[#8f1d1d] border-[#b83b3b] shadow-[0_0_0_1px_rgba(184,59,59,0.35)]',
  high: 'text-[#fff] bg-[#d85b2b] border-[#ef7d4f] shadow-[0_0_0_1px_rgba(239,125,79,0.3)]',
  medium: 'text-[#2b2622] bg-[#f0c04e] border-[#f2cf79]',
  low: 'text-[#1f4b87] bg-[#d8ecff] border-[#9dc4ef]',
};

interface SecurityBadgeProps {
  severity: VulnerabilitySeverity | 'none';
  label?: string;
  className?: string;
}

export function SecurityBadge({ severity, label, className = '' }: SecurityBadgeProps) {
  if (severity === 'none') {
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border border-slate-200 bg-slate-100 text-slate-500 ${className}`}>
        {label ?? 'None'}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${COLORS[severity]} ${className}`}>
      {label ?? severity}
    </span>
  );
}
