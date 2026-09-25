export type AnalysisStatus =
  | 'pending'
  | 'fetching'
  | 'parsing'
  | 'scoring'
  | 'graphing'
  | 'complete'
  | 'failed';

export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface OWASPCategory {
  id: string;
  name: string;
  description: string;
}

export interface SecurityFinding {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: VulnerabilitySeverity;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  evidence: string;
  recommendation: string;
  occurrenceCount: number;
  exploitability: number;
  owaspIds: string[];
  cweIds: string[];
  category: string;
  suppressed?: boolean;
}

export interface SecuritySummary {
  totalVulnerabilities: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  score: number;
  categoryCounts: Record<string, number>;
  owaspCategories: string[];
  cweCategories: string[];
  topFindings: SecurityFinding[];
}

export interface SecurityCollapseResult {
  isCollapsed: boolean;
  severity: 'critical' | 'high' | 'moderate';
  reasons: string[];
  affectedCoreModules: string[];
  propagationRisk: number;
}

export interface SecurityNodeMetrics {
  securityScore: number;
  securityWeightedScore: number;
  hasCriticalSecurity: boolean;
  vulnerabilityCount: number;
  securityRiskLevel: VulnerabilitySeverity | 'none';
  owaspCategories: string[];
  cweCategories: string[];
  securityFindings: SecurityFinding[];
  criticalCount: number;
}

export interface SecurityAnalysisResult {
  findings: SecurityFinding[];
  summary: SecuritySummary;
  collapse: SecurityCollapseResult;
  nodeMetrics: Record<string, SecurityNodeMetrics>;
  repoSecurityScore: number;
  criticalVulnerabilities: number;
}

export interface AttackPath {
  sourceNode: string;
  targetNode: string;
  path: string[];
  propagationRisk: number;
  attackComplexity: number;
  privilegeEscalationPotential: number;
  exposedApis: string[];
  exploitabilityScore: number;
}

export interface AttackGraphResult {
  paths: AttackPath[];
  nodes: string[];
  links: GraphLink[];
  propagationRisk: number;
  criticalPaths: AttackPath[];
}

export interface CollapsePredictionResult {
  collapseProbability: number;
  collapseScore: number;
  predictedTimeline: string;
  criticalModules: string[];
  instabilityDrivers: string[];
  recommendedInterventions: string[];
  riskTrend: { label: string; value: number }[];
}

export interface PRRiskResult {
  mergeRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number;
  securityRegression: boolean;
  newVulnerabilities: SecurityFinding[];
  architectureImpact: string[];
  unstableChanges: string[];
  criticalFilesTouched: string[];
  recommendations: string[];
}

export interface ExploitabilityResult {
  repoExploitabilityScore: number;
  nodeExploitability: Record<string, {
    exploitabilityScore: number;
    publicExposure: boolean;
    attackSurfaceScore: number;
    propagationRisk: number;
    reachableSystems: string[];
    attackPaths: string[];
  }>;
  reachableAttackChains: number;
  publicExposureFiles: string[];
}

export interface AutoFixResult {
  summary: string;
  risk: string;
  beforeCode: string;
  afterCode: string;
  patch: string;
  confidence: number;
  estimatedRiskReduction: number;
}

export interface AnalysisRecord {
  id: string;
  user_id: string | null;
  repo_url: string;
  repo_owner: string;
  repo_name: string;
  status: AnalysisStatus;
  progress: number;
  progress_message: string | null;
  error_message: string | null;
  total_files: number;
  total_nodes: number;
  avg_debt_score: number;
  fingerprint_label: string | null;
  fingerprint_confidence: number | null;
  security_summary: SecuritySummary | null;
  security_collapse: boolean;
  critical_vulnerabilities: number;
  repo_security_score: number;
  collapse_score: number;
  collapse_prediction: CollapsePredictionResult | null;
  attack_graph: AttackGraphResult | null;
  repo_exploitability_score: number;
  high_risk_attack_paths: AttackPath[] | null;
  executiveSummary?: string;
  deploymentConfidence?: number;
  trustScore?: number;
  deploymentRecommendation?: 'SAFE TO SHIP' | 'NEEDS REVIEW' | 'HIGH RISK' | 'DEPLOYMENT NOT RECOMMENDED';
  businessRisks?: string[];
  operationalRisks?: string[];
  customerImpact?: string[];
  ignoreConsequences?: string[];
  consequenceForecast?: ConsequencePredictionResult | null;
  created_at: string;
  updated_at: string;
}

