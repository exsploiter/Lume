import * as acorn from 'acorn';
import { ancestor as walkAncestor, simple as walkSimple } from 'acorn-walk';
import type { ParsedFile, SecurityFinding, VulnerabilitySeverity } from '@/types';
import { makeFindingId } from '@/lib/security/security-utils';

/**
 * Shannon entropy calculation for secret detection.
 * Shannon entropy of random cryptographic strings (e.g. hex, base64) is typically > 4.5
 */
export function calculateShannonEntropy(str: string): number {
  if (!str || str.length === 0) return 0;
  const frequencies = new Map<string, number>();
  for (const char of str) {
    frequencies.set(char, (frequencies.get(char) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of frequencies.values()) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

interface TaintSource {
  name: string;
  type: 'param' | 'req_property' | 'env' | 'global_input';
  node: any;
}

interface TaintSink {
  id: string;
  title: string;
  category: string;
  severity: VulnerabilitySeverity;
  owaspIds: string[];
  cweIds: string[];
  exploitability: number;
  recommendation: string;
  matchSink: (node: any, getIdentifierName: (n: any) => string | null) => boolean;
  sinkDescription: string;
}

// Known sinks mapped to OWASP / CWE standards
const SINKS: TaintSink[] = [
  {
    id: 'sql-injection-ast',
    title: 'SQL Injection via Tainted Data-Flow',
    category: 'Injection',
    severity: 'critical',
    owaspIds: ['A03'],
    cweIds: ['CWE_89', 'CWE_564'],
    exploitability: 0.95,
    recommendation: 'Use parameterized queries, prepared statements, or an ORM with parameter bindings instead of concatenating untrusted inputs.',
    sinkDescription: 'Database query execution receives unescaped, untrusted input.',
    matchSink: (node, getName) => {
      if (node.type === 'CallExpression') {
        const callee = node.callee;
        if (callee.type === 'MemberExpression') {
          const propName = callee.property?.name;
          const objName = getName(callee.object)?.toLowerCase() || '';
          if (
            (propName === 'query' || propName === 'execute' || propName === 'raw') &&
            (objName.includes('db') || objName.includes('pool') || objName.includes('client') || objName.includes('knex') || objName.includes('sequelize') || objName.includes('prisma') || objName.includes('sql') || objName.includes('connection'))
          ) {
            return true;
          }
          if (propName === '$queryRawUnsafe' || propName === '$executeRawUnsafe') {
            return true;
          }
        }
      }
      return false;
    },
  },
  {
    id: 'command-injection-ast',
    title: 'Command Injection via Tainted Shell Execution',
    category: 'Injection',
    severity: 'critical',
    owaspIds: ['A03'],
    cweIds: ['CWE_78'],
    exploitability: 0.96,
    recommendation: 'Use execFile or spawn with argument arrays without shell interpolation (shell: false) and validate arguments against a strict allowlist.',
    sinkDescription: 'Operating system process spawned with user-controlled arguments or command strings.',
    matchSink: (node, getName) => {
      if (node.type === 'CallExpression') {
        const callee = node.callee;
        let funcName = '';
        if (callee.type === 'Identifier') {
          funcName = callee.name;
        } else if (callee.type === 'MemberExpression') {
          funcName = callee.property?.name || '';
        }
        return ['exec', 'execSync', 'spawn', 'spawnSync', 'popen', 'system'].includes(funcName);
      }
      return false;
    },
  },
  {
    id: 'ssrf-ast',
    title: 'Server-Side Request Forgery (SSRF) via Tainted URL',
    category: 'SSRF',
    severity: 'critical',
    owaspIds: ['A10'],
    cweIds: ['CWE_918'],
    exploitability: 0.9,
    recommendation: 'Validate URLs against an allowlist of trusted domains and enforce private IP / internal metadata blocklists (127.0.0.1, 169.254.169.254).',
    sinkDescription: 'Outgoing HTTP/network request initiated using an untrusted destination URL.',
    matchSink: (node, getName) => {
      if (node.type === 'CallExpression') {
        const callee = node.callee;
        if (callee.type === 'Identifier' && (callee.name === 'fetch' || callee.name === 'request')) {
          return true;
        }
        if (callee.type === 'MemberExpression') {
          const prop = callee.property?.name;
          const obj = getName(callee.object)?.toLowerCase() || '';
          if ((obj === 'axios' || obj === 'http' || obj === 'https' || obj === 'needle' || obj === 'got') &&
              ['get', 'post', 'put', 'patch', 'delete', 'request'].includes(prop || '')) {
            return true;
          }
        }
      }
      return false;
    },
  },
  {
    id: 'path-traversal-ast',
    title: 'Path Traversal via Tainted File System Operation',
    category: 'Path',
    severity: 'high',
    owaspIds: ['A05'],
    cweIds: ['CWE_22'],
    exploitability: 0.85,
    recommendation: 'Normalize paths using path.resolve and verify the resulting path starts within an intended directory boundary.',
    sinkDescription: 'File system read, write, or stream opened with user-supplied path components.',
    matchSink: (node, getName) => {
      if (node.type === 'CallExpression') {
        const callee = node.callee;
        if (callee.type === 'MemberExpression') {
          const prop = callee.property?.name || '';
          const obj = getName(callee.object)?.toLowerCase() || '';
          if (obj === 'fs' || obj === 'fspromises' || obj === 'fs/promises') {
            return ['readFile', 'readFileSync', 'createReadStream', 'writeFile', 'writeFileSync', 'unlink', 'unlinkSync'].includes(prop);
          }
        }
      }
      return false;
    },
  },
  {
    id: 'xss-ast',
    title: 'Cross-Site Scripting (XSS) via Unsafe DOM/Response Injection',
    category: 'XSS',
    severity: 'high',
    owaspIds: ['A03', 'A05'],
    cweIds: ['CWE_79', 'CWE_116'],
    exploitability: 0.88,
    recommendation: 'Sanitize untrusted content with DOMPurify, use textContent, or utilize framework automatic escaping mechanisms.',
    sinkDescription: 'Untrusted data directly written into DOM innerHTML or unescaped response writer.',
    matchSink: (node) => {
      if (node.type === 'AssignmentExpression') {
        const left = node.left;
        if (left.type === 'MemberExpression' && left.property) {
          const prop = left.property.name;
          return prop === 'innerHTML' || prop === 'outerHTML';
        }
      }
      if (node.type === 'Property') {
        if (node.key?.name === 'dangerouslySetInnerHTML') {
          return true;
        }
      }
      return false;
    },
  },
  {
    id: 'eval-ast',
    title: 'Unsafe Dynamic Code Evaluation',
    category: 'Injection',
    severity: 'critical',
    owaspIds: ['A03'],
    cweIds: ['CWE_94', 'CWE_95'],
    exploitability: 0.95,
    recommendation: 'Replace eval, Function constructor, or vm.runInContext with static parsers or typed dispatch tables.',
    sinkDescription: 'Dynamic code execution evaluated from variable or expression.',
    matchSink: (node) => {
      if (node.type === 'CallExpression') {
        if (node.callee.type === 'Identifier' && node.callee.name === 'eval') return true;
        if (node.callee.type === 'MemberExpression') {
          const prop = node.callee.property?.name;
          if (prop === 'runInNewContext' || prop === 'runInThisContext') return true;
        }
      }
      if (node.type === 'NewExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'Function') {
        return true;
      }
      return false;
    },
  },
];

// Helper to extract a readable name for an AST node
function getIdentifierName(node: any): string | null {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression') {
    const obj = getIdentifierName(node.object);
    const prop = getIdentifierName(node.property) || node.property?.value;
    return obj && prop ? `${obj}.${prop}` : prop || obj;
  }
  return null;
}

// Check if a node qualifies as an untrusted taint source
function isTaintSource(node: any): boolean {
  if (!node) return false;
  const name = getIdentifierName(node)?.toLowerCase() || '';
  if (
    name.startsWith('req.') ||
    name.startsWith('request.') ||
    name.startsWith('ctx.') ||
    name.startsWith('searchparams') ||
    name.startsWith('url.search')
  ) {
    if (name === 'req.method' || name === 'request.method') return false;
    return true;
  }
  return false;
}

// Check if an expression passes through a known sanitizer
function isSanitizerCall(node: any): boolean {
  if (!node || node.type !== 'CallExpression') return false;
  const name = getIdentifierName(node.callee)?.toLowerCase() || '';
  return (
    name.includes('sanitize') ||
    name.includes('escape') ||
    name.includes('encodeuri') ||
    name.includes('parseint') ||
    name.includes('parsenumber') ||
    name.includes('number') ||
    name.includes('validator') ||
    name.includes('dompurify')
  );
}

// Recursively checks if an expression is derived from an untrusted taint source
function resolveTaintSource(
  node: any,
  taintedVars: Map<string, { sourceDesc: string; line: number; sanitized: boolean }>
): string | null {
  if (!node) return null;
  if (isSanitizerCall(node)) return null;

  if (isTaintSource(node)) {
    return getIdentifierName(node) || 'untrusted input';
  }

  const name = getIdentifierName(node);
  if (name && taintedVars.has(name)) {
    const t = taintedVars.get(name)!;
    if (!t.sanitized) return t.sourceDesc;
    return null;
  }

  if (node.type === 'BinaryExpression' && node.operator === '+') {
    return resolveTaintSource(node.left, taintedVars) || resolveTaintSource(node.right, taintedVars);
  }

  if (node.type === 'LogicalExpression') {
    return resolveTaintSource(node.left, taintedVars) || resolveTaintSource(node.right, taintedVars);
  }

  if (node.type === 'ConditionalExpression') {
    return resolveTaintSource(node.consequent, taintedVars) || resolveTaintSource(node.alternate, taintedVars);
  }

  if (node.type === 'TemplateLiteral') {
    for (const expr of node.expressions || []) {
      const src = resolveTaintSource(expr, taintedVars);
      if (src) return src;
    }
  }

  return null;
}

/**
 * Performs AST Data-Flow and Taint Analysis across the parsed file
 */
export function runTaintAnalysis(file: ParsedFile): SecurityFinding[] {
  let ast: acorn.Program;
  try {
    ast = acorn.parse(file.content, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
      allowHashBang: true,
      allowReturnOutsideFunction: true,
      allowImportExportEverywhere: true,
    });
  } catch {
    // If Acorn fails (e.g. JSX or complex TypeScript syntax), fallback cleanly
    return [];
  }

  const findings: SecurityFinding[] = [];
  const lines = file.content.split(/\r?\n/);

  // 1. Tainted Variables Tracking
  // Map identifier name -> { sourceDesc, line, sanitized }
  const taintedVars = new Map<string, { sourceDesc: string; line: number; sanitized: boolean }>();

  // Pass 1: Identify Sources & Variable Assignments
  walkSimple(ast, {
    VariableDeclarator(node: any) {
      if (!node.id || !node.init) return;
      const varName = node.id.name;
      if (!varName) return;

      if (isSanitizerCall(node.init)) {
        taintedVars.set(varName, {
          sourceDesc: 'sanitized',
          line: node.loc?.start?.line ?? 1,
          sanitized: true,
        });
        return;
      }

      const taintSource = resolveTaintSource(node.init, taintedVars);
      if (taintSource) {
        taintedVars.set(varName, {
          sourceDesc: taintSource,
          line: node.loc?.start?.line ?? 1,
          sanitized: false,
        });
      }
    },

    AssignmentExpression(node: any) {
      if (node.left.type === 'Identifier') {
        const varName = node.left.name;
        if (isSanitizerCall(node.right)) {
          if (taintedVars.has(varName)) {
            const current = taintedVars.get(varName)!;
            current.sanitized = true;
          }
        } else {
          const taintSource = resolveTaintSource(node.right, taintedVars);
          if (taintSource) {
            taintedVars.set(varName, {
              sourceDesc: taintSource,
              line: node.loc?.start?.line ?? 1,
              sanitized: false,
            });
          }
        }
      }
    },
  });

  // Pass 2: Identify Sinks that receive tainted variables or direct sources
  walkAncestor(ast, {
    CallExpression(node: any) {
      for (const sink of SINKS) {
        if (!sink.matchSink(node, getIdentifierName)) continue;

        let taintedArgFound: { argIndex: number; sourceDesc: string } | null = null;
        const args = node.arguments || [];

        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          const taintSource = resolveTaintSource(arg, taintedVars);
          if (taintSource) {
            taintedArgFound = {
              argIndex: i,
              sourceDesc: taintSource,
            };
            break;
          }
        }

        if (taintedArgFound) {
          const lineStart = node.loc?.start?.line ?? 1;
          const lineEnd = node.loc?.end?.line ?? lineStart;
          const evidenceLine = lines[lineStart - 1] || `${sink.id} matched`;

          findings.push({
            id: makeFindingId(sink.id, file.path, lineStart, evidenceLine),
            ruleId: sink.id,
            title: sink.title,
            description: `${sink.sinkDescription} Taint path traced from source '${taintedArgFound.sourceDesc}' into sink argument #${taintedArgFound.argIndex + 1}.`,
            severity: sink.severity,
            filePath: file.path,
            lineStart,
            lineEnd,
            evidence: evidenceLine.trim(),
            recommendation: sink.recommendation,
            occurrenceCount: 1,
            exploitability: sink.exploitability,
            owaspIds: sink.owaspIds,
            cweIds: sink.cweIds,
            category: sink.category,
          });
        }
      }
    },

    // Check Assignment Expressions for XSS (e.g. element.innerHTML = tainted)
    AssignmentExpression(node: any) {
      for (const sink of SINKS) {
        if (!sink.matchSink(node, getIdentifierName)) continue;
        const right = node.right;
        const rightName = getIdentifierName(right);
        let isTainted = false;
        let sourceDesc = '';

        if (isTaintSource(right)) {
          isTainted = true;
          sourceDesc = 'direct untrusted input';
        } else if (rightName && taintedVars.has(rightName) && !taintedVars.get(rightName)?.sanitized) {
          isTainted = true;
          sourceDesc = taintedVars.get(rightName)!.sourceDesc;
        } else if (right.type === 'TemplateLiteral') {
          for (const expr of right.expressions || []) {
            if (isTaintSource(expr) || (getIdentifierName(expr) && taintedVars.has(getIdentifierName(expr)!))) {
              isTainted = true;
              sourceDesc = 'template literal';
              break;
            }
          }
        }

        if (isTainted) {
          const lineStart = node.loc?.start?.line ?? 1;
          const lineEnd = node.loc?.end?.line ?? lineStart;
          const evidenceLine = lines[lineStart - 1] || 'innerHTML assignment';
          findings.push({
            id: makeFindingId(sink.id, file.path, lineStart, evidenceLine),
            ruleId: sink.id,
            title: sink.title,
            description: `${sink.sinkDescription} Assignment receives untrusted data (${sourceDesc}).`,
            severity: sink.severity,
            filePath: file.path,
            lineStart,
            lineEnd,
            evidence: evidenceLine.trim(),
            recommendation: sink.recommendation,
            occurrenceCount: 1,
            exploitability: sink.exploitability,
            owaspIds: sink.owaspIds,
            cweIds: sink.cweIds,
            category: sink.category,
          });
        }
      }
    },
  });

  // Pass 3: AST Entropy-based Secret Detection
  // We analyze Literal strings assigned to secret-named variables, checking for high Shannon entropy (> 4.5)
  walkSimple(ast, {
    Literal(node: any) {
      if (typeof node.value !== 'string' || node.value.length < 16) return;
      const strVal = node.value;
      const entropy = calculateShannonEntropy(strVal);

      // Check if value exhibits cryptographic randomness or matches known secret tokens
      const isKnownTokenFormat =
        /^(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/.test(strVal) || // GitHub PAT
        /^AKIA[0-9A-Z]{16}/.test(strVal) || // AWS Access Key
        /^xox[baprs]-[0-9A-Za-z-]{10,}/.test(strVal) || // Slack Token
        /^sk_live_[0-9a-zA-Z]{24,}/.test(strVal); // Stripe Live Secret

      if (isKnownTokenFormat || (entropy > 4.5 && strVal.length >= 24)) {
        const lineStart = node.loc?.start?.line ?? 1;
        const lineEnd = node.loc?.end?.line ?? lineStart;
        const evidenceLine = lines[lineStart - 1] || 'high entropy secret';

        // Filter out obvious false positives (e.g. test files, long URLs, svg paths, hashes with words)
        const isUrl = strVal.startsWith('http://') || strVal.startsWith('https://');
        const isSvgPath = /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.-]{20,}$/.test(strVal);

        if (!isUrl && !isSvgPath) {
          findings.push({
            id: makeFindingId('high-entropy-secret-ast', file.path, lineStart, evidenceLine),
            ruleId: 'high-entropy-secret-ast',
            title: 'High-Entropy Secret / API Credential Detected',
            description: `A string literal exhibiting high cryptographic entropy (${entropy.toFixed(2)} bits/char) was detected directly in code.`,
            severity: 'critical',
            filePath: file.path,
            lineStart,
            lineEnd,
            evidence: evidenceLine.trim().slice(0, 120),
            recommendation: 'Extract this credential into environment variables or a secrets manager (e.g. AWS Secrets Manager, Vault) and rotate it immediately.',
            occurrenceCount: 1,
            exploitability: 0.98,
            owaspIds: ['A07'],
            cweIds: ['CWE_798', 'CWE_259'],
            category: 'Secrets',
          });
        }
      }
    },
  });

  return findings;
}
