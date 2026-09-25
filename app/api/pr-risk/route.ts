import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getAnalysis, getDebtNodes } from '@/lib/supabase/server';
import { analyzePullRequestRisk } from '@/lib/pr-risk/risk-analyzer';
import type { SecurityFinding } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const analysisId = body.analysisId as string | undefined;
    const repoUrl = body.repoUrl as string | undefined;
    const diff = body.diff as string | undefined;

    if (!diff) {
      return NextResponse.json({ error: 'diff is required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    let analysis = analysisId ? await getAnalysis(analysisId) : null;
    if (!analysis && repoUrl) {
      const { data } = await supabase
        .from('analyses')
        .select('*')
        .eq('repo_url', repoUrl)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      analysis = data ?? null;
    }

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    const nodes = await getDebtNodes(analysis.id);
    const securityFindings = nodes.flatMap((node) => node.security_findings ?? []) as SecurityFinding[];
    const criticalFiles = [...new Set(nodes.filter((node) => node.has_critical_security || node.public_exposure).map((node) => node.file_path))];

    const result = analyzePullRequestRisk({
      diff,
      securityFindings,
      criticalFiles,
    });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'PR risk analysis failed' }, { status: 500 });
  }
}
