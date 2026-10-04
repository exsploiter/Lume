'use client';

import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Download,
  FileText,
  FileCode,
  Table,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import type {
  ComprehensiveComplianceAudit,
  ComplianceFrameworkType,
  FrameworkControl,
} from '@/types';

interface ComplianceAuditCenterProps {
  analysisId: string;
}

export function ComplianceAuditCenter({ analysisId }: ComplianceAuditCenterProps) {
  const [audit, setAudit] = useState<ComprehensiveComplianceAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFw, setActiveFw] = useState<ComplianceFrameworkType>('SOC2');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'FAIL' | 'WARNING' | 'PASS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedControlId, setExpandedControlId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchAudit() {
      try {
        setLoading(true);
        const res = await fetch(`/api/compliance/${analysisId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load compliance audit');
        const json: ComprehensiveComplianceAudit = await res.json();
        if (isMounted) {
          setAudit(json);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error fetching audit');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (analysisId) {
      fetchAudit();
    }

    return () => {
      isMounted = false;
    };
  }, [analysisId]);

  if (loading) {
    return (
      <div className="glass-panel rounded-[24px] p-6 border border-[rgba(176,122,77,0.14)] bg-[#f5efe7]/45 animate-pulse flex items-center justify-center min-h-[260px]">
        <div className="flex items-center gap-3 text-slate-500 font-bold text-sm">
          <ShieldCheck className="w-5 h-5 animate-spin text-[#9a6a43]" />
          <span>Evaluating SOC 2, ISO 27001, PCI-DSS, and HIPAA compliance controls...</span>
        </div>
      </div>
    );
  }

  if (error || !audit) {
    return null;
  }

  const currentFramework = audit.frameworks[activeFw];
  const controls = currentFramework?.controls || [];

  const filteredControls = controls.filter((ctrl) => {
    if (statusFilter !== 'ALL' && ctrl.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchText = `${ctrl.id} ${ctrl.title} ${ctrl.category} ${ctrl.description} ${ctrl.remediationGuidance}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }
    return true;
  });

  const frameworksList: ComplianceFrameworkType[] = ['SOC2', 'ISO27001', 'PCI_DSS', 'HIPAA', 'OWASP_TOP10'];

  return (
    <section className="glass-panel rounded-[24px] p-6 border border-[rgba(176,122,77,0.18)] bg-[#f5efe7]/50 shadow-sm space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#9a6a43]/10 flex items-center justify-center border border-[#9a6a43]/20 shrink-0">
            <ShieldCheck className="w-5 h-5 text-[#9a6a43]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Enterprise Compliance & Audit Intelligence
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                Grade: {audit.overallGrade}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Automated control evaluation for SOC 2 Type II, ISO/IEC 27001:2022, PCI-DSS v4.0, and HIPAA.
            </p>
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={`/api/compliance/${analysisId}/export?format=markdown`}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 text-xs font-bold border border-slate-200/80 shadow-sm transition-all"
          >
            <FileText className="w-3.5 h-3.5 text-[#9a6a43]" />
            <span>Auditor MD</span>
          </a>
          <a
            href={`/api/compliance/${analysisId}/export?format=json`}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 text-xs font-bold border border-slate-200/80 shadow-sm transition-all"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-600" />
            <span>Evidence JSON</span>
          </a>
          <a
            href={`/api/compliance/${analysisId}/export?format=csv`}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 text-xs font-bold border border-slate-200/80 shadow-sm transition-all"
          >
            <Table className="w-3.5 h-3.5 text-emerald-600" />
            <span>Matrix CSV</span>
          </a>
        </div>
      </div>

      {/* Framework Switcher Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
        {frameworksList.map((fwKey) => {
          const fw = audit.frameworks[fwKey];
          const isSelected = activeFw === fwKey;
          const statusBadge =
            fw.status === 'AUDIT_READY'
              ? 'bg-emerald-100 text-emerald-800'
              : fw.status === 'MINOR_GAPS'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-rose-100 text-rose-800';

          return (
            <button
              key={fwKey}
              onClick={() => {
                setActiveFw(fwKey);
                setStatusFilter('ALL');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all shrink-0 ${
                isSelected
                  ? 'bg-white border-[#9a6a43]/40 text-slate-900 shadow-sm'
                  : 'bg-[#efe8de]/50 border-transparent text-slate-600 hover:bg-[#efe8de]'
              }`}
            >
              <span>{fw.displayName}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${statusBadge}`}>
                {fw.readinessScore}%
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Framework Summary Banner */}
      {currentFramework && (
        <div className="rounded-[20px] border border-[rgba(176,122,77,0.12)] bg-[#fffdf9]/90 p-4 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm text-slate-900">
                  {currentFramework.displayName}
                </h4>
                <span className="text-xs text-slate-400 font-semibold">•</span>
                <span className="text-xs text-slate-500 font-semibold">{currentFramework.version}</span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-0.5">{currentFramework.summary}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-center px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="text-sm font-black font-mono text-emerald-700">{currentFramework.passingControls}</div>
                <div className="text-[8px] font-extrabold uppercase text-emerald-600">Passing</div>
              </div>
              <div className="text-center px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="text-sm font-black font-mono text-amber-700">{currentFramework.warningControls}</div>
                <div className="text-[8px] font-extrabold uppercase text-amber-600">Warnings</div>
              </div>
              <div className="text-center px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-xl">
                <div className="text-sm font-black font-mono text-rose-700">{currentFramework.failingControls}</div>
                <div className="text-[8px] font-extrabold uppercase text-rose-600">Failing</div>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search controls by ID, keyword, requirement..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-[#9a6a43]"
              />
            </div>

            <div className="flex items-center gap-1 text-[11px] font-bold">
              {(['ALL', 'FAIL', 'WARNING', 'PASS'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    statusFilter === st
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'ALL' ? 'All Controls' : st}
                </button>
              ))}
            </div>
          </div>

          {/* Controls List */}
          <div className="space-y-2 pt-1">
            {filteredControls.map((ctrl) => {
              const isExpanded = expandedControlId === ctrl.id;
              const statusIcon =
                ctrl.status === 'PASS' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : ctrl.status === 'WARNING' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                );

              const cardBg =
                ctrl.status === 'FAIL'
                  ? 'bg-rose-50/40 border-rose-200/70'
                  : ctrl.status === 'WARNING'
                  ? 'bg-amber-50/40 border-amber-200/70'
                  : 'bg-white border-slate-200/60';

              return (
                <div
                  key={ctrl.id}
                  className={`rounded-xl border transition-all ${cardBg} overflow-hidden`}
                >
                  <div
                    onClick={() => setExpandedControlId(isExpanded ? null : ctrl.id)}
                    className="p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/50"
                  >
                    <div className="flex items-center gap-3">
                      {statusIcon}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-slate-900">
                            {ctrl.id}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {ctrl.title}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {ctrl.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5 line-clamp-1">
                          {ctrl.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {ctrl.findingCount > 0 && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                          {ctrl.findingCount} finding{ctrl.findingCount > 1 ? 's' : ''}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Drawer Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-3 bg-white/70 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 block mb-1">
                          Audit Requirement
                        </span>
                        <p className="text-slate-700 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          {ctrl.auditRequirement}
                        </p>
                      </div>

                      {ctrl.violatingFiles.length > 0 && (
                        <div>
                          <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 block mb-1">
                            Violating Code Files ({ctrl.violatingFiles.length})
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {ctrl.violatingFiles.map((file, i) => (
                              <span
                                key={i}
                                className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200"
                              >
                                {file}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 block mb-1">
                          Remediation Guidance
                        </span>
                        <div className="flex items-start gap-2 text-emerald-800 bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200">
                          <ArrowUpRight className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                          <span className="font-medium">{ctrl.remediationGuidance}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Prioritized Remediation Roadmap */}
      {audit.remediationRoadmap.length > 0 && (
        <div className="bg-white/80 p-4 rounded-[20px] border border-[rgba(176,122,77,0.12)] space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <Sparkles className="w-4 h-4 text-[#9a6a43]" />
            <span>Compliance Remediation Priority Roadmap</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 text-xs">
            {audit.remediationRoadmap.slice(0, 4).map((item, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                    item.priority === 'P0' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {item.priority}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 font-bold">{item.controlId} ({item.framework})</span>
                </div>
                <p className="text-slate-700 font-medium">{item.action}</p>
                <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Est: {item.estimatedEffort}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
