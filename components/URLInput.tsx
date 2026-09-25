'use client';

import { useState } from 'react';
import { Github, Search, Loader2 } from 'lucide-react';

interface URLInputProps {
  onSubmit: (url: string) => void;
  loading?: boolean;
}

export function URLInput({ onSubmit, loading }: URLInputProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) onSubmit(url.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl">
      <div className="glass-panel rounded-2xl p-2.5 flex items-center gap-3 border border-[rgba(176,123,79,0.15)] shadow-lg bg-white/70 w-full">
        <Github className="w-5 h-5 text-slate-600 ml-3 shrink-0" />
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo or owner/repo"
          className="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400 py-3 px-2 font-medium text-sm"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="flex items-center gap-2 bg-gradient-to-r from-[#b07b4f] to-[#8c6239] hover:from-[#8c6239] hover:to-[#5f5348] text-white px-6 py-3.5 rounded-xl font-bold transition-all shadow-[0_4px_12px_rgba(176,123,79,0.15)] hover:shadow-[0_6px_16px_rgba(176,123,79,0.25)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
          <span>Analyze</span>
        </button>
      </div>
    </form>
  );
}
