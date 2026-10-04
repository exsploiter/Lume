import type { ComprehensiveComplianceAudit, ComplianceFrameworkType } from '@/types';

export function generateComplianceJson(audit: ComprehensiveComplianceAudit): string {
  return JSON.stringify(audit, null, 2);
}

export function generateComplianceMarkdown(audit: ComprehensiveComplianceAudit): string {
  const dateStr = new Date(audit.timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let md = `# DebtRadar Security & Governance Audit Report\n\n`;
  md += `**Repository:** \`${audit.repoOwner}/${audit.repoName}\` (${audit.repoUrl})\n`;
  md += `**Audit Timestamp:** ${dateStr}\n`;
  md += `**Audit Scope:** ${audit.auditMetadata.totalFilesScanned} files, ${audit.auditMetadata.totalSymbolsParsed} AST symbols\n`;
  md += `**Overall Readiness Score:** **${audit.overallReadinessScore}/100** (Grade: **${audit.overallGrade}**)\n`;
  md += `**Engine:** ${audit.auditMetadata.engineVersion}\n\n`;

  md += `---\n\n## 1. Executive Summary & Framework Status\n\n`;
  md += `| Framework | Version | Readiness | Status | Passing | Warning | Failing |\n`;
  md += `|---|---|---|---|---|---|---|\n`;

  const frameworks = Object.values(audit.frameworks);
  for (const fw of frameworks) {
    const statusPill =
      fw.status === 'AUDIT_READY' ? '🟢 AUDIT READY' : fw.status === 'MINOR_GAPS' ? '🟡 MINOR GAPS' : '🔴 NON-COMPLIANT';
    md += `| **${fw.displayName}** | ${fw.version} | ${fw.readinessScore}% | ${statusPill} | ${fw.passingControls} | ${fw.warningControls} | ${fw.failingControls} |\n`;
  }

  md += `\n---\n\n## 2. Critical Compliance Gaps\n\n`;
  if (audit.criticalGaps.length === 0) {
    md += `*No critical compliance non-conformities detected. All required controls satisfied baseline audit criteria.*\n\n`;
  } else {
    for (const gap of audit.criticalGaps) {
      md += `- ❌ **${gap}**\n`;
    }
    md += `\n`;
  }

  md += `---\n\n## 3. Detailed Control Matrix by Framework\n\n`;

  for (const fw of frameworks) {
    md += `### ${fw.displayName} (${fw.version})\n\n`;
    md += `*${fw.summary}*\n\n`;
    md += `| Control ID | Title | Category | Status | Findings | Guidance |\n`;
    md += `|---|---|---|---|---|---|\n`;

    for (const ctrl of fw.controls) {
      const statusIcon =
        ctrl.status === 'PASS' ? '✅ PASS' : ctrl.status === 'WARNING' ? '⚠️ WARN' : '❌ FAIL';
      const findingsText = ctrl.findingCount > 0 ? `${ctrl.findingCount} finding(s)` : 'None';
      md += `| \`${ctrl.id}\` | **${ctrl.title}** | ${ctrl.category} | ${statusIcon} | ${findingsText} | ${ctrl.remediationGuidance} |\n`;
    }
    md += `\n`;
  }

  md += `---\n\n## 4. Prioritized Remediation Roadmap\n\n`;
  if (audit.remediationRoadmap.length === 0) {
    md += `*No immediate remediation items required.*\n\n`;
  } else {
    md += `| Priority | Framework | Control | Required Action | Estimated Effort |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const item of audit.remediationRoadmap) {
      const pBadge = item.priority === 'P0' ? '🔴 P0 (Critical)' : item.priority === 'P1' ? '🟡 P1 (High)' : '⚪ P2 (Standard)';
      md += `| ${pBadge} | ${item.framework} | \`${item.controlId}\` | ${item.action} | ${item.estimatedEffort} |\n`;
    }
    md += `\n`;
  }

  md += `---\n\n*Generated automatically by DebtRadar CI/CD Compliance Intelligence Platform.*`;
  return md;
}

export function generateComplianceCsv(audit: ComprehensiveComplianceAudit): string {
  const headers = [
    'Framework',
    'Control ID',
    'Control Title',
    'Category',
    'Status',
    'Total Findings',
    'Critical Findings',
    'Violating Files Count',
    'Audit Requirement',
    'Remediation Guidance',
  ];

  const rows: string[][] = [headers];

  for (const fw of Object.values(audit.frameworks)) {
    for (const ctrl of fw.controls) {
      rows.push([
        escapeCsv(fw.displayName),
        escapeCsv(ctrl.id),
        escapeCsv(ctrl.title),
        escapeCsv(ctrl.category),
        escapeCsv(ctrl.status),
        String(ctrl.findingCount),
        String(ctrl.criticalFindingCount),
        String(ctrl.violatingFiles.length),
        escapeCsv(ctrl.auditRequirement),
        escapeCsv(ctrl.remediationGuidance),
      ]);
    }
  }

  return rows.map((r) => r.join(',')).join('\n');
}

function escapeCsv(str: string): string {
  if (!str) return '""';
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}
