export interface RankedAttackPath {
  sourceNode: string;
  targetNode: string;
  path: string[];
  propagationRisk: number;
  attackComplexity: number;
  privilegeEscalationPotential: number;
  exposedApis: string[];
  exploitabilityScore: number;
}

export interface AttackPropagationGraph {
  nodes: string[];
  links: Array<{ source: string; target: string; weight: number }>;
  paths: RankedAttackPath[];
  criticalPaths: RankedAttackPath[];
  propagationRisk: number;
}
