import type { ParsedFile, SecurityFinding, VulnerabilitySeverity } from '@/types';
import { makeFindingId } from '@/lib/security/security-utils';

export interface DependencyEntry {
  name: string;
  version: string;
  isDev: boolean;
  ecosystem: 'npm' | 'PyPI' | 'Go' | 'Maven';
}

export interface SCAResult {
  dependenciesFound: DependencyEntry[];
  findings: SecurityFinding[];
  vulnerableCount: number;
}

/**
 * Extracts dependencies from package.json and lockfiles in the repository.
 */
export function extractDependenciesFromFiles(files: ParsedFile[]): DependencyEntry[] {
  const deps: DependencyEntry[] = [];
  const seen = new Set<string>();

  const pkgJsonFile = files.find((f) => f.path.endsWith('package.json') && !f.path.includes('node_modules'));
  if (pkgJsonFile) {
    try {
      const parsed = JSON.parse(pkgJsonFile.content);
      const regular = parsed.dependencies || {};
      const dev = parsed.devDependencies || {};

      for (const [name, rawVersion] of Object.entries(regular)) {
        const cleanedVersion = cleanVersion(String(rawVersion));
        const key = `npm:${name}:${cleanedVersion}`;
        if (!seen.has(key)) {
          seen.add(key);
          deps.push({ name, version: cleanedVersion, isDev: false, ecosystem: 'npm' });
        }
      }

      for (const [name, rawVersion] of Object.entries(dev)) {
        const cleanedVersion = cleanVersion(String(rawVersion));
        const key = `npm:${name}:${cleanedVersion}`;
        if (!seen.has(key)) {
          seen.add(key);
          deps.push({ name, version: cleanedVersion, isDev: true, ecosystem: 'npm' });
        }
      }
    } catch (e) {
      console.warn('[SCA] Failed to parse package.json:', e);
    }
  }

  // Also extract requirements.txt for Python repos
  const reqTxt = files.find((f) => f.path.endsWith('requirements.txt') && !f.path.includes('venv'));
  if (reqTxt) {
    const lines = reqTxt.content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([a-zA-Z0-9_\-]+)\s*(?:==|>=|<=|~=)\s*([0-9a-zA-Z._\-]+)/);
      if (match) {
        const name = match[1];
        const version = match[2];
        const key = `PyPI:${name}:${version}`;
        if (!seen.has(key)) {
          seen.add(key);
          deps.push({ name, version, isDev: false, ecosystem: 'PyPI' });
        }
      }
    }
  }

  return deps;
}

function cleanVersion(ver: string): string {
  // Strip ^, ~, >=, <=, v prefixes to query OSV accurately
  return ver.replace(/^[\^~>=<v\s]+/, '').split(' ')[0] || ver;
}

/**
 * Maps CVSS score or text severity to DebtRadar VulnerabilitySeverity
 */
function mapOSVSeverity(vuln: any): VulnerabilitySeverity {
  const cvssObj = vuln.severity?.find((s: any) => s.type?.startsWith('CVSS'));
  if (cvssObj?.score) {
    const scoreStr = cvssObj.score;
    // Extract base score if format is "CVSS:3.1/AV:N.../8.8" or numeric
    const numMatch = scoreStr.match(/\b([0-9]\.[0-9])\b/);
    if (numMatch) {
      const num = parseFloat(numMatch[1]);
      if (num >= 9.0) return 'critical';
      if (num >= 7.0) return 'high';
      if (num >= 4.0) return 'medium';
      return 'low';
    }
  }

  // Fallback to database_specific severity text
  const dbSeverity = (vuln.database_specific?.severity || '').toLowerCase();
  if (dbSeverity === 'critical') return 'critical';
  if (dbSeverity === 'high') return 'high';
  if (dbSeverity === 'moderate' || dbSeverity === 'medium') return 'medium';
  if (dbSeverity === 'low') return 'low';

  return 'high';
}

/**
 * Queries OSV.dev batch API for known CVEs/vulnerabilities
 */
export async function scanDependenciesWithOSV(files: ParsedFile[]): Promise<SCAResult> {
  const dependencies = extractDependenciesFromFiles(files);
  if (dependencies.length === 0) {
    return { dependenciesFound: [], findings: [], vulnerableCount: 0 };
  }

  // Limit batch size to top 40 dependencies to maintain fast response times
  const queriedDeps = dependencies.slice(0, 40);
  const pkgFile = files.find((f) => f.path.endsWith('package.json')) || files[0];
  const findings: SecurityFinding[] = [];

  try {
    const queries = queriedDeps.map((dep) => ({
      package: {
        name: dep.name,
        ecosystem: dep.ecosystem,
      },
      version: dep.version,
    }));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const response = await fetch('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      console.warn(`[SCA] OSV.dev returned HTTP ${response.status}`);
      return { dependenciesFound: dependencies, findings: [], vulnerableCount: 0 };
    }

    const data = await response.json();
    const results = data.results || [];

    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      const dep = queriedDeps[i];
      if (!res.vulns || res.vulns.length === 0) continue;

      for (const vuln of res.vulns.slice(0, 3)) { // Cap to top 3 per package
        const severity = mapOSVSeverity(vuln);
        const aliases = vuln.aliases || [];
        const cveId = aliases.find((a: string) => a.startsWith('CVE-')) || vuln.id;
        const cwes: string[] = [];

        // Extract CWEs from affected database specific
        if (vuln.affected) {
          for (const aff of vuln.affected) {
            const list = aff.database_specific?.cwes;
            if (Array.isArray(list)) {
              for (const c of list) cwes.push(c.replace('-', '_'));
            }
          }
        }
        if (cwes.length === 0) {
          cwes.push('CWE_1395'); // Dependency on Vulnerable Third-Party Component
        }

        const summary = vuln.summary || vuln.details?.slice(0, 100) || `Vulnerability in ${dep.name}`;
        const evidence = `"${dep.name}": "${dep.version}" (${cveId})`;

        findings.push({
          id: makeFindingId('sca-dep', pkgFile.path, 1, `${dep.name}-${cveId}`),
          ruleId: `sca-${dep.name}`,
          title: `Vulnerable Dependency: ${dep.name}@${dep.version} [${cveId}]`,
          description: `${summary}. Advisory ID: ${vuln.id}. Upstream software dependency contains known security advisory.`,
          severity,
          filePath: pkgFile.path,
          lineStart: 1,
          lineEnd: 1,
          evidence,
          recommendation: `Upgrade package '${dep.name}' to a patched version or replace with a secure alternative. Reference: https://osv.dev/vulnerability/${vuln.id}`,
          occurrenceCount: 1,
          exploitability: severity === 'critical' ? 0.92 : severity === 'high' ? 0.78 : 0.55,
          owaspIds: ['A06'], // OWASP A06:2021 - Vulnerable and Outdated Components
          cweIds: cwes.slice(0, 3),
          category: 'Third-Party Dependency',
        });
      }
    }
  } catch (err) {
    console.warn('[SCA] OSV scanning encountered an issue or timed out:', err);
  }

  return {
    dependenciesFound: dependencies,
    findings,
    vulnerableCount: findings.length,
  };
}
