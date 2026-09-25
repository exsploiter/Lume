'use client';

import { Loader2, Radar, CheckCircle2, Circle } from 'lucide-react';
import { ProgressBar } from './ProgressBar';

interface LoadingStateProps {
  progress?: number;
  message?: string | null;
  title?: string;
}

export function LoadingState({
  progress = 0,
  message = '',
  title = 'Analyzing repository',
}: LoadingStateProps) {
  const normalizedMsg = (message || '').toLowerCase();

  const stages = [
    {
      id: 'queue',
      label: 'Queueing & Setup',
      desc: 'Securing pipeline slot and initializing workspace...',
      keywords: ['initializ', 'queue', 'enqueue', 'starting job'],
      start: 0,
      end: 10,
    },
    {
      id: 'fetch',
      label: 'Repository Retrieval',
      desc: 'Downloading repository source files and folders...',
      keywords: ['fetch', 'clone', 'download', 'repository', 'tree', 'filtering files'],
      start: 10,
      end: 30,
    },
    {
      id: 'ast',
      label: 'AST Parsing & Code Mining',
      desc: 'Parsing code structures and building symbol tables...',
      keywords: ['parse', 'ast', 'symbol', 'code mining'],
      start: 30,
      end: 45,
    },
    {
      id: 'scoring',
      label: 'Debt & Security Intelligence',
      desc: 'Calculating complexity, duplication, and vulnerability vectors...',
      keywords: ['score', 'security', 'duplication', 'collapse', 'exploit', 'blast radius', 'priority', 'scoring'],
      start: 45,
      end: 90,
    },
    {
      id: 'graph',
      label: 'Graph Generation',
      desc: 'Assembling visual heatmap coordinates and propagation links...',
      keywords: ['graph', 'heatmap', 'saving nodes', 'completed', 'final'],
      start: 90,
      end: 100,
    },
  ];

  const activeStageIndex = getActiveStageIndex(progress, normalizedMsg, stages);

  return (
    <div className="glass-panel rounded-[32px] p-8 border border-[rgba(176,123,79,0.16)] bg-gradient-to-br from-[#fffaf5] via-[#fffdfb] to-[#fcfaf7] shadow-[0_20px_50px_rgba(176,123,79,0.06)] space-y-8 max-w-xl mx-auto relative overflow-hidden">
      {/* Dynamic Background Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#b07b4f]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-[#e0b04b]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header section with large Radar Icon */}
      <div className="flex flex-col sm:flex-row items-center gap-5 pb-6 border-b border-[rgba(176,123,79,0.08)]">
        <div className="relative shrink-0 bg-gradient-to-br from-[#fff] to-[#f5efe7] p-4.5 rounded-[24px] border border-[rgba(176,123,79,0.12)] shadow-sm">
          <Radar className="w-10 h-10 text-[#b07b4f] animate-pulse" />
          <Loader2 className="w-5 h-5 text-[#e0b04b] absolute bottom-2 right-2 animate-spin" />
        </div>
        <div className="text-center sm:text-left space-y-1">
          <h2 className="text-lg font-black text-slate-800 tracking-tight leading-tight">{title}</h2>
          <p className="text-xs text-slate-500 font-bold font-mono uppercase tracking-wider">
            {message || 'Initializing pipeline...'}
          </p>
        </div>
      </div>

      {/* Live Checkpoint Pipeline */}
      <div className="space-y-4">
        {stages.map((stage, index) => {
          const isCompleted = index < activeStageIndex;
          const isActive = index === activeStageIndex;
          let stateClass = 'opacity-40';
          let borderClass = 'border-[rgba(176,123,79,0.06)] bg-white/30';
          let titleClass = 'text-slate-500 font-bold';

          if (isCompleted) {
            stateClass = 'opacity-100';
            borderClass = 'border-emerald-200 bg-emerald-500/5';
            titleClass = 'text-slate-800 font-extrabold';
          } else if (isActive) {
            stateClass = 'opacity-100 scale-[1.02] shadow-sm border-[rgba(176,123,79,0.2)] bg-gradient-to-r from-white to-[#fffaf5]';
            titleClass = 'text-[#b07b4f] font-black';
          }

          return (
            <div
              key={stage.id}
              className={`flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 ${borderClass} ${stateClass}`}
            >
              <div className="shrink-0 mt-0.5">
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 animate-bounce" />
                ) : isActive ? (
                  <Loader2 className="w-5 h-5 text-[#b07b4f] animate-spin" />
                ) : (
                  <Circle className="w-5 h-5 text-slate-300" />
                )}
              </div>
              <div className="space-y-0.5">
                <p className={`text-sm leading-tight ${titleClass}`}>{stage.label}</p>
                <p className="text-[11px] text-slate-400 font-medium leading-relaxed">{stage.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Bar Container */}
      <div className="space-y-3 pt-4 border-t border-[rgba(176,123,79,0.08)]">
        <ProgressBar progress={progress} message={message || 'Running code intelligence suite...'} />
      </div>
    </div>
  );
}

function getActiveStageIndex(
  progress: number,
  normalizedMsg: string,
  stages: Array<{
    keywords: string[];
    start: number;
    end: number;
  }>
) {
  if (progress >= 100 || /\bcompleted?\b/.test(normalizedMsg)) {
    return stages.length - 1;
  }

  const keywordStageIndex = stages.findIndex((stage) =>
    stage.keywords.some((keyword) => normalizedMsg.includes(keyword))
  );

  if (keywordStageIndex >= 0) {
    return keywordStageIndex;
  }

  const rangeStageIndex = stages.findIndex((stage) => progress < stage.end);
  return rangeStageIndex >= 0 ? rangeStageIndex : stages.length - 1;
}
