const CWE: Record<string, string> = {
  CWE_79: 'Cross-site Scripting',
  CWE_89: 'SQL Injection',
  CWE_94: 'Code Injection',
  CWE_95: 'Eval Injection',
  CWE_116: 'Improper Encoding or Escaping',
  CWE_22: 'Path Traversal',
  CWE_78: 'OS Command Injection',
  CWE_94A: 'Unsafe Deserialization',
  CWE_200: 'Information Exposure',
  CWE_284: 'Improper Access Control',
  CWE_330: 'Insufficiently Random Values',
  CWE_352: 'Cross-Site Request Forgery',
  CWE_400: 'Uncontrolled Resource Consumption',
  CWE_502: 'Deserialization of Untrusted Data',
  CWE_611: 'XML External Entity',
  CWE_732: 'Incorrect Permission Assignment',
  CWE_918: 'Server-Side Request Forgery',
  CWE_693: 'Protection Mechanism Failure',
  CWE_20: 'Improper Input Validation',
  CWE_94B: 'Prototype Pollution',
};

export function mapCWE(id: string): string {
  return CWE[id] ?? id;
}

export function mapCWEIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => mapCWE(id)))];
}
