import type { BusinessTranslationResult } from '@/types';
import { containsAny } from '@/lib/risk-utils';

const IMPACT_MAP: Array<{ keywords: string[]; impact: string; customerImpact: string; operationalRisk: string; financialRisk: string; urgency: string; recommendedAction: string; impactTypes: string[] }> = [
  {
    keywords: ['jwt', 'auth', 'authentication', 'authorization', 'login', 'session'],
    impact: 'Attackers may gain unauthorized access to protected accounts or administrative controls.',
    customerImpact: 'Sensitive customer actions may be exposed to the wrong user.',
    operationalRisk: 'Identity and access workflows may become unreliable or unsafe.',
    financialRisk: 'Account abuse and incident response costs may increase materially.',
    urgency: 'Immediate',
    recommendedAction: 'Patch access control logic before any production release.',
    impactTypes: ['Authentication Risk', 'Deployment Risk', 'Reputation Risk'],
  },
  {
    keywords: ['sql injection', 'database', 'query', 'postgres', 'prisma', 'orm'],
    impact: 'Customer and payment data may be exposed or altered.',
    customerImpact: 'Private records may be read, changed, or deleted by an attacker.',
    operationalRisk: 'Core data operations may become unreliable during exploitation or mitigation.',
    financialRisk: 'Data breach response, legal exposure, and customer churn could be significant.',
    urgency: 'High',
    recommendedAction: 'Add parameterized access and review all database entry points.',
    impactTypes: ['Customer Data Exposure', 'Compliance Risk', 'Payment Risk'],
  },
  {
    keywords: ['csrf', 'xss', 'dangerouslysetinnerhtml', 'html injection'],
    impact: 'Attackers may manipulate the user experience or steal session data.',
    customerImpact: 'Users could see altered content or lose trust in the application.',
    operationalRisk: 'Public-facing flows may be exploited without code changes.',
    financialRisk: 'Fraud, support load, and reputational harm may follow an incident.',
    urgency: 'High',
    recommendedAction: 'Sanitize inputs and harden browser-side trust boundaries.',
    impactTypes: ['Reputation Risk', 'Service Disruption', 'Customer Data Exposure'],
  },
  {
    keywords: ['payment', 'billing', 'invoice', 'checkout', 'subscription'],
    impact: 'Payment and billing workflows may fail or be manipulated.',
    customerImpact: 'Customers may be unable to pay or may be charged incorrectly.',
    operationalRisk: 'Revenue-critical workflows may require emergency intervention.',
    financialRisk: 'Direct revenue loss and chargeback exposure may increase.',
    urgency: 'High',
    recommendedAction: 'Treat the affected flow as revenue-critical and add extra review.',
    impactTypes: ['Payment Risk', 'Operational Instability', 'Deployment Risk'],
  },
];

export function translateTechnicalRisk(params: {
  technicalFinding: string;
  severity: string;
  exploitability: number;
  blastRadius: number;
  affectedSystems: string[];
}): BusinessTranslationResult {
  const lowered = params.technicalFinding.toLowerCase();
  const mapped = IMPACT_MAP.find((entry) => entry.keywords.some((keyword) => containsAny(lowered, [keyword])));

  const impactTypes = mapped?.impactTypes ?? [
    params.blastRadius > 8 ? 'Operational Instability' : 'Deployment Risk',
    params.exploitability >= 65 ? 'Reputation Risk' : 'Service Disruption',
  ];

  const executiveSummary = mapped?.impact ?? `This issue could affect ${params.affectedSystems.length > 0 ? params.affectedSystems.length + ' important system area(s)' : 'multiple parts of the application'}.`;
  const businessImpact = mapped?.impact ?? 'This technical issue has potential business impact that should be reviewed before release.';
  const customerImpact = mapped?.customerImpact ?? (params.blastRadius >= 5 ? 'Customers may experience failures across multiple product areas.' : 'Some customers may notice degraded behavior or intermittent issues.');
  const operationalRisk = mapped?.operationalRisk ?? (params.blastRadius >= 7 ? 'Operations teams may need to handle cascading incidents.' : 'Operations may need to investigate localized instability.');
  const financialRisk = mapped?.financialRisk ?? (params.exploitability >= 70 ? 'Incident response and remediation costs may rise.' : 'The financial impact is likely limited but still worth managing.');
  const urgency = mapped?.urgency ?? (params.severity === 'critical' ? 'Immediate' : params.severity === 'high' ? 'High' : 'Moderate');
  const recommendedAction = mapped?.recommendedAction ?? 'Review the issue before deployment and add safeguards.';

  return {
    executiveSummary,
    businessImpact,
    customerImpact,
    operationalRisk,
    financialRisk,
    urgency,
    recommendedAction,
    impactTypes,
  };
}
