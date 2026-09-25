import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, insertAnalysisRecord, updateAnalysisProgress } from '@/lib/supabase/server';
import { parseGitHubUrl } from '@/lib/utils';
import { fetchRepositoryFiles } from '@/lib/github';
import { parseRepository, getCodeSnippet } from '@/lib/ast-parser';
import { computeDuplicationScores } from '@/lib/duplication';
import { computeBlastRadius, buildGraphData } from '@/lib/blast-radius';
import { scoreAllSymbols, averageScore } from '@/lib/debt-scorer';
import { classifyAgentCode } from '@/lib/huggingface';
import { analyzeSecurityRepository, getSecurityNodeMetrics } from '@/lib/security/detector';
import { computeSecurityAwarePriority } from '@/lib/security/security-scorer';
import { isSecuritySensitivePath } from '@/lib/security/security-utils';
import { analyzeExploitabilityRepository } from '@/lib/exploitability/exploitability-engine';
import { buildSecurityAttackGraph } from '@/lib/attack-graph/graph-builder';
import { buildCollapsePrediction } from '@/lib/collapse/collapse-engine';

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  // 1. Startup validation (Requirement 2)
  if (!process.env.GITHUB_TOKEN) {
    console.error("[Startup Validation Failed] GITHUB_TOKEN environment variable is missing.");
    return NextResponse.json(
      { error: "Server Configuration Error: GITHUB_TOKEN environment variable is missing. Unauthenticated requests are disabled." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const repoUrl = body.repoUrl as string;
    if (!repoUrl) {
      return NextResponse.json({ error: 'repoUrl is required' }, { status: 400 });
    }

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json({ error: 'Invalid GitHub URL' }, { status: 400 });
    }

    console.log(`[Pipeline] Checking for active duplicate jobs for: ${parsed.owner}/${parsed.repo}`);
    try {
      const supabase = createServiceClient();

      // 2. Active-job deduplication & database queue locking (Requirement 7)
      const { data: existingActive } = await supabase
        .from('analyses')
        .select('id, status, progress')
        .eq('repo_url', repoUrl)
        .in('status', ['pending', 'fetching', 'parsing', 'scoring', 'graphing'])
        .maybeSingle();

      if (existingActive) {
        console.log(`[Pipeline] Found active duplicate job running for: ${repoUrl} (ID: ${existingActive.id})`);
        return NextResponse.json({
          analysisId: existingActive.id,
          status: existingActive.status,
          message: 'An active analysis is already running for this repository.'
        });
      }
    } catch (error) {
      console.warn('[Pipeline] Duplicate-job check unavailable; continuing with local queueing fallback.', error);
    }
    
    // 3. Enqueue analysis job in Supabase database
    const analysis = await insertAnalysisRecord({
      repo_url: repoUrl,
      repo_owner: parsed.owner,
      repo_name: parsed.repo,
      status: 'pending',
      progress: 0,
      progress_message: 'Enqueued in pipeline. Starting job...',
    });

    const analysisId = analysis.id as string;
    console.log(`[Pipeline] Job enqueued successfully. Job ID: ${analysisId}`);

    // Offload parsing pipeline directly from the request lifecycle (Requirement 12)
    runPipelineWithTimeout(analysisId, parsed.owner, parsed.repo).catch(async (err) => {
      console.error(`[Pipeline Error] Critical worker error in Job ${analysisId}:`, err);
      try {
        const isRateLimit = err instanceof Error && err.message.toLowerCase().includes('rate limit');
        await updateAnalysisProgress(analysisId, {
          status: 'failed',
          progress: 0,
          error_message: err instanceof Error ? err.message : 'Job failed',
          progress_message: isRateLimit ? 'Waiting for GitHub API quota reset...' : 'Analysis job failed',
        });
        console.log(`[Pipeline] Job ${analysisId} finished with status: failed (Rate limit hit: ${isRateLimit})`);
      } catch (subErr) {
        console.error(`[Pipeline Error] Failed to update fail status for ${analysisId}:`, subErr);
      }
    });

    // Return immediate response with job status for client polling (Requirement 12)
    return NextResponse.json({ analysisId, status: 'pending' });
  } catch (err) {
    console.error('[Pipeline] POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

// Global Execution Timeout Protection: Terminates after 280 seconds (Requirement 19 & 14)
async function runPipelineWithTimeout(
  analysisId: string,
  owner: string,
  repo: string
): Promise<void> {
  const MAX_RUNTIME_MS = 280000; // 4.6 minutes

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Final execution timeout: Analysis job exceeded the maximum runtime of 5 minutes.`));
    }, MAX_RUNTIME_MS);
  });

  const pipelinePromise = runPipeline(analysisId, owner, repo);

  return Promise.race([pipelinePromise, timeoutPromise]);
}

async function runPipeline(
  analysisId: string,
  owner: string,
  repo: string
): Promise<void> {
  // 1. Fetch Repository files
  console.log("[Pipeline] Progress: 10");
  await updateAnalysisProgress(analysisId, {
    status: 'fetching',
    progress: 10,
    progress_message: 'fetching repo',
  });

  const files = await fetchRepositoryFiles(owner, repo, async (msg: string) => {
    await updateAnalysisProgress(analysisId, {
      status: 'fetching',
      progress: 15,
      progress_message: msg,
    });
  });

  console.log("[Pipeline] Progress: 25");
  await updateAnalysisProgress(analysisId, {
    status: 'fetching',
    progress: 25,
    progress_message: 'filtering files',
  });

  if (files.length === 0) {
    throw new Error("No valid source files found in repository matching search rules.");
  }

  // 2. Isolated file parsing and AST Extraction (Requirement 10)
  console.log("[Pipeline] Progress: 30");
  await updateAnalysisProgress(analysisId, {
    status: 'parsing',
    progress: 30,
    progress_message: 'parsing AST',
    total_files: files.length,
  });

  let symbols: any[] = [];
  try {
    for (const file of files) {
      console.log("[Parser] Processing:", file.path);
    }

    symbols = parseRepository(files);
    console.log("[Parser] AST success");
  } catch (astError) {
    console.error("[Pipeline Warning] AST parsing failed, building fallbacks:", astError);
    // Build generic fallback list of module symbols so the pipeline never crashes
    symbols = files.map(file => ({
      id: `${file.path}:__module__`,
      filePath: file.path,
      name: '__module__',
      type: 'module' as const,
      lineStart: 1,
      lineEnd: file.content.split('\n').length,
      complexity: 1,
      calls: [],
      calledBy: [],
    }));
  }

  const fileMap = new Map(files.map((f) => [f.path, f.content]));

  // 3. Isolated Duplication & Complexity Scoring (Requirement 10)
  console.log("[Pipeline] Progress: 45");
  await updateAnalysisProgress(analysisId, {
    status: 'parsing',
    progress: 45,
    progress_message: 'scoring',
  });

  let duplicationScores = new Map<string, number>();
  try {
    duplicationScores = computeDuplicationScores(files);
  } catch (dupErr) {
    console.error("[Pipeline Warning] Duplication analysis failed:", dupErr);
  }

  console.log("[Pipeline] Progress: 52");
  await updateAnalysisProgress(analysisId, {
    status: 'scoring',
    progress: 52,
    progress_message: 'security analysis',
  });

  let securityResult = null as Awaited<ReturnType<typeof analyzeSecurityRepository>> | null;
  try {
    securityResult = analyzeSecurityRepository({
      files,
      symbols,
      blastRadiusMap: new Map<string, number>(),
    });
  } catch (securityErr) {
    console.error('[Pipeline Warning] Security detection failed:', securityErr);
  }

  let exploitabilityResult = analyzeExploitabilityRepository({
    files,
    symbols,
    securityResult,
    blastRadiusMap: new Map<string, number>(),
  });

  let blastRadiusMap = new Map<string, number>();
  try {
    blastRadiusMap = computeBlastRadius(symbols);
  } catch (brErr) {
    console.error("[Pipeline Warning] Blast radius traversal failed:", brErr);
  }

  let debtScores = new Map<string, number>();
  try {
    debtScores = scoreAllSymbols(symbols, duplicationScores, blastRadiusMap);
  } catch (scoreErr) {
    console.error("[Pipeline Warning] Debt scoring formulas failed:", scoreErr);
  }

  if (!securityResult) {
    try {
      securityResult = analyzeSecurityRepository({
        files,
        symbols,
        blastRadiusMap,
      });
    } catch (securityErr) {
      console.error('[Pipeline Warning] Security analysis retry failed:', securityErr);
    }
  }

  exploitabilityResult = analyzeExploitabilityRepository({
    files,
    symbols,
    securityResult,
    blastRadiusMap,
  });

  const securityByFile = new Map<string, ReturnType<typeof getSecurityNodeMetrics>>();
  if (securityResult) {
    for (const symbol of symbols) {
      securityByFile.set(symbol.filePath, getSecurityNodeMetrics(securityResult, symbol.filePath));
    }
  }

  const securityPriorityMap = new Map<string, number>();
  for (const symbol of symbols) {
    const metrics = securityByFile.get(symbol.filePath) ?? getSecurityNodeMetrics(securityResult ?? {
      findings: [],
      summary: { totalVulnerabilities: 0, critical: 0, high: 0, medium: 0, low: 0, score: 0, categoryCounts: {}, owaspCategories: [], cweCategories: [], topFindings: [] },
      collapse: { isCollapsed: false, severity: 'moderate', reasons: [], affectedCoreModules: [], propagationRisk: 0 },
      nodeMetrics: {},
      repoSecurityScore: 0,
      criticalVulnerabilities: 0,
    }, symbol.filePath);
    const exploitabilityMetrics = exploitabilityResult.nodeExploitability[symbol.id];
    securityPriorityMap.set(
      symbol.id,
      computeSecurityAwarePriority({
        debtScore: debtScores.get(symbol.id) ?? 0,
        blastRadius: blastRadiusMap.get(symbol.id) ?? 0,
        securityScore: metrics.securityScore,
        exploitabilityScore: exploitabilityMetrics?.exploitabilityScore ?? 0,
        collapseRisk: exploitabilityMetrics?.propagationRisk ?? 0,
        publicExposure: exploitabilityMetrics?.publicExposure ?? false,
      })
    );
  }

  const securitySummary = securityResult?.summary ?? null;
  const repoSecurityScore = securityResult?.repoSecurityScore ?? 0;
  const collapseResult = securityResult?.collapse ?? {
    isCollapsed: false,
    severity: 'moderate' as const,
    reasons: [],
    affectedCoreModules: [],
    propagationRisk: 0,
  };
  const attackGraph = buildSecurityAttackGraph({
    symbols,
    securityResult,
    exploitabilityByNode: exploitabilityResult.nodeExploitability,
    blastRadiusMap,
  });
  const collapsePrediction = buildCollapsePrediction({
    repoSecurityScore,
    criticalVulnerabilities: securityResult?.criticalVulnerabilities ?? 0,
    securityResult,
    exploitabilityResult,
    symbols,
    blastRadiusMap,
  });

  const avgScore = averageScore(debtScores);

  // 4. Isolated dependency graph generation (Requirement 10)
  console.log("[Pipeline] Progress: 60");
  await updateAnalysisProgress(analysisId, {
    status: 'graphing',
    progress: 60,
    progress_message: 'generating graph',
    total_nodes: symbols.length,
    avg_debt_score: avgScore,
    security_summary: securitySummary,
    security_collapse: collapseResult.isCollapsed,
    critical_vulnerabilities: securityResult?.criticalVulnerabilities ?? 0,
    repo_security_score: repoSecurityScore,
    collapse_score: collapsePrediction.collapseScore,
    collapse_prediction: collapsePrediction,
    attack_graph: attackGraph,
    repo_exploitability_score: exploitabilityResult.repoExploitabilityScore,
    high_risk_attack_paths: attackGraph.criticalPaths,
  });

  let topSymbols: any[] = [];
  let links: any[] = [];
  try {
    const graphData = buildGraphData(symbols, debtScores, blastRadiusMap, securityPriorityMap);
    topSymbols = graphData.topSymbols;
    links = graphData.links;
  } catch (graphErr) {
    console.error("[Pipeline Warning] Graph builder crashed, building stub:", graphErr);
    topSymbols = symbols.slice(0, 150);
  }

  // 5. Hugging Face AI classifier
  let fingerprintLabel: string | null = null;
  let fingerprintConfidence: number | null = null;

  const worstSymbol = topSymbols[0];
  if (worstSymbol && process.env.HUGGINGFACE_API_KEY) {
    try {
      const content = fileMap.get(worstSymbol.filePath) ?? '';
      const snippet = getCodeSnippet(content, worstSymbol.lineStart, worstSymbol.lineEnd);
      const fp = await classifyAgentCode(snippet);
      fingerprintLabel = fp.label;
      fingerprintConfidence = fp.confidence;
    } catch (hfErr) {
      console.warn('[Pipeline Warning] Hugging Face optional service failed:', hfErr);
    }
  }

  // 6. DB Batched Nodes Insertion
  console.log("[Pipeline] Progress: 75");
  await updateAnalysisProgress(analysisId, {
    status: 'graphing',
    progress: 75,
    progress_message: 'Building dependency graph and saving nodes...',
    fingerprint_label: fingerprintLabel ?? undefined,
    fingerprint_confidence: fingerprintConfidence ?? undefined,
  });

  const topIds = new Set(topSymbols.map((s) => s.id));

  const nodesToInsert = topSymbols.map((sym) => ({
    analysis_id: analysisId,
    file_path: sym.filePath,
    symbol_name: sym.name,
    node_type: sym.type,
    line_start: sym.lineStart,
    line_end: sym.lineEnd,
    debt_score: debtScores.get(sym.id) ?? 0,
    security_score: securityByFile.get(sym.filePath)?.securityScore ?? 0,
    security_weighted_score: securityByFile.get(sym.filePath)?.securityWeightedScore ?? 0,
    has_critical_security: securityByFile.get(sym.filePath)?.hasCriticalSecurity ?? false,
    vulnerability_count: securityByFile.get(sym.filePath)?.vulnerabilityCount ?? 0,
    security_risk_level: securityByFile.get(sym.filePath)?.securityRiskLevel ?? 'none',
    exploitability_score: exploitabilityResult.nodeExploitability[sym.id]?.exploitabilityScore ?? 0,
    collapse_risk: exploitabilityResult.nodeExploitability[sym.id]?.propagationRisk ?? 0,
    autofix_available: Boolean((securityByFile.get(sym.filePath)?.hasCriticalSecurity ?? false) || (exploitabilityResult.nodeExploitability[sym.id]?.exploitabilityScore ?? 0) >= 60),
    attack_surface_score: exploitabilityResult.nodeExploitability[sym.id]?.attackSurfaceScore ?? 0,
    propagation_risk: exploitabilityResult.nodeExploitability[sym.id]?.propagationRisk ?? 0,
    public_exposure: exploitabilityResult.nodeExploitability[sym.id]?.publicExposure ?? false,
    critical_attack_paths: attackGraph.paths.filter((path) => path.sourceNode === sym.id || path.targetNode === sym.id).slice(0, 8),
    fix_patch: null,
    fix_confidence: 0,
    merge_risk: null,
    complexity: sym.complexity,
    duplication_score: duplicationScores.get(sym.filePath) ?? 0,
    blast_radius: blastRadiusMap.get(sym.id) ?? 0,
    owasp_categories: securityByFile.get(sym.filePath)?.owaspCategories ?? [],
    cwe_categories: securityByFile.get(sym.filePath)?.cweCategories ?? [],
    security_findings: securityByFile.get(sym.filePath)?.securityFindings ?? [],
    dependencies: sym.calls.filter((c: string) => topIds.has(c)),
    dependents: sym.calledBy.filter((c: string) => topIds.has(c)),
    explanation: null,
    fingerprint_tag: sym.id === worstSymbol?.id ? fingerprintLabel : null,
    x: null,
    y: null,
  }));

  const supabase = createServiceClient();
  const batchSize = 100;
  for (let i = 0; i < nodesToInsert.length; i += batchSize) {
    const batch = nodesToInsert.slice(i, i + batchSize);
    const { error } = await supabase.from('debt_nodes').insert(batch);
    if (!error) continue;

    const errorMessage = error.message ?? '';
    const isSchemaCacheError = /schema cache|Could not find the '.+' column/i.test(errorMessage);
    if (!isSchemaCacheError) {
      console.error(`[Pipeline Error] Nodes insertion batch failed:`, error);
      throw new Error(`Failed to save nodes in database: ${errorMessage}`);
    }

    console.warn('[Pipeline Warning] Retrying node insert without security columns because Supabase schema cache is stale:', errorMessage);
    const fallbackBatch = batch.map(({ security_score, security_weighted_score, has_critical_security, vulnerability_count, security_risk_level, owasp_categories, cwe_categories, security_findings, exploitability_score, collapse_risk, autofix_available, attack_surface_score, propagation_risk, public_exposure, critical_attack_paths, fix_patch, fix_confidence, merge_risk, ...rest }) => rest);
    const fallbackInsert = await supabase.from('debt_nodes').insert(fallbackBatch);
    if (fallbackInsert.error) {
      console.error('[Pipeline Error] Fallback insert also failed:', fallbackInsert.error);
      throw new Error(`Failed to save nodes in database: ${fallbackInsert.error.message}`);
    }
  }

  // 7. Complete successfully
  console.log("[Pipeline] Progress: 100");
  await updateAnalysisProgress(analysisId, {
    status: 'complete',
    progress: 100,
    progress_message: 'completed',
    total_nodes: topSymbols.length,
    avg_debt_score: avgScore,
    fingerprint_label: fingerprintLabel ?? undefined,
    fingerprint_confidence: fingerprintConfidence ?? undefined,
    security_summary: securitySummary,
    security_collapse: collapseResult.isCollapsed,
    critical_vulnerabilities: securityResult?.criticalVulnerabilities ?? 0,
    repo_security_score: repoSecurityScore,
    collapse_score: collapsePrediction.collapseScore,
    collapse_prediction: collapsePrediction,
    attack_graph: attackGraph,
    repo_exploitability_score: exploitabilityResult.repoExploitabilityScore,
    high_risk_attack_paths: attackGraph.criticalPaths,
  });
  
  console.log(`[Pipeline] Job ${analysisId} completed successfully.`);
}
