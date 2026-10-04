'use client';

import { useState } from 'react';
import {
  Compass,
  X,
  ChevronRight,
  ChevronLeft,
  Shield,
  Network,
  Wrench,
  FileCheck,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

interface TourStep {
  title: string;
  badge: string;
  description: string;
  anchorText: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: '1. Software Trust & Deployment Gate',
    badge: 'Executive Risk',
    description: 'DebtRadar computes a unified 0-100 Trust Score combining AST security flaws, collapse pressure, and public attack surface into a clear deployment verdict (SAFE TO SHIP, NEEDS REVIEW, or HIGH RISK).',
    anchorText: 'Check the Trust Score card and Executive Command Center at the top.',
    icon: Shield,
  },
  {
    title: '2. Exploitability & Shortest Attack Chains',
    badge: 'Graph Intelligence',
    description: 'Unlike noisy linters, DebtRadar performs BFS graph traversal to trace whether public entry points can reach critical vulnerabilities in under 6 hops.',
    anchorText: 'Inspect the Attack Propagation Graph and High-Risk Attack Paths card.',
    icon: Network,
  },
  {
    title: '3. Deterministic Autofix & 1-Click Pull Request',
    badge: 'Remediation',
    description: 'Select any vulnerable AST symbol to preview AST-aware code patches and dispatch an automated pull request directly to GitHub.',
    anchorText: 'Click any node in the heatmap and view the Autofix Panel.',
    icon: Wrench,
  },
  {
    title: '4. Enterprise Compliance Audit Evidence',
    badge: 'SOC 2 & ISO 27001',
    description: 'Automated control mapping against SOC 2 Type II, ISO 27001:2022, PCI-DSS v4.0, and HIPAA with one-click export to Auditor Markdown, Evidence JSON, or Matrix CSV.',
    anchorText: 'Scroll to the Enterprise Compliance & Audit Intelligence section.',
    icon: FileCheck,
  },
  {
    title: '5. Longitudinal Trends & Peer Benchmarking',
    badge: 'Intelligence Pool',
    description: 'Track Trust Score velocity over time across commits and compare your repository percentile standing against peer codebases in the DebtRadar intelligence cohort.',
    anchorText: 'View Historical Trust & Risk Trend and Peer Cohort Benchmarking cards.',
    icon: TrendingUp,
  },
];

export function DemoTourModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;

  return (
    <>
      {/* Floating Tour Launch Pill */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xl border border-slate-700 transition-all hover:scale-105 active:scale-95"
      >
        <Compass className="w-4 h-4 text-[#d4a373] animate-spin-slow" />
        <span>Interactive Product Tour</span>
      </button>

      {/* Tour Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-3xl bg-[#fdfbf7] border border-[rgba(176,122,77,0.2)] shadow-2xl p-6 space-y-5 text-slate-900 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-[#9a6a43]/10 flex items-center justify-center border border-[#9a6a43]/20">
                  <Icon className="w-4 h-4 text-[#9a6a43]" />
                </span>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#9a6a43] block">
                    Step {currentStep + 1} of {TOUR_STEPS.length} • {step.badge}
                  </span>
                  <h3 className="font-extrabold text-base text-slate-900">{step.title}</h3>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Description */}
            <div className="space-y-3 text-xs leading-relaxed text-slate-600 font-medium bg-[#efe8de]/40 p-4 rounded-2xl border border-[rgba(176,122,77,0.1)]">
              <p>{step.description}</p>
              <div className="flex items-start gap-2 text-slate-800 font-bold pt-1">
                <Sparkles className="w-3.5 h-3.5 text-[#9a6a43] mt-0.5 shrink-0" />
                <span>How to explore: {step.anchorText}</span>
              </div>
            </div>

            {/* Navigation Dots & Buttons */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1.5">
                {TOUR_STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentStep(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === currentStep ? 'w-6 bg-[#9a6a43]' : 'w-2 bg-slate-200 hover:bg-slate-300'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={() => setCurrentStep((c) => c - 1)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                )}

                {currentStep < TOUR_STEPS.length - 1 ? (
                  <button
                    onClick={() => setCurrentStep((c) => c + 1)}
                    className="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-[#9a6a43] hover:bg-[#855835] text-white text-xs font-bold transition-all shadow-sm"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    Start Exploring
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
