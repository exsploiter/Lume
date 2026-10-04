/**
 * DebtRadar Trust Score & Financial Exposure Methodology
 * 
 * Formalized Mathematical Framework anchored in:
 * 1. IBM Security / Ponemon Institute "Cost of a Data Breach Report 2023-2024" (India & Global)
 * 2. Digital Personal Data Protection (DPDP) Act 2023 (Section 33 Statutory Penalties)
 * 3. CERT-In Cyber Incident Reporting Guidelines & Cyber Crisis Management Plan
 */

export type OrgRiskProfile = 'standard' | 'fintech_banking' | 'enterprise_saas' | 'startup_oss';

export interface ProfileWeights {
  securityWeight: number;
  collapseWeight: number;
  exploitabilityWeight: number;
  propagationWeight: number;
  blastRadiusWeight: number;
  architectureWeight: number;
  authPenaltyPerIssue: number;
  citableBreachBaselineINR: number; // Base breach risk in ₹
  hourlyRemediationRateINR: number; // Blended engineer hourly cost
}

export const ORG_PROFILES: Record<OrgRiskProfile, ProfileWeights> = {
  standard: {
    securityWeight: 0.28,
    collapseWeight: 0.20,
    exploitabilityWeight: 0.18,
    propagationWeight: 0.12,
    blastRadiusWeight: 0.08,
    architectureWeight: 0.10,
    authPenaltyPerIssue: 3.0,
    citableBreachBaselineINR: 179000000, // ₹17.9 Cr (IBM Cost of Data Breach India Benchmark)
    hourlyRemediationRateINR: 6500, // ₹6,500/hr blended senior engineering rate
  },
  fintech_banking: {
    securityWeight: 0.32,
    collapseWeight: 0.18,
    exploitabilityWeight: 0.22,
    propagationWeight: 0.10,
    blastRadiusWeight: 0.06,
    architectureWeight: 0.12,
    authPenaltyPerIssue: 6.0, // Strict penalty for auth flaws under RBI/DPDP guidelines
    citableBreachBaselineINR: 250000000, // ₹25 Cr (Fintech high-regulatory exposure)
    hourlyRemediationRateINR: 9500,
  },
  enterprise_saas: {
    securityWeight: 0.25,
    collapseWeight: 0.25, // SLA downtime penalty
    exploitabilityWeight: 0.18,
    propagationWeight: 0.14,
    blastRadiusWeight: 0.10,
    architectureWeight: 0.08,
    authPenaltyPerIssue: 4.0,
    citableBreachBaselineINR: 195000000, // ₹19.5 Cr
    hourlyRemediationRateINR: 8000,
  },
  startup_oss: {
    securityWeight: 0.35,
    collapseWeight: 0.15,
    exploitabilityWeight: 0.20,
    propagationWeight: 0.10,
    blastRadiusWeight: 0.10,
    architectureWeight: 0.10,
    authPenaltyPerIssue: 2.5,
    citableBreachBaselineINR: 45000000, // ₹4.5 Cr
    hourlyRemediationRateINR: 4500,
  },
};

export interface TrustScoreBreakdown {
  trustScore: number;
  components: {
    securityContribution: number;
    collapseInvertedContribution: number;
    exploitabilityInvertedContribution: number;
    propagationInvertedContribution: number;
    blastRadiusInvertedContribution: number;
    architectureInvertedContribution: number;
    authDeductions: number;
  };
  profileUsed: OrgRiskProfile;
  methodologyCitation: string;
}

/**
 * Calculates Trust Score according to the published DebtRadar mathematical methodology.
 */
