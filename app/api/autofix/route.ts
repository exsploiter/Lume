import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getAnalysis, getDebtNodes } from '@/lib/supabase/server';
import { fetchRawGithubFile, getDefaultBranch } from '@/lib/github';
import { getCodeSnippet } from '@/lib/ast-parser';
import { createSecurityAutofix } from '@/lib/ai-fixes/fix-generator';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const analysisId = body.analysisId as string | undefined;
    const nodeId = body.nodeId as string | undefined;

    if (!analysisId || !nodeId) {
      return NextResponse.json({ error: 'analysisId and nodeId are required' }, { status: 400 });
    }

    const analysis = await getAnalysis(analysisId);
    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    const nodes = await getDebtNodes(analysisId);
    const node = nodes.find((item) => item.id === nodeId);
    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    const securityFinding: import('@/types').SecurityFinding = node.security_findings?.[0] ?? {
      id: `synthetic-${nodeId}`,
      ruleId: 'debt-autofix',
      title: `Potential issue in ${node.symbol_name}`,
      description: `Automated analysis detected potential issues in ${node.symbol_name} (debt score: ${node.debt_score}, blast radius: ${node.blast_radius}).`,
      severity: node.has_critical_security ? 'critical' : node.debt_score >= 50 ? 'high' : 'medium',
      filePath: node.file_path,
      lineStart: node.line_start ?? 1,
      lineEnd: node.line_end ?? 100,
      evidence: `Debt score ${node.debt_score}, blast radius ${node.blast_radius}`,
      recommendation: `Review and harden ${node.symbol_name} to reduce technical debt and improve reliability.`,
      occurrenceCount: 1,
      exploitability: node.exploitability_score ?? 0,
      owaspIds: node.owasp_categories ?? [],
      cweIds: node.cwe_categories ?? [],
      category: 'code-quality',
    };

    let codeSnippet = body.codeSnippet as string | undefined;
    if (!codeSnippet) {
      const branch = await getDefaultBranch(analysis.repo_owner, analysis.repo_name);
      const content = await fetchRawGithubFile(analysis.repo_owner, analysis.repo_name, node.file_path, branch ?? 'main');
      if (content) {
        codeSnippet = getCodeSnippet(content, node.line_start, node.line_end);
      }
    }

    const autofix = await createSecurityAutofix({
      filePath: node.file_path,
      symbolName: node.symbol_name,
      codeSnippet: codeSnippet ?? '',
      finding: securityFinding,
    });

    const supabase = createServiceClient();
    await supabase
      .from('debt_nodes')
      .update({
        autofix_available: true,
        fix_patch: autofix.patch,
        fix_confidence: autofix.confidence,
      })
      .eq('id', nodeId);

    return NextResponse.json({ autofix });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Autofix failed' }, { status: 500 });
  }
}
