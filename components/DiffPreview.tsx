'use client';

import { useMemo } from 'react';

interface DiffLine {
  type: 'added' | 'removed' | 'normal';
  value: string;
  leftLineNumber?: number;
  rightLineNumber?: number;
}

interface DiffPreviewProps {
  originalCode: string;
  fixedCode: string;
  filePath?: string;
}

/**
 * Computes the Longest Common Subsequence (LCS) to generate line-level diff lines.
 */
function computeLineDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = oldStr.replace(/\r\n/g, '\n').split('\n');
  const newLines = newStr.replace(/\r\n/g, '\n').split('\n');

  const dp: number[][] = Array(oldLines.length + 1)
    .fill(0)
    .map(() => Array(newLines.length + 1).fill(0));

  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const diff: DiffLine[] = [];
  let i = oldLines.length;
  let j = newLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({
        type: 'normal',
        value: oldLines[i - 1],
        leftLineNumber: i,
        rightLineNumber: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({
        type: 'added',
        value: newLines[j - 1],
        rightLineNumber: j,
      });
      j--;
    } else if (i > 0 && (j === 0 || dp[i - 1][j] > dp[i][j - 1])) {
      diff.unshift({
        type: 'removed',
        value: oldLines[i - 1],
        leftLineNumber: i,
      });
      i--;
    }
  }

  return diff;
}

export function DiffPreview({ originalCode, fixedCode, filePath }: DiffPreviewProps) {
  const diffLines = useMemo(() => {
    return computeLineDiff(originalCode, fixedCode);
  }, [originalCode, fixedCode]);

  return (
    <div className="flex flex-col border border-[rgba(176,123,79,0.15)] rounded-2xl overflow-hidden bg-white/70 shadow-inner">
      {filePath && (
        <div className="bg-[#fcfaf7] border-b border-[rgba(176,123,79,0.12)] px-4 py-2.5 flex items-center justify-between text-xs font-mono text-slate-600 font-semibold select-none">
          <span>{filePath}</span>
          <span className="bg-[#b07b4f]/10 text-[#b07b4f] px-2 py-0.5 rounded text-[10px] font-bold">
            +{diffLines.filter((l) => l.type === 'added').length} / -{diffLines.filter((l) => l.type === 'removed').length} lines
          </span>
        </div>
      )}
      
      <div className="overflow-x-auto overflow-y-auto max-h-[400px] scrollbar-thin font-mono text-[11px] leading-5 md:text-xs">
        <table className="w-full border-collapse select-text">
          <tbody>
            {diffLines.map((line, idx) => {
              let rowClass = 'hover:bg-slate-50/50';
              let sign = ' ';
              let signClass = 'text-slate-300';
              let codeClass = 'text-slate-700';

              if (line.type === 'added') {
                rowClass = 'bg-emerald-500/10 hover:bg-emerald-500/15 border-l-2 border-emerald-500';
                sign = '+';
                signClass = 'text-emerald-600 font-bold';
                codeClass = 'text-emerald-800 font-semibold';
              } else if (line.type === 'removed') {
                rowClass = 'bg-rose-500/10 hover:bg-rose-500/15 border-l-2 border-rose-500';
                sign = '-';
                signClass = 'text-rose-600 font-bold';
                codeClass = 'text-rose-800 line-through decoration-rose-400';
              }

              return (
                <tr key={idx} className={`transition-colors duration-150 ${rowClass}`}>
                  {/* Left Line Number (Original) */}
                  <td className="w-10 text-right pr-2 text-slate-400 select-none border-r border-[rgba(176,123,79,0.08)] bg-[#fcfaf7]/50 font-sans text-[10px]">
                    {line.leftLineNumber || ''}
                  </td>
                  
                  {/* Right Line Number (Fixed) */}
                  <td className="w-10 text-right pr-3 text-slate-400 select-none border-r border-[rgba(176,123,79,0.08)] bg-[#fcfaf7]/50 font-sans text-[10px]">
                    {line.rightLineNumber || ''}
                  </td>
                  
                  {/* Sign Indicator */}
                  <td className={`w-6 text-center select-none ${signClass} font-bold text-xs pl-2`}>
                    {sign}
                  </td>
                  
                  {/* Code Line */}
                  <td className={`pl-2 whitespace-pre pr-4 ${codeClass} break-all align-middle`}>
                    {line.value || ' '}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
