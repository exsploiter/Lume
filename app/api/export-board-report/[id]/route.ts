import { NextRequest, NextResponse } from 'next/server';
import { getAnalysis, getDebtNodes } from '@/lib/supabase/server';
import { calculateTrustScore } from '@/lib/business-intelligence/trust-score';
import { calculateDeploymentConfidence } from '@/lib/business-intelligence/deployment-confidence';
import { buildExecutiveSummary } from '@/lib/business-intelligence/executive-summary';
import { buildExecutiveReport } from '@/lib/business-intelligence/executive-report';
import { generateBoardReportPdf } from '@/lib/business-intelligence/report-pdf';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function buildMailTransport() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!user || !pass) {
    throw new Error('Email credentials are not configured.');
  }

  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT || 587);
  const secure = String(process.env.EMAIL_SECURE ?? '').toLowerCase() === 'true' || port === 465;

  if (host) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const analysis = await getAnalysis(params.id);
    if (!analysis) return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });

    const nodes = await getDebtNodes(params.id);

    // compute trust & deployment like analysis route
    const repoSecurityScore = analysis.repo_security_score ?? 0;
    const collapseScore = analysis.collapse_score ?? 0;
    const repoExploitabilityScore = analysis.repo_exploitability_score ?? 0;

    const trustScore = calculateTrustScore({
      repoSecurityScore,
      collapseScore,
      exploitabilityScore: repoExploitabilityScore,
      propagationRisk: analysis.collapse_prediction?.collapseProbability ?? collapseScore,
      blastRadius: nodes.length > 0 ? Math.round(nodes.reduce((total, node) => total + node.blast_radius, 0) / nodes.length) : 0,
      criticalAuthIssues: nodes.filter(n => (n.security_findings ?? []).some(f => /auth|jwt|session|login|authorization/i.test(f.title))).length,
      architectureRisk: collapseScore,
    });

    const deploymentConfidence = calculateDeploymentConfidence({
      repoSecurityScore,
      trustScore: trustScore.trustScore,
      collapseScore,
      exploitabilityScore: repoExploitabilityScore,
      propagationRisk: analysis.collapse_prediction?.collapseProbability ?? collapseScore,
      criticalAuthIssues: nodes.filter(n => (n.security_findings ?? []).some(f => /auth|jwt|session|login|authorization/i.test(f.title))).length,
    });

    const executiveSummary = buildExecutiveSummary({
      repoName: `${analysis.repo_owner}/${analysis.repo_name}`,
      trustScore,
      deploymentConfidence,
      translations: nodes.slice(0, 8).map((node) => ({
        executiveSummary: node.explanation ?? '',
        businessImpact: node.businessImpact ?? '',
        customerImpact: node.customerImpact ?? '',
        operationalRisk: node.deploymentUrgency ?? '',
        financialRisk: '',
        urgency: node.deploymentUrgency ?? '',
        recommendedAction: node.explanation ?? '',
        impactTypes: [],
      })),
      consequences: [],
    });

    // enrich analysis minimally
    const enriched = {
      ...analysis,
      executiveSummary,
      trustScore: trustScore.trustScore,
      deploymentConfidence: deploymentConfidence.deploymentConfidence,
      deploymentRecommendation: deploymentConfidence.deploymentRecommendation,
    };

    const report = buildExecutiveReport({ analysis: enriched as any, nodes, trustScore: trustScore.trustScore, deploymentConfidence: deploymentConfidence.deploymentConfidence });

    const url = new URL(request.url);
    if (url.searchParams.get('format') === 'json') {
      return NextResponse.json(report);
    }

    const pdfBytes = await generateBoardReportPdf(report, `${analysis.repo_owner}/${analysis.repo_name}`);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${analysis.repo_name}-DebtRadar-Board-Report.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => null);
    const recipientEmail = String(body?.email ?? '').trim();

    if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return NextResponse.json({ error: 'A valid recipient email is required.' }, { status: 400 });
    }

    const analysis = await getAnalysis(params.id);
    if (!analysis) return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });

    const nodes = await getDebtNodes(params.id);

    const repoSecurityScore = analysis.repo_security_score ?? 0;
    const collapseScore = analysis.collapse_score ?? 0;
    const repoExploitabilityScore = analysis.repo_exploitability_score ?? 0;

    const criticalAuthIssues = nodes.filter((node) => (node.security_findings ?? []).some((finding) => /auth|jwt|session|login|authorization/i.test(finding.title))).length;

    const trustScore = calculateTrustScore({
      repoSecurityScore,
      collapseScore,
      exploitabilityScore: repoExploitabilityScore,
      propagationRisk: analysis.collapse_prediction?.collapseProbability ?? collapseScore,
      blastRadius: nodes.length > 0 ? Math.round(nodes.reduce((total, node) => total + node.blast_radius, 0) / nodes.length) : 0,
      criticalAuthIssues,
      architectureRisk: collapseScore,
    });

    const deploymentConfidence = calculateDeploymentConfidence({
      repoSecurityScore,
      trustScore: trustScore.trustScore,
      collapseScore,
      exploitabilityScore: repoExploitabilityScore,
      propagationRisk: analysis.collapse_prediction?.collapseProbability ?? collapseScore,
      criticalAuthIssues,
    });

    const executiveSummary = buildExecutiveSummary({
      repoName: `${analysis.repo_owner}/${analysis.repo_name}`,
      trustScore,
      deploymentConfidence,
      translations: nodes.slice(0, 8).map((node) => ({
        executiveSummary: node.explanation ?? '',
        businessImpact: node.businessImpact ?? '',
        customerImpact: node.customerImpact ?? '',
        operationalRisk: node.deploymentUrgency ?? '',
        financialRisk: '',
        urgency: node.deploymentUrgency ?? '',
        recommendedAction: node.explanation ?? '',
        impactTypes: [],
      })),
      consequences: [],
    });

    const report = buildExecutiveReport({
      analysis: {
        ...analysis,
        executiveSummary,
        trustScore: trustScore.trustScore,
        deploymentConfidence: deploymentConfidence.deploymentConfidence,
        deploymentRecommendation: deploymentConfidence.deploymentRecommendation,
      } as any,
      nodes,
      trustScore: trustScore.trustScore,
      deploymentConfidence: deploymentConfidence.deploymentConfidence,
    });

    const pdfBytes = await generateBoardReportPdf(report, `${analysis.repo_owner}/${analysis.repo_name}`);
    const transport = buildMailTransport();

    await transport.sendMail({
      from: process.env.EMAIL_USER,
      to: recipientEmail,
      subject: `DebtRadar Board Report - ${analysis.repo_owner}/${analysis.repo_name}`,
      text: `Attached is the board-ready DebtRadar executive software trust report for ${analysis.repo_owner}/${analysis.repo_name}.`,
      attachments: [
        {
          filename: `${analysis.repo_name}-DebtRadar-Board-Report.pdf`,
          content: Buffer.from(pdfBytes),
          contentType: 'application/pdf',
        },
      ],
    });

    return NextResponse.json({ success: true, recipientEmail });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}
