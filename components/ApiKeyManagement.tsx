'use client';

import { useState, useEffect } from 'react';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Terminal,
  Code2,
  Shield,
  Clock,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import type { ApiKeyRecord } from '@/lib/api-keys/types';

export function ApiKeyManagement() {
  const [keys, setKeys] = useState<Omit<ApiKeyRecord, 'keyHash'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [activeSnippetTab, setActiveSnippetTab] = useState<'curl' | 'js' | 'python'>('curl');

  async function fetchKeys() {
    try {
      setLoading(true);
      const res = await fetch('/api/keys');
      if (!res.ok) throw new Error('Failed to fetch API keys');
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading keys');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchKeys();
  }, []);

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim() || isCreating) return;

    try {
      setIsCreating(true);
      setError(null);
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create key');

      setCreatedKey(data.key);
      setNewKeyName('');
      await fetchKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creation failed');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevokeKey(id: string) {
    if (!confirm('Are you sure you want to revoke this API key? Applications using it will immediately receive 401 Unauthorized.')) {
      return;
    }

    try {
      const res = await fetch(`/api/keys/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to revoke key');
      await fetchKeys();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Revocation failed');
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="glass-panel rounded-[24px] p-6 border border-[rgba(176,122,77,0.18)] bg-[#f5efe7]/50 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#9a6a43]/10 flex items-center justify-center border border-[#9a6a43]/20 shrink-0">
            <Key className="w-5 h-5 text-[#9a6a43]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                Developer API Keys & v1 Integration
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                REST API v1
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              Generate scoped API keys to trigger scans, fetch trust scores, and evaluate compliance programmatically.
            </p>
          </div>
        </div>
      </div>

      {/* Created Key Banner */}
      {createdKey && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>API Key Created Successfully</span>
            </div>
            <button
              onClick={() => setCreatedKey(null)}
              className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold"
            >
              Dismiss
            </button>
          </div>
          <p className="text-xs text-emerald-700 font-medium">
            Make sure to copy your API key now. You won&apos;t be able to see it again!
          </p>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              readOnly
              value={createdKey}
              className="flex-1 px-3 py-2 text-xs font-mono bg-white rounded-xl border border-emerald-300 font-bold text-slate-900 select-all"
            />
            <button
              onClick={() => copyToClipboard(createdKey)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Key'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Create Key Form */}
      <form onSubmit={handleCreateKey} className="flex items-center gap-3 bg-[#fffdf9]/80 p-3 rounded-2xl border border-[rgba(176,122,77,0.12)]">
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Key Description (e.g., GitHub Actions CI, Production Monitor)"
          className="flex-1 px-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:border-[#9a6a43]"
        />
        <button
          type="submit"
          disabled={!newKeyName.trim() || isCreating}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#9a6a43] hover:bg-[#855835] text-white text-xs font-bold transition-all disabled:opacity-50 shrink-0 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isCreating ? 'Generating...' : 'Create API Key'}</span>
        </button>
      </form>

      {/* Keys List */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-slate-700 px-1">Active Keys ({keys.length})</div>
        {loading ? (
          <div className="text-xs text-slate-500 font-semibold p-4 text-center">Loading keys...</div>
        ) : keys.length === 0 ? (
          <div className="text-xs text-slate-500 font-medium p-4 text-center bg-white/60 rounded-xl border border-dashed border-slate-200">
            No API keys generated yet. Create a key above to start using the v1 API.
          </div>
        ) : (
          <div className="grid gap-2">
            {keys.map((k) => (
              <div
                key={k.id}
                className="p-3.5 rounded-xl bg-white/80 border border-slate-200/70 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{k.name}</span>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                      {k.keyPrefix}
                    </span>
                    {!k.isActive && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                        Revoked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                    <span>Created: {new Date(k.createdAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>Rate limit: {k.rateLimit} req/min</span>
                    <span>•</span>
                    <span>Last used: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}</span>
                  </div>
                </div>

                {k.isActive && (
                  <button
                    onClick={() => handleRevokeKey(k.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-all"
                    title="Revoke Key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Code Examples Section */}
      <div className="rounded-[20px] border border-[rgba(176,122,77,0.12)] bg-[#1e1e24] text-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-2">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Terminal className="w-4 h-4 text-[#d4a373]" />
            <span>Developer SDK & API v1 Quickstart</span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-bold">
            {(['curl', 'js', 'python'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSnippetTab(tab)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  activeSnippetTab === tab
                    ? 'bg-[#9a6a43] text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto p-2 text-emerald-400/90">
          {activeSnippetTab === 'curl' &&
`# 1. Trigger an asynchronous repository analysis
curl -X POST https://api.debtradar.io/api/v1/analyze \\
  -H "Authorization: Bearer dr_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"repoUrl": "https://github.com/org/repo"}'

# 2. Poll analysis progress and trust metrics
curl -X GET https://api.debtradar.io/api/v1/analysis/{analysisId} \\
  -H "Authorization: Bearer dr_live_YOUR_KEY"

# 3. Retrieve deployment gate decision (for CI status checks)
curl -X GET https://api.debtradar.io/api/v1/trust-score/{analysisId} \\
  -H "Authorization: Bearer dr_live_YOUR_KEY"`}

          {activeSnippetTab === 'js' &&
`import fetch from 'node-fetch';

const API_KEY = process.env.DEBTRADAR_API_KEY;

// Trigger analysis
const res = await fetch('https://api.debtradar.io/api/v1/analyze', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${API_KEY}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ repoUrl: 'https://github.com/org/repo' })
});
const { analysisId } = await res.json();
console.log('Analysis started:', analysisId);`}

          {activeSnippetTab === 'python' &&
`import requests
import os

api_key = os.environ.get("DEBTRADAR_API_KEY")
headers = {"Authorization": f"Bearer {api_key}"}

# Trigger analysis
res = requests.post(
    "https://api.debtradar.io/api/v1/analyze",
    headers=headers,
    json={"repoUrl": "https://github.com/org/repo"}
)
print("Queued analysis:", res.json())`}
        </pre>
      </div>
    </section>
  );
}
