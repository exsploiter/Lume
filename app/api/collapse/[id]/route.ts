import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getAnalysis, getDebtNodes } from '@/lib/supabase/server';
import { buildCollapsePrediction } from '@/lib/collapse/collapse-engine';
import { analyzeExploitabilityRepository } from '@/lib/exploitability/exploitability-engine';
import { analyzeSecurityRepository } from '@/lib/security/detector';
import { computeBlastRadius } from '@/lib/blast-radius';

export const runtime = 'nodejs';

export async function GET(_: NextRequest, context: { params: { id: string } }) {
  try {
    const { id } = context.params;
    const analysis = await getAnalysis(id);
    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    if (analysis.collapse_prediction) {
      return NextResponse.json({ prediction: analysis.collapse_prediction });
    }

    const nodes = await getDebtNodes(id);
    const supabase = createServiceClient();
    const { data: files } = await supabase
      .from('analyses')
      .select('repo_owner, repo_name')
      .eq('id', id)
      .single();

    const repoFiles = [] as Array<{ path: string; content: string }>;
    const symbols = nodes.map((node) => ({
      id: node.id,
      filePath: node.file_path,
      name: node.symbol_name,
      type: node.node_type,
      lineStart: node.line_start,
      lineEnd: node.line_end,
      complexity: node.complexity,
      calls: node.dependencies,
      calledBy: node.dependents,
    }));

    const blastRadiusMap = computeBlastRadius(symbols);
    const securityResult = analyzeSecurityRepository({ files: repoFiles, symbols, blastRadiusMap });
    const exploitabilityResult = analyzeExploitabilityRepository({ files: repoFiles, symbols, securityResult, blastRadiusMap });
    const prediction = buildCollapsePrediction({
      repoSecurityScore: analysis.repo_security_score,
      criticalVulnerabilities: analysis.critical_vulnerabilities,
      securityResult,
      exploitabilityResult,
      symbols,
      blastRadiusMap,
    });

    await supabase
      .from('analyses')
      .update({ collapse_score: prediction.collapseScore, collapse_prediction: prediction })
      .eq('id', id);

    return NextResponse.json({ prediction });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load collapse prediction' }, { status: 500 });
  }
}
