'use client';

import React from 'react';

export default function ExecutiveReportPreview({ report }: { report: any }) {
  if (!report) return null;

  return (
    <div className="glass-panel rounded-2xl p-4 border border-[rgba(176,122,77,0.08)] shadow-sm bg-white/60">
      <h3 className="font-extrabold text-lg text-slate-800 mb-2">Executive Report Preview</h3>
      <p className="text-sm text-slate-600 mb-3">{report.repositoryHealth}</p>
      <div className="mb-3">
        {report.executiveSummary?.map((p: string, i: number) => (
          <p key={i} className="text-sm text-slate-700 mb-2">{p}</p>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 text-sm">
        <div><strong>Top Risks:</strong> {report.topBusinessRisks?.slice(0,5).join(', ')}</div>
        <div><strong>Estimated Fix Cost:</strong> ₹{report.financialExposure?.estimatedFixCost?.toLocaleString()}</div>
        <div><strong>Incident Exposure:</strong> ₹{report.financialExposure?.estimatedIncidentExposure?.toLocaleString()}</div>
        <div><strong>Deployment:</strong> {report.deploymentRecommendation}</div>
        <div><strong>Compliance:</strong> {report.complianceSummary?.grade} ({report.complianceSummary?.score})</div>
      </div>
    </div>
  );
}
