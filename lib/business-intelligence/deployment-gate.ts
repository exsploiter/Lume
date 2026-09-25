export type DeploymentGateState = 'SAFE TO SHIP' | 'DEPLOY WITH CAUTION' | 'HIGH RISK' | 'DO NOT DEPLOY';

export interface DeploymentGateResult {
  state: DeploymentGateState;
  reasons: string[];
}

export function calculateDeploymentGate(params: {
  deploymentConfidence: number;
  criticalVulnerabilities: number;
  exploitabilityScore: number;
  collapseRisk: number;
}): DeploymentGateResult {
  const state =
    params.deploymentConfidence >= 90 && params.criticalVulnerabilities === 0 && params.exploitabilityScore < 45 && params.collapseRisk < 45
      ? 'SAFE TO SHIP'
      : params.deploymentConfidence >= 75
        ? 'DEPLOY WITH CAUTION'
        : params.deploymentConfidence >= 60
          ? 'HIGH RISK'
          : 'DO NOT DEPLOY';

  const reasons = buildReasons(params).slice(0, 3);

  return {
    state,
    reasons,
  };
}

function buildReasons(params: {
  deploymentConfidence: number;
  criticalVulnerabilities: number;
  exploitabilityScore: number;
  collapseRisk: number;
}): string[] {
  const reasons: string[] = [];

  if (params.criticalVulnerabilities > 0) {
    reasons.push(
      params.criticalVulnerabilities === 1
        ? 'Critical authentication vulnerability'
        : `${params.criticalVulnerabilities} critical vulnerabilities detected`
    );
  }

  if (params.exploitabilityScore >= 70) {
    reasons.push('High attack propagation risk');
  } else if (params.exploitabilityScore >= 50) {
    reasons.push('Meaningful exploitability exposure');
  }

  if (params.collapseRisk >= 70) {
    reasons.push('Elevated collapse probability');
  } else if (params.collapseRisk >= 50) {
    reasons.push('Architecture is under stress');
  }

  if (params.deploymentConfidence < 75) {
    reasons.push('Deployment confidence is below the preferred threshold');
  }

  if (reasons.length === 0) {
    reasons.push('No immediate blockers detected');
  }

  return reasons;
}