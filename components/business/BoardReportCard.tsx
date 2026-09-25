'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import ExecutiveReportPreview from './ExecutiveReportPreview';

export default function BoardReportCard({ analysis }: { analysis: any }) {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (showEmailInput) {
      emailInputRef.current?.focus();
    }
  }, [showEmailInput]);

  const generatePreview = async () => {
    setLoading(true);
    setError(null);
    setEmailSent(null);
    try {
      const res = await fetch(`/api/export-board-report/${id}?format=json`);
      if (!res.ok) {
        const payload = await res.text();
        throw new Error(payload || 'Failed to generate executive report');
      }
      const data = await res.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate executive report');
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    setLoading(true);
    setError(null);
    setEmailSent(null);
    try {
      const res = await fetch(`/api/export-board-report/${id}`);
      if (!res.ok) {
        const payload = await res.text();
        throw new Error(payload || 'Failed to download board report');
      }

      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/pdf')) {
        throw new Error('The board report response was not a PDF file.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${analysis?.repo_name || id}-DebtRadar-Board-Report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download board report');
    } finally {
      setLoading(false);
    }
  };

  const sendToEmail = async () => {
    setLoading(true);
    setError(null);
    setEmailSent(null);
    try {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        throw new Error('Enter an email address to send the report.');
      }

      const res = await fetch(`/api/export-board-report/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to send board report email');
      }

      setEmailSent(trimmedEmail);
      setShowEmailInput(false);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send board report email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-4 border border-[rgba(176,122,77,0.08)] shadow-sm bg-white/60">
      <h3 className="font-extrabold text-lg text-slate-800 mb-2">Executive Report</h3>
      <p className="text-sm text-slate-600 mb-4">Generate a concise executive report and download a board-ready PDF.</p>
      <div className="flex gap-3">
        <button onClick={generatePreview} className="px-4 py-2 bg-[#efe8de] rounded-2xl font-bold text-sm">{loading ? 'Generating...' : 'Generate Executive Report'}</button>
        <button onClick={downloadPdf} className="px-4 py-2 bg-[#8c6239] text-white rounded-2xl font-bold text-sm">{loading ? 'Preparing PDF...' : 'Download Board Report'}</button>
        <button
          onClick={() => setShowEmailInput((current) => !current)}
          className="px-4 py-2 bg-[#334155] text-white rounded-2xl font-bold text-sm"
        >
          Send to Email
        </button>
      </div>

      {showEmailInput && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[rgba(176,122,77,0.12)] bg-white/70 p-4">
          <label className="text-sm font-bold text-slate-700" htmlFor="board-report-email">
            Recipient email
          </label>
          <input
            id="board-report-email"
            ref={emailInputRef}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#8c6239]"
          />
          <div className="flex gap-3">
            <button
              onClick={sendToEmail}
              disabled={loading}
              className="px-4 py-2 bg-emerald-700 text-white rounded-2xl font-bold text-sm disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send PDF'}
            </button>
            <button
              onClick={() => {
                setShowEmailInput(false);
                setError(null);
              }}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-2xl font-bold text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm font-semibold text-rose-600">
          {error}
        </p>
      )}

      {emailSent && (
        <p className="mt-3 text-sm font-semibold text-emerald-700">
          Board report sent to {emailSent}.
        </p>
      )}

      {report && (
        <div className="mt-4">
          <ExecutiveReportPreview report={report} />
        </div>
      )}
    </div>
  );
}
