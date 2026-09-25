'use client';

import type { SecurityFinding, SecuritySummary } from '@/types';

interface OWASPChartProps {
  summary: SecuritySummary | null | undefined;
  findings: SecurityFinding[];
}

export function OWASPChart({ summary, findings }: OWASPChartProps) {
  const categoryEntries = Object.entries(summary?.categoryCounts ?? {}).sort((a, b) => b[1] - a[1]);
  
  // Only render categories that actually have active findings to prevent blank/zero space bloating
  const activeCategories = categoryEntries.filter(([_, value]) => value > 0);

  const severity = [
    { label: 'Critical', value: summary?.critical ?? 0, color: '#8f1d1d' },
    { label: 'High', value: summary?.high ?? 0, color: '#d85b2b' },
    { label: 'Medium', value: summary?.medium ?? 0, color: '#f0c04e' },
    { label: 'Low', value: summary?.low ?? 0, color: '#4d84c4' },
  ];

  return (
    <div className="rounded-3xl p-5 border border-[rgba(176,123,79,0.22)] shadow-sm bg-[#efe8de] space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-slate-800">OWASP Coverage</h3>
          <p className="text-xs text-slate-500 font-semibold mt-1">{findings.length} findings mapped to security categories</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Security Score</p>
          <p className="text-2xl font-extrabold text-[#9a6a43]">{summary?.score ?? 0}</p>
        </div>
      </div>

      {/* Dynamically adjust columns so no empty blank space or unbalanced layout occurs at the bottom */}
      <div className={activeCategories.length > 0 ? "grid md:grid-cols-2 gap-6" : "max-w-md space-y-3"}>
        <div className="space-y-3">
          {severity.map((item) => (
            <Bar key={item.label} label={item.label} value={item.value} color={item.color} total={Math.max(1, summary?.totalVulnerabilities ?? 1)} />
          ))}
        </div>
        {activeCategories.length > 0 && (
          <div className="space-y-3">
            {/* Slice to 4 to match the 4 severity rows, keeping both columns perfectly balanced */}
            {activeCategories.slice(0, 4).map(([label, value]) => (
              <Bar key={label} label={label} value={value} color="#b07b4f" total={Math.max(1, summary?.totalVulnerabilities ?? 1)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Bar({ label, value, color, total }: { label: string; value: number; color: string; total: number }) {
  const width = `${Math.max(5, Math.min(100, (value / total) * 100))}%`;
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2.5 rounded-full bg-[#fffdf9] border border-[rgba(176,123,79,0.08)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width, backgroundColor: color }} />
      </div>
    </div>
  );
}
