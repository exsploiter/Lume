'use client';

import { Search, Filter } from 'lucide-react';
import type { FilterState, DebtNode } from '@/types';

interface FilterBarProps {
  filter: FilterState;
  onChange: (filter: FilterState) => void;
  nodeCount: number;
  availableOwaspCategories: string[];
  availableCweCategories: string[];
}

const NODE_TYPES: DebtNode['node_type'][] = [
  'function',
  'class',
  'module',
  'variable',
];

export function FilterBar({
  filter,
  onChange,
  nodeCount,
  availableOwaspCategories,
  availableCweCategories,
}: FilterBarProps) {
  return (
    <div 
      role="search" 
      aria-label="Graph Filter Controls"
      className="glass-panel rounded-3xl p-5 space-y-5 border border-[rgba(176,123,79,0.12)] shadow-md bg-white/40"
    >
      <div className="flex items-center gap-2 text-slate-800">
        <Filter className="w-4 h-4 text-[#b07b4f]" aria-hidden="true" />
        <span className="text-sm font-bold">Filters</span>
        <span className="text-xs text-slate-400 ml-auto font-semibold">{nodeCount} nodes</span>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="text"
          value={filter.search}
          onChange={(e) => onChange({ ...filter, search: e.target.value })}
          placeholder="Search symbols..."
          aria-label="Search Code Symbols"
          className="w-full bg-[#f5efe7]/40 border border-[rgba(176,123,79,0.15)] rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#b07b4f] focus:ring-2 focus:ring-[#b07b4f]/30 transition-all font-medium"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="min-score-range" className="text-xs text-slate-600 font-bold block">
          Min score: <span className="text-[#b07b4f] font-mono">{filter.minScore}</span>
        </label>
        <input
          id="min-score-range"
          type="range"
          min={0}
          max={100}
          value={filter.minScore}
          onChange={(e) =>
            onChange({ ...filter, minScore: Number(e.target.value) })
          }
          className="w-full accent-[#b07b4f] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b07b4f] rounded-lg"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="security-threshold-range" className="text-xs text-slate-600 font-bold block">
          Security threshold: <span className="text-[#8f1d1d] font-mono">{filter.securityScoreThreshold}</span>
        </label>
        <input
          id="security-threshold-range"
          type="range"
          min={0}
          max={100}
          value={filter.securityScoreThreshold}
          onChange={(e) => onChange({ ...filter, securityScoreThreshold: Number(e.target.value) })}
          className="w-full accent-[#8f1d1d] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8f1d1d] rounded-lg"
        />
      </div>

      <div className="grid grid-cols-1 gap-2" role="group" aria-label="Risk Toggle Filters">
        <ToggleButton
          active={filter.criticalSecurityOnly}
          label="Critical security only"
          onClick={() => onChange({ ...filter, criticalSecurityOnly: !filter.criticalSecurityOnly })}
        />
        <ToggleButton
          active={filter.secretLeaksOnly}
          label="Secret leaks only"
          onClick={() => onChange({ ...filter, secretLeaksOnly: !filter.secretLeaksOnly })}
        />
        <ToggleButton
          active={filter.injectionOnly}
          label="Injection only"
          onClick={() => onChange({ ...filter, injectionOnly: !filter.injectionOnly })}
        />
        <ToggleButton
          active={filter.exploitableOnly}
          label="Exploitable only"
          onClick={() => onChange({ ...filter, exploitableOnly: !filter.exploitableOnly })}
        />
        <ToggleButton
          active={filter.publicExposureOnly}
          label="Public exposure only"
          onClick={() => onChange({ ...filter, publicExposureOnly: !filter.publicExposureOnly })}
        />
        <ToggleButton
          active={filter.autofixAvailableOnly}
          label="Autofix available"
          onClick={() => onChange({ ...filter, autofixAvailableOnly: !filter.autofixAvailableOnly })}
        />
        <ToggleButton
          active={filter.collapseCriticalOnly}
          label="Collapse critical only"
          onClick={() => onChange({ ...filter, collapseCriticalOnly: !filter.collapseCriticalOnly })}
        />
        <ToggleButton
          active={filter.attackPathOnly}
          label="Attack path only"
          onClick={() => onChange({ ...filter, attackPathOnly: !filter.attackPathOnly })}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-600">OWASP Categories</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="OWASP Category Filters">
          {availableOwaspCategories.length === 0 ? (
            <span className="text-xs text-slate-400">No OWASP categories</span>
          ) : (
            availableOwaspCategories.map((category) => {
              const active = filter.owaspCategories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    const next = active
                      ? filter.owaspCategories.filter((item) => item !== category)
                      : [...filter.owaspCategories, category];
                    onChange({ ...filter, owaspCategories: next });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border outline-none focus-visible:ring-2 focus-visible:ring-[#8f1d1d] focus-visible:ring-offset-1 ${active ? 'bg-[#8f1d1d] text-white border-[#8f1d1d]' : 'bg-white/80 text-slate-600 border-slate-200 hover:border-[#8f1d1d]/30'}`}
                >
                  {category}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold text-slate-600">CWE Categories</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="CWE Category Filters">
          {availableCweCategories.length === 0 ? (
            <span className="text-xs text-slate-400">No CWE categories</span>
          ) : (
            availableCweCategories.map((category) => {
              const active = filter.cweCategories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    const next = active
                      ? filter.cweCategories.filter((item) => item !== category)
                      : [...filter.cweCategories, category];
                    onChange({ ...filter, cweCategories: next });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border outline-none focus-visible:ring-2 focus-visible:ring-[#d85b2b] focus-visible:ring-offset-1 ${active ? 'bg-[#d85b2b] text-white border-[#d85b2b]' : 'bg-white/80 text-slate-600 border-slate-200 hover:border-[#d85b2b]/30'}`}
                >
                  {category}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Node Type Filters">
        {NODE_TYPES.map((type) => {
          const isActive = filter.nodeTypes.includes(type);
          return (
            <button
              key={type}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                const types = filter.nodeTypes.includes(type)
                  ? filter.nodeTypes.filter((t) => t !== type)
                  : [...filter.nodeTypes, type];
                onChange({ ...filter, nodeTypes: types });
              }}
              className={`text-xs px-3 py-1.5 rounded-xl capitalize font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#b07b4f] focus-visible:ring-offset-1 ${isActive
                  ? 'bg-gradient-to-r from-[#b07b4f] to-[#8c6239] text-white shadow-sm hover:opacity-95'
                  : 'bg-[#efe8de]/70 text-slate-600 hover:text-slate-800 hover:bg-[#e5d9c8]/70 border border-transparent'
                }`}
            >
              {type}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`w-full rounded-xl px-3 py-2 text-left text-xs font-bold transition-all border outline-none focus-visible:ring-2 focus-visible:ring-[#8f1d1d] focus-visible:ring-offset-1 ${active ? 'bg-[#8f1d1d] text-white border-[#8f1d1d]' : 'bg-white/80 text-slate-600 border-slate-200 hover:border-[#8f1d1d]/30'}`}
    >
      {label}
    </button>
  );
}