export interface DebtNode {
  id: string;
  analysis_id: string;
  file_path: string;
  symbol_name: string;
  node_type: 'function' | 'class' | 'module' | 'variable';
  line_start: number;
  line_end: number;
  debt_score: number;
  security_score: number;
  security_weighted_score: number;
  has_critical_security: boolean;
  vulnerability_count: number;
  security_risk_level: VulnerabilitySeverity | 'none';
  exploitability_score: number;
  collapse_risk: number;
  autofix_available: boolean;
  attack_surface_score: number;
  propagation_risk: number;
  public_exposure: boolean;
  critical_attack_paths: AttackPath[];
  fix_patch: string | null;
  fix_confidence: number;
  merge_risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  businessImpact?: string;
  deploymentUrgency?: string;
  customerImpact?: string;
  trustImpact?: number;
  complexity: number;
  duplication_score: number;
  blast_radius: number;
  owasp_categories: string[];
  cwe_categories: string[];
  security_findings: SecurityFinding[];
  dependencies: string[];
  dependents: string[];
  explanation: string | null;
  fingerprint_tag: string | null;
  x: number | null;
  y: number | null;
}

export interface GraphLink {
  source: string;
  target: string;
  weight: number;
}

export interface GraphData {
  nodes: DebtNode[];
  links: GraphLink[];
}

export interface AnalyzeRequest {
  repoUrl: string;
}

export interface ExplainRequest {
  nodeId: string;
  analysisId: string;
}

export interface FingerprintRequest {
  codeSnippet: string;
  nodeId?: string;
  analysisId?: string;
}

export interface RoadmapItem {
  rank: number;
  nodeId: string;
  filePath: string;
  symbolName: string;
  debtScore: number;
  securityScore: number;
  vulnerabilityCount: number;
  criticalSecurity: boolean;
  owaspCategories: string[];
  cweCategories: string[];
  blastRadius: number;
  priority: number;
  securityPriority: number;
  businessPriority: number;
  exploitabilityScore: number;
  collapseRisk: number;
  publicExposure: boolean;
  autofixAvailable: boolean;
  mergeRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  businessImpact: string;
  deploymentUrgency: string;
  customerImpact: string;
  trustImpact: number;
  explanation: string | null;
}

export interface FilterState {
  minScore: number;
  maxScore: number;
  nodeTypes: DebtNode['node_type'][];
  search: string;
  criticalSecurityOnly: boolean;
  owaspCategories: string[];
  cweCategories: string[];
  securityScoreThreshold: number;
  secretLeaksOnly: boolean;
  injectionOnly: boolean;
  exploitableOnly: boolean;
  collapseCriticalOnly: boolean;
  attackPathOnly: boolean;
  publicExposureOnly: boolean;
  autofixAvailableOnly: boolean;
}

export type ViewMode = 'technical' | 'business';

export interface BusinessTranslationResult {
  executiveSummary: string;
  businessImpact: string;
  customerImpact: string;
  operationalRisk: string;
  financialRisk: string;
  urgency: string;
  recommendedAction: string;
  impactTypes: string[];
}

export interface ConsequencePredictionResult {
  shortTermImpact: string;
  longTermImpact: string;
  productionRisk: string;
  customerRisk: string;
  scalabilityImpact: string;
  estimatedSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  likelyFailureScenarios: string[];
}

export interface DeploymentConfidenceResult {
  deploymentConfidence: number;
  deploymentRecommendation: 'SAFE TO SHIP' | 'NEEDS REVIEW' | 'HIGH RISK' | 'DEPLOYMENT NOT RECOMMENDED';
  productionReadiness: string;
  customerRiskLevel: string;
  operationalStability: string;
  securityExposure: string;
  architectureHealth: string;
  factors: string[];
}

export interface TrustScoreResult {
  trustScore: number;
  deploymentConfidence: number;
  operationalStability: number;
  securityExposure: number;
  architectureHealth: number;
  recommendation: 'SAFE TO SHIP' | 'NEEDS REVIEW' | 'HIGH RISK' | 'DEPLOYMENT NOT RECOMMENDED';
  reasons: string[];
}

export interface ParsedFile {
  path: string;
  content: string;
}

export interface ASTSymbol {
  id: string;
  filePath: string;
  name: string;
  type: DebtNode['node_type'];
  lineStart: number;
  lineEnd: number;
  complexity: number;
  calls: string[];
  calledBy: string[];
}
