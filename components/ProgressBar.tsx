'use client';

import { cn } from '@/lib/utils';

interface ProgressBarProps {
  progress: number;
  message?: string | null;
  className?: string;
}

export function ProgressBar({ progress, message, className }: ProgressBarProps) {
  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between text-sm text-slate-600 font-bold mb-2">
        <span>{message ?? 'Processing...'}</span>
        <span className="font-mono text-[#b07b4f]">{Math.round(progress)}%</span>
      </div>
      <div className="h-2 rounded-full bg-[#efe8de] overflow-hidden shadow-inner">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#b07b4f] to-[#8c6239] transition-all duration-500 shadow-sm"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}
