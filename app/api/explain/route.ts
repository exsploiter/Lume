import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, updateNodeExplanation } from '@/lib/supabase/server';
import { generateDebtExplanation } from '@/lib/huggingface';
import { fetchRepositoryFiles, fetchRawGithubFile, getDefaultBranch } from '@/lib/github';
import { getCodeSnippet } from '@/lib/ast-parser';

// Ensure the route uses standard Node.js runtime (Requirement 12)
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
      console.log("[Explain] Request body:", body);
    } catch (parseErr) {
      console.error("[Explain Error] Request body parsing failed:", parseErr);
      return NextResponse.json({ error: "Malformed request payload" }, { status: 400 });
    }

    const { nodeId, analysisId, node: reqNode, codeSnippet: reqCodeSnippet, filePath, debtScore } = body;

    // Validate frontend payload (Requirement 9)
    if (!nodeId || !analysisId || !reqNode || !filePath || debtScore === undefined) {
      console.error("[Explain Error] Invalid frontend payload:", body);
      return NextResponse.json(
        { error: 'Missing required payload: node, nodeId, analysisId, filePath, and debtScore are required' },
        { status: 400 }
      );
    }

    let node = reqNode;

    // Ensure node exists before generating prompt (Requirement 10)
    if (!node) {
      console.error("[Explain Error] Node is undefined or null");
      return NextResponse.json({ error: 'Node is required' }, { status: 400 });
    }

    console.log("[Explain] Selected node:", node);

    let codeSnippet = reqCodeSnippet || `// ${node.symbol_name} in ${node.file_path}\n// Lines ${node.line_start}-${node.line_end}`;
    
    // Fetch code snippet in try/catch isolated block using fast direct file fetch to avoid rate limits
    if (!reqCodeSnippet || reqCodeSnippet.startsWith('//')) {
      try {
        const supabase = createServiceClient();
        const { data: analysis } = await supabase
          .from('analyses')
          .select('repo_owner, repo_name')
          .eq('id', analysisId)
          .single();

        if (analysis) {
          // Try 'main' branch first
          let fileContent = await fetchRawGithubFile(
            analysis.repo_owner,
            analysis.repo_name,
            node.file_path,
            'main'
          );
          // If 'main' fails, try 'master' branch
          if (!fileContent) {
            fileContent = await fetchRawGithubFile(
              analysis.repo_owner,
              analysis.repo_name,
              node.file_path,
              'master'
            );
          }

          if (fileContent) {
            codeSnippet = getCodeSnippet(fileContent, node.line_start, node.line_end);
          }
        }
      } catch (fetchErr) {
        console.warn("[Explain Warning] Failed to fetch raw repository file for snippet context, using fallback:", fetchErr);
      }
    }

    // Call explanation generator
    const explanation = await generateDebtExplanation({
      filePath: node.file_path || filePath,
      symbolName: node.symbol_name,
      debtScore: node.debt_score !== undefined ? node.debt_score : debtScore,
      complexity: node.complexity || 0,
      blastRadius: node.blast_radius || 0,
      codeSnippet,
      securityScore: node.security_score ?? 0,
      vulnerabilityCount: node.vulnerability_count ?? 0,
      securityRiskLevel: node.security_risk_level ?? 'none',
      owaspCategories: node.owasp_categories ?? [],
      cweCategories: node.cwe_categories ?? [],
      securityFindings: node.security_findings ?? [],
    });

    // Save back to DB
    try {
      await updateNodeExplanation(nodeId, explanation);
    } catch (saveErr) {
      console.error("[Explain Warning] Failed saving AI explanation to database:", saveErr);
    }

    return NextResponse.json({ explanation });
  } catch (err) {
    console.error("[AI Explain Error]", err);
    return NextResponse.json(
      { error: String(err) }, // Requirement 1: Return exact error string
      { status: 500 }
    );
  }
}
