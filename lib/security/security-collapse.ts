import type { ASTSymbol, SecurityAnalysisResult, SecurityCollapseResult } from '@/types';
import { isSecuritySensitivePath, severityRank, unique } from '@/lib/security/security-utils';

export function analyzeSecurityCollapse(params: {
  security: SecurityAnalysisResult;
  symbols: ASTSymbol[];
  blastRadiusMap: Map<string, number>;
}): SecurityCollapseResult {
  const { security, symbols, blastRadiusMap } = params;
  const reasons: string[] = [];
  const affectedCoreModules = new Set<string>();

  if (security.criticalVulnerabilities >= 3) {
    reasons.push(`Critical vulnerabilities count reached ${security.criticalVulnerabilities}`);
  }

  if (security.repoSecurityScore > 75) {
    reasons.push(`Repository security score is ${security.repoSecurityScore.toFixed(1)}/100`);
  }

  const fileToSymbols = new Map<string, ASTSymbol[]>();
  for (const symbol of symbols) {
    const bucket = fileToSymbols.get(symbol.filePath) ?? [];
    bucket.push(symbol);
    fileToSymbols.set(symbol.filePath, bucket);
  }

  for (const [filePath, metrics] of Object.entries(security.nodeMetrics)) {
    const related = fileToSymbols.get(filePath) ?? [];
    const propagation = Math.max(
      metrics.securityScore,
      ...related.map((symbol) => blastRadiusMap.get(symbol.id) ?? 0)
    );
    if (metrics.hasCriticalSecurity && isSecuritySensitivePath(filePath)) {
      reasons.push(`Critical security issues exist in sensitive module ${filePath}`);
      affectedCoreModules.add(filePath);
    }
    if (metrics.hasCriticalSecurity && related.some((symbol) => (blastRadiusMap.get(symbol.id) ?? 0) > 15)) {
      reasons.push(`High blast-radius module ${filePath} contains critical vulnerabilities`);
      affectedCoreModules.add(filePath);
    }
    if (propagation > 80 && metrics.hasCriticalSecurity) {
      reasons.push(`Vulnerable code in ${filePath} shows high propagation risk (${propagation.toFixed(1)})`);
      affectedCoreModules.add(filePath);
    }
  }

  const transitiveHotspots = symbols.filter((symbol) => {
    const nodeMetrics = security.nodeMetrics[symbol.filePath];
    return nodeMetrics?.hasCriticalSecurity && (symbol.calledBy.length > 15 || (blastRadiusMap.get(symbol.id) ?? 0) > 15);
  });

  if (transitiveHotspots.length > 0) {
    reasons.push(`Vulnerable core modules are depended upon by more than 15 files`);
    for (const hotspot of transitiveHotspots) {
      affectedCoreModules.add(hotspot.filePath);
    }
  }

  const secretLeaks = security.findings.filter((finding) => finding.category === 'Secrets' && finding.severity === 'critical');
  if (secretLeaks.some((finding) => isSecuritySensitivePath(finding.filePath))) {
    reasons.push(`Secrets are exposed in production security/authentication paths`);
    for (const finding of secretLeaks) affectedCoreModules.add(finding.filePath);
  }

  const propagationRisk = Math.min(
    100,
    Math.round(
      ((security.criticalVulnerabilities * 16) +
        unique([...affectedCoreModules]).length * 12 +
        reasons.length * 8 +
        security.repoSecurityScore * 0.6)
    )
  );

  const collapse =
    security.criticalVulnerabilities >= 3 ||
    security.repoSecurityScore > 75 ||
    transitiveHotspots.length > 0 ||
    secretLeaks.some((finding) => isSecuritySensitivePath(finding.filePath)) ||
    security.findings.some((finding) => finding.severity === 'high' && isSecuritySensitivePath(finding.filePath));

  const severity = collapse
    ? security.criticalVulnerabilities >= 3 || security.repoSecurityScore > 85
      ? 'critical'
      : 'high'
    : 'moderate';

  return {
    isCollapsed: collapse,
    severity,
    reasons: unique(reasons),
    affectedCoreModules: unique([...affectedCoreModules]),
    propagationRisk,
  };
}
