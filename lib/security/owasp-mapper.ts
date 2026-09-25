import type { OWASPCategory } from '@/types';

const OWASP: Record<string, OWASPCategory> = {
  'A01': { id: 'A01', name: 'Broken Access Control', description: 'Authorization and access control flaws.' },
  'A02': { id: 'A02', name: 'Cryptographic Failures', description: 'Weak or disabled cryptography and key handling.' },
  'A03': { id: 'A03', name: 'Injection', description: 'SQL, command, template, and other injection flaws.' },
  'A04': { id: 'A04', name: 'Insecure Design', description: 'Design-level security weaknesses and unsafe defaults.' },
  'A05': { id: 'A05', name: 'Security Misconfiguration', description: 'Unsafe configuration and exposure of sensitive surfaces.' },
  'A06': { id: 'A06', name: 'Vulnerable and Outdated Components', description: 'Risks from unsafe third-party code or dependencies.' },
  'A07': { id: 'A07', name: 'Identification and Authentication Failures', description: 'Weak session, token, or authentication handling.' },
  'A08': { id: 'A08', name: 'Software and Data Integrity Failures', description: 'Unsafe deserialization, supply-chain, and integrity issues.' },
  'A09': { id: 'A09', name: 'Security Logging and Monitoring Failures', description: 'Insufficient security observability or unsafe logging.' },
  'A10': { id: 'A10', name: 'Server-Side Request Forgery', description: 'Unsafe server-side fetches and internal request pivoting.' },
};

export function mapOWASP(id: string): OWASPCategory {
  return OWASP[id] ?? { id, name: id, description: 'Mapped security category.' };
}

export function mapOWASPIds(ids: string[]): OWASPCategory[] {
  return [...new Map(ids.map((id) => [id, mapOWASP(id)])).values()];
}