export function calculateMethodologyTrustScore(
  params: {
    repoSecurityScore: number;
    collapseScore: number;
    exploitabilityScore: number;
    propagationRisk: number;
    blastRadius: number;
    criticalAuthIssues: number;
    architectureRisk: number;
  },
  profile: OrgRiskProfile = 'standard'
): TrustScoreBreakdown {
  const w = ORG_PROFILES[profile] || ORG_PROFILES.standard;

  const securityContrib = params.repoSecurityScore * w.securityWeight;
  const collapseContrib = (100 - params.collapseScore) * w.collapseWeight;
  const exploitabilityContrib = (100 - params.exploitabilityScore) * w.exploitabilityWeight;
  const propagationContrib = (100 - params.propagationRisk) * w.propagationWeight;
  const blastRadiusContrib = (100 - Math.min(100, params.blastRadius * 3)) * w.blastRadiusWeight;
  const architectureContrib = (100 - params.architectureRisk) * w.architectureWeight;
  const authDeductions = params.criticalAuthIssues * w.authPenaltyPerIssue;

  const rawScore =
    securityContrib +
    collapseContrib +
    exploitabilityContrib +
    propagationContrib +
    blastRadiusContrib +
    architectureContrib -
    authDeductions;

  const clamped = Math.max(0, Math.min(100, rawScore));
  const finalScore = Math.round(clamped * 10) / 10;

  return {
    trustScore: finalScore,
    components: {
      securityContribution: Math.round(securityContrib * 10) / 10,
      collapseInvertedContribution: Math.round(collapseContrib * 10) / 10,
      exploitabilityInvertedContribution: Math.round(exploitabilityContrib * 10) / 10,
      propagationInvertedContribution: Math.round(propagationContrib * 10) / 10,
      blastRadiusInvertedContribution: Math.round(blastRadiusContrib * 10) / 10,
      architectureInvertedContribution: Math.round(architectureContrib * 10) / 10,
      authDeductions: Math.round(authDeductions * 10) / 10,
    },
    profileUsed: profile,
    methodologyCitation: 'DebtRadar Mathematical Valuation Framework v2.1 (Anchored in IBM Cost of a Data Breach 2023 & DPDP Act 2023)',
  };
}

/**
 * Returns formal methodology documentation for display in reports, PDF appendices, and UI drawers.
 */
export function getMethodologyAppendixText(profile: OrgRiskProfile = 'standard'): string {
  const w = ORG_PROFILES[profile];
  return `
METHODOLOGY APPENDIX: DEBTRADAR TRUST SCORE & FINANCIAL EXPOSURE
------------------------------------------------------------------
1. MATHEMATICAL FORMULATION
   The Trust Score T in [0, 100] is computed using weighted linear superposition with non-linear authentication penalties:
   
   T = w_sec * S_sec + w_col * (100 - C_col) + w_exp * (100 - E_exp) + w_prop * (100 - P_prop) + w_br * (100 - B_br) + w_arch * (100 - A_arch) - (N_auth * k_auth)

   Active Profile: ${profile.toUpperCase()}
   - Security Weight (w_sec): ${(w.securityWeight * 100).toFixed(0)}%
   - Structural Collapse Inverted (w_col): ${(w.collapseWeight * 100).toFixed(0)}%
   - Exploitability Inverted (w_exp): ${(w.exploitabilityWeight * 100).toFixed(0)}%
   - Cascading Propagation Inverted (w_prop): ${(w.propagationWeight * 100).toFixed(0)}%
   - Blast Radius Inverted (w_br): ${(w.blastRadiusWeight * 100).toFixed(0)}%
   - Architecture Fragility Inverted (w_arch): ${(w.architectureWeight * 100).toFixed(0)}%
   - Critical Auth Penalty (k_auth): -${w.authPenaltyPerIssue} pts / issue

2. FINANCIAL EXPOSURE ANCHORING & CITATIONS
   Financial risk metrics are calibrated against empirical enterprise security benchmarks:
   - IBM Security / Ponemon Institute Cost of a Data Breach Report: India Average Data Breach Cost = ₹17.90 Crore ($2.18M), average per-record compromise liability = ₹4,400.
   - Digital Personal Data Protection (DPDP) Act 2023, Section 33: Maximum statutory penalty of ₹250 Crore for failing to maintain reasonable security safeguards to prevent data breaches.
   - Engineering Remediation Rate: ₹${w.hourlyRemediationRateINR.toLocaleString('en-IN')}/hour blended engineering cost, estimating 16-48 engineering hours per critical architectural or security defect.
`.trim();
}
