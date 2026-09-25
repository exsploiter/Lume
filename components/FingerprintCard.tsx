'use client';

import { Fingerprint, Tag } from 'lucide-react';

interface FingerprintCardProps {
  label: string | null;
  confidence?: number | null;
  className?: string;
}

const LABEL_COLORS: Record<string, string> = {
  'legacy-spaghetti': 'text-[#c44d4d] bg-[#c44d4d]/10 border-[#c44d4d]/20',
  'god-object': 'text-[#d96b4b] bg-[#d96b4b]/10 border-[#d96b4b]/20',
  'callback-hell': 'text-[#c44d4d] bg-[#c44d4d]/10 border-[#c44d4d]/20',
  'copy-paste-clone': 'text-[#e0b04b] bg-[#e0b04b]/10 border-[#e0b04b]/20',
  'dead-code': 'text-slate-400 bg-slate-100 border-slate-200',
  'over-engineered': 'text-[#b07b4f] bg-[#b07b4f]/10 border-[#b07b4f]/20',
  'tight-coupling': 'text-[#d96b4b] bg-[#d96b4b]/10 border-[#d96b4b]/20',
  'missing-abstraction': 'text-[#7fa36a] bg-[#7fa36a]/10 border-[#7fa36a]/20',
};

export function FingerprintCard({
  label,
  confidence,
  className = '',
}: FingerprintCardProps) {
  if (!label) return null;

  const colorClass = LABEL_COLORS[label] ?? 'text-[#b07b4f] bg-[#b07b4f]/10 border-[#b07b4f]/20';

  return (
    <div className={`glass-panel rounded-3xl p-5 border border-[rgba(176,123,79,0.12)] shadow-md bg-white/40 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Fingerprint className="w-4 h-4 text-[#b07b4f]" />
        <span className="text-sm font-bold text-slate-800">Debt Fingerprint</span>
      </div>
      <div className="flex items-center">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-bold capitalize tracking-wide shadow-sm font-mono ${colorClass}`}>
          <Tag className="w-3.5 h-3.5" />
          {label.replace(/-/g, ' ')}
        </span>
      </div>
      {confidence != null && (
        <p className="text-xs text-slate-500 font-semibold mt-3.5 flex items-center gap-1">
          <span>AI Model Confidence:</span>
          <span className="text-slate-800 font-bold font-mono">{(confidence * 100).toFixed(0)}%</span>
        </p>
      )}
    </div>
  );
}
