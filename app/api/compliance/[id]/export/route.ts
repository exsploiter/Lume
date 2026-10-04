import { NextRequest, NextResponse } from 'next/server';
import { getAnalysis, getDebtNodes } from '@/lib/supabase/server';
import { evaluateComprehensiveCompliance } from '@/lib/business-intelligence/compliance-matrix';
import {
  generateComplianceJson,
  generateComplianceMarkdown,
  generateComplianceCsv,
} from '@/lib/business-intelligence/compliance-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const analysisId = params.id;
    const format = request.nextUrl.searchParams.get('format') || 'json';
    const analysis = await getAnalysis(analysisId);

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    const nodes = await getDebtNodes(analysisId);
    const audit = evaluateComprehensiveCompliance({ analysis, nodes });

    const safeRepoName = `${analysis.repo_owner || 'repo'}-${analysis.repo_name || 'audit'}`.replace(/[^a-zA-Z0-9-_]/g, '_');

    if (format === 'markdown' || format === 'md') {
      const markdown = generateComplianceMarkdown(audit);
      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="debtradar-compliance-audit-${safeRepoName}.md"`,
        },
      });
    }

    if (format === 'csv') {
      const csv = generateComplianceCsv(audit);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="debtradar-compliance-matrix-${safeRepoName}.csv"`,
        },
      });
    }

    // Default: JSON
    const json = generateComplianceJson(audit);
    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="debtradar-compliance-evidence-${safeRepoName}.json"`,
      },
    });
  } catch (err) {
    console.error('[API /api/compliance/[id]/export] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to export compliance audit' },
      { status: 500 }
    );
  }
}
