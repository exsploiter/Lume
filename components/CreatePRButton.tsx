'use client';

import { useCallback, useState } from 'react';
import {
  GitPullRequest,
  CheckCircle2,
  ArrowRight,
  X,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import type { DebtNode } from '@/types';
import { DiffPreview } from './DiffPreview';
import { formatScore, scoreColor } from '@/lib/utils';

interface CreatePRButtonProps {
  node: DebtNode;
  repoOwner: string;
  repoName: string;
}

interface PreviewData {
  originalSnippet: string;
  fixedSnippet: string;
  explanation: string;
  estimatedDebtReduction: number;
}

type PreflightStatus = 'idle' | 'checking' | 'ready' | 'failed';

export function CreatePRButton({ node, repoOwner, repoName }: CreatePRButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [creatingPR, setCreatingPR] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [preflightStatus, setPreflightStatus] = useState<PreflightStatus>('idle');
  const [preflightMessage, setPreflightMessage] = useState<string | null>(null);

  // Map the fingerprint tag to standard issue types
  const mapFingerprintToIssueType = (tag: string | null): string => {
    if (!tag) return 'missing_try_catch';
    const normalized = tag.toLowerCase().replace(/-/g, '_');
    if (normalized.includes('callback') || normalized.includes('spaghetti') || normalized.includes('try')) {
      return 'missing_try_catch';
    }
    if (normalized.includes('eval')) {
      return 'unsafe_eval';
    }
    if (normalized.includes('clone') || normalized.includes('copy') || normalized.includes('duplicate')) {
      return 'duplicate_logic';
    }
    if (normalized.includes('null') || normalized.includes('undefined')) {
      return 'missing_null_check';
    }
    if (normalized.includes('import')) {
      return 'unused_imports';
    }
    return 'missing_try_catch';
  };

  const issueType = mapFingerprintToIssueType(node.fingerprint_tag);

  const runPreflightCheck = useCallback(async () => {
    setPreflightStatus('checking');
    setPreflightMessage('Checking GitHub permissions...');

    try {
      const res = await fetch('/api/create-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoOwner,
          repoName,
          preflight: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Preflight check failed');
      }

      setPreflightStatus('ready');
      setPreflightMessage('Ready: GitHub token and repo write access verified.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to verify GitHub permissions.';
      setPreflightStatus('failed');
      setPreflightMessage(message);
      setError(message);
    }
  }, [repoName, repoOwner]);

  const fetchPreview = async () => {
    setLoadingPreview(true);
    setError(null);
    try {
      const res = await fetch('/api/create-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoOwner,
          repoName,
          filePath: node.file_path,
          issueType,
          lineStart: node.line_start,
          lineEnd: node.line_end,
          preview: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch fix preview');
      }

      setPreviewData(data);
      setIsOpen(true);
      void runPreflightCheck();
    } catch (err) {
      console.error('[CreatePRButton] Error fetching preview:', err);
      setError(err instanceof Error ? err.message : 'Unable to generate code patch. Please try again.');
      alert(`AutoFix Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmPR = async () => {
    if (!previewData || preflightStatus !== 'ready') return;
    setCreatingPR(true);
    setError(null);
    try {
      const res = await fetch('/api/create-pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoOwner,
          repoName,
          filePath: node.file_path,
          issueType,
          lineStart: node.line_start,
          lineEnd: node.line_end,
          preview: false,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to open Pull Request');
      }

      setPrUrl(data.prUrl);
      setIsDemoMode(!!data.isDemoMode);
    } catch (err) {
      console.error('[CreatePRButton] Error opening PR:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate branch or open Pull Request on GitHub.');
    } finally {
      setCreatingPR(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setPreviewData(null);
    setPrUrl(null);
    setIsDemoMode(false);
    setPreflightStatus('idle');
    setPreflightMessage(null);
    setError(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={fetchPreview}
        disabled={loadingPreview}
        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-3.5 rounded-xl font-bold transition-all shadow-[0_4px_12px_rgba(16,185,129,0.15)] hover:shadow-[0_6px_16px_rgba(16,185,129,0.25)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loadingPreview ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Analyzing & Fixing...</span>
          </>
        ) : (
          <>
            <GitPullRequest className="w-4 h-4" />
            <span>Generate Fix PR</span>
          </>
        )}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300">
          <div className="relative w-full max-w-3xl glass-panel bg-white/95 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-[rgba(176,123,79,0.2)]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-[rgba(176,123,79,0.12)] flex items-center justify-between bg-[#fffcf9]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600 animate-pulse" />
                <h3 className="font-extrabold text-lg text-slate-800 tracking-tight">
                  AutoFix Code Patch
                </h3>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 hover:bg-slate-100 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              
              {/* Success PR State */}
              {prUrl ? (
                <div className="text-center py-8 space-y-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mb-2">
                    <CheckCircle2 className="w-10 h-10 animate-bounce" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-2xl font-black text-slate-800">PR Opened Successfully!</h4>
                    <p className="text-sm text-slate-500 max-w-md mx-auto font-medium leading-relaxed">
                      {isDemoMode ? (
                        <span>DebtRadar has simulated the creation of your branch and pull request.</span>
                      ) : (
                        <span>
                          DebtRadar has created branch <code>fix/{issueType.replace(/_/g, '-')}-...</code> and opened a Pull Request for you.
                        </span>
                      )}
                    </p>
                  </div>

                  {isDemoMode && (
                    <div className="max-w-md mx-auto bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4.5 text-xs text-amber-900 text-left flex items-start gap-3 shadow-sm">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                      <div className="space-y-1">
                        <span className="font-extrabold block text-amber-800">Demo Sandbox Mode Active</span>
                        <p className="opacity-95 leading-relaxed font-medium">
                          Your local environment is using a placeholder <code>GITHUB_TOKEN</code> or encountered a rate limit. DebtRadar simulated this PR workflow. To open actual branches and pull requests on GitHub, please specify a valid token in your <code>.env.local</code> file.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Visual Reduction Badge */}
                  <div className="inline-flex items-center justify-center gap-6 bg-[#fcfaf7] border border-[rgba(176,123,79,0.15)] rounded-2xl px-6 py-4 shadow-sm">
                    <div className="text-center">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Initial Score</span>
                      <span className="text-xl font-extrabold text-slate-700">{formatScore(node.debt_score)}</span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-[#b07b4f]" />
                    <div className="text-center">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Projected Score</span>
                      <span className="text-xl font-extrabold text-emerald-600">
                        {formatScore(Math.max(0, Math.round(node.debt_score - (previewData?.estimatedDebtReduction || 0))))}
                      </span>
                    </div>
                  </div>

                  <div>
                    <a
                      href={prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold px-8 py-3.5 rounded-xl shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0"
                    >
                      <GitPullRequest className="w-5 h-5" />
                      <span>View Pull Request</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <div className={`rounded-2xl border p-3 text-xs font-semibold ${preflightStatus === 'failed' ? 'bg-rose-50 border-rose-200 text-rose-800' : preflightStatus === 'ready' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                    {preflightStatus === 'checking' && 'Checking GitHub token and repo write access...'}
                    {preflightStatus !== 'checking' && (preflightMessage || 'Waiting for permission check...')}
                  </div>

                  {/* Debt Score Impact Metric */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#fcfaf7] border border-[rgba(176,123,79,0.12)] rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Estimated Debt Score Impact</span>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-2xl font-black text-slate-500 line-through">
                            {formatScore(node.debt_score)}
                          </span>
                          <ArrowRight className="w-4 h-4 text-[#b07b4f]" />
                          <span className="text-2xl font-black text-emerald-600">
                            {formatScore(Math.max(0, Math.round(node.debt_score - (previewData?.estimatedDebtReduction || 0))))}
                          </span>
                        </div>
                      </div>
                      <div className="px-3.5 py-2 bg-emerald-100 text-emerald-700 text-xs font-extrabold rounded-xl shadow-sm">
                        -{previewData?.estimatedDebtReduction} Points
                      </div>
                    </div>
                    
                    <div className="bg-[#fcfaf7] border border-[rgba(176,123,79,0.12)] rounded-2xl p-4 flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">AutoFix Issue Classification</span>
                        <p className="text-xs text-slate-700 font-bold mt-1 font-mono capitalize">
                          {issueType.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* AI Change Explanation */}
                  <div className="bg-gradient-to-br from-[#fffdfa] to-[#f7f2ec]/50 border border-[rgba(176,123,79,0.15)] rounded-2xl p-4.5 space-y-2">
                    <h5 className="text-xs font-bold text-[#b07b4f] uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                      <span>Code Fix Rationale</span>
                    </h5>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      {previewData?.explanation}
                    </p>
                  </div>

                  {/* Git Diff Block */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Proposed Diff</h5>
                    <DiffPreview
                      originalCode={previewData?.originalSnippet || ''}
                      fixedCode={previewData?.fixedSnippet || ''}
                      filePath={node.file_path}
                    />
                  </div>

                  {error && (
                    <div className="bg-rose-100 border border-rose-200 text-rose-800 rounded-2xl p-4 text-xs font-medium leading-relaxed">
                      <p className="font-bold mb-1">GitHub PR Creation Failed</p>
                      <p className="opacity-90">{error}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer (only visible when not in success state) */}
            {!prUrl && (
              <div className="px-6 py-4 border-t border-[rgba(176,123,79,0.12)] bg-[#fffcf9] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={creatingPR}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPR}
                  disabled={creatingPR || preflightStatus !== 'ready'}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-all shadow-[0_4px_12px_rgba(16,185,129,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingPR ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating PR...</span>
                    </>
                  ) : (
                    <>
                      <GitPullRequest className="w-4 h-4" />
                      <span>Confirm & Open PR</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
