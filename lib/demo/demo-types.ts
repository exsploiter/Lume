export interface DemoPresetMeta {
  id: 'fintech-core-banking' | 'cloud-native-saas' | 'enterprise-idp-gateway';
  name: string;
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  tagline: string;
  badge: string;
  badgeColor: string;
  trustScore: number;
  criticalVulns: number;
  highlightFeatures: string[];
}

export const DEMO_PRESETS: DemoPresetMeta[] = [
  {
    id: 'fintech-core-banking',
    name: 'FinTech Core Banking API',
    repoOwner: 'fintech-enterprise',
    repoName: 'ledger-core-api',
    repoUrl: 'https://github.com/fintech-enterprise/ledger-core-api',
    tagline: 'High Risk • Leaked AWS Secrets • SQLi in Ledger • Collapse Imminent',
    badge: 'High Risk (34/100)',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    trustScore: 34,
    criticalVulns: 3,
    highlightFeatures: ['Shortest Attack Path (3 hops)', 'Collapse Prediction (78%)', 'Failing SOC 2 CC6.7 & CC6.6'],
  },
  {
    id: 'cloud-native-saas',
    name: 'Cloud-Native SaaS Microservices',
    repoOwner: 'acme-saas',
    repoName: 'billing-workflow-service',
    repoUrl: 'https://github.com/acme-saas/billing-workflow-service',
    tagline: 'Moderate Risk • CI Gate Warnings • Improving Trend Trajectory',
    badge: 'Needs Review (74/100)',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    trustScore: 74,
    criticalVulns: 0,
    highlightFeatures: ['Longitudinal Trend (+14 pts)', 'Peer Benchmarking (78th pct)', 'Autofix Patch Available'],
  },
  {
    id: 'enterprise-idp-gateway',
    name: 'Enterprise Identity Gateway',
    repoOwner: 'authguard-systems',
    repoName: 'zero-trust-gateway',
    repoUrl: 'https://github.com/authguard-systems/zero-trust-gateway',
    tagline: 'Audit Ready • SOC 2 Type II & ISO 27001 Compliant • Hardened AST',
    badge: 'Safe to Ship (94/100)',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    trustScore: 94,
    criticalVulns: 0,
    highlightFeatures: ['100% SOC 2 Pass Rate', 'Zero Attack Chains', 'Top 10% Peer Benchmark'],
  },
];
