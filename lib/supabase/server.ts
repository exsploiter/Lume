import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { AnalysisRecord, DebtNode } from '@/types';
import {
  createLocalAnalysisId,
  loadLocalAnalysisRecord,
  loadLocalDebtNodes,
  saveLocalAnalysisRecord,
  saveLocalDebtNodes,
  updateLocalAnalysisRecord,
  updateLocalNodeExplanation,
} from '@/lib/supabase/local-store';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function isSupabaseUnavailableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch failed|getaddrinfo|ENOTFOUND|ETIMEDOUT|Connect Timeout|network error/i.test(message);
}

export function createServiceClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function insertAnalysisRecord(
  record: Partial<AnalysisRecord> & { repo_url: string; repo_owner: string; repo_name: string; status: AnalysisRecord['status']; progress: number; id?: string }
) {
  const supabase = createServiceClient();

  try {
    const { data, error } = await supabase
      .from('analyses')
      .insert(record)
      .select()
      .single();

    if (!error && data) {
      return data as AnalysisRecord;
    }

    if (error && !isSupabaseUnavailableError(error)) {
      console.warn('[Supabase] Falling back to local analysis store after insert error:', error.message);
    }
  } catch (error) {
    if (!isSupabaseUnavailableError(error)) {
      console.warn('[Supabase] Falling back to local analysis store after insert exception:', error);
    }
  }

  const localRecord = {
    ...record,
    id: record.id ?? createLocalAnalysisId(),
  } as AnalysisRecord;

  return saveLocalAnalysisRecord(localRecord);
}

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          /* Server Component context */
        }
      },
    },
  });
}

export async function updateAnalysisProgress(
  analysisId: string,
  updates: Partial<{
    status: AnalysisRecord['status'];
    progress: number;
    progress_message: string;
    error_message: string;
    total_files: number;
    total_nodes: number;
    avg_debt_score: number;
    fingerprint_label: string;
    fingerprint_confidence: number;
    security_summary: AnalysisRecord['security_summary'];
    security_collapse: boolean;
    critical_vulnerabilities: number;
    repo_security_score: number;
    collapse_score: number;
    collapse_prediction: AnalysisRecord['collapse_prediction'];
    attack_graph: AnalysisRecord['attack_graph'];
    repo_exploitability_score: number;
    high_risk_attack_paths: AnalysisRecord['high_risk_attack_paths'];
  }>
) {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('analyses')
      .update(updates)
      .eq('id', analysisId);
    if (error) {
      const errorMessage = error.message ?? '';
      const isSchemaCacheError = /schema cache|Could not find the '.+' column/i.test(errorMessage);
      if (!isSchemaCacheError) {
        console.error(`[Supabase Error] Failed to update progress for ${analysisId}: ${errorMessage}`);
      } else {
        const fallbackUpdates = {
          ...updates,
        } as Record<string, unknown>;
        delete fallbackUpdates.security_summary;
        delete fallbackUpdates.security_collapse;
        delete fallbackUpdates.critical_vulnerabilities;
        delete fallbackUpdates.repo_security_score;
        delete fallbackUpdates.collapse_score;
        delete fallbackUpdates.collapse_prediction;
        delete fallbackUpdates.attack_graph;
        delete fallbackUpdates.repo_exploitability_score;
        delete fallbackUpdates.high_risk_attack_paths;

        const fallback = await supabase
          .from('analyses')
          .update(fallbackUpdates)
          .eq('id', analysisId);

        if (fallback.error) {
          console.error(`[Supabase Error] Failed to update progress for ${analysisId}: ${fallback.error.message}`);
        } else {
          return;
        }
      }

      await updateLocalAnalysisRecord(analysisId, updates as Partial<AnalysisRecord>);
      return;
    }
  } catch (err) {
    if (isSupabaseUnavailableError(err)) {
      await updateLocalAnalysisRecord(analysisId, updates as Partial<AnalysisRecord>);
      return;
    }

    console.error(`[Supabase Error] Exception thrown during update progress for ${analysisId}:`, err);
    await updateLocalAnalysisRecord(analysisId, updates as Partial<AnalysisRecord>);
  }
}

export async function getAnalysis(id: string): Promise<AnalysisRecord | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', id)
      .single();
    if (!error && data) return data as AnalysisRecord;
  } catch (error) {
    if (!isSupabaseUnavailableError(error)) {
      console.warn(`[Supabase] Falling back to local analysis read for ${id}:`, error);
    }
  }

  return loadLocalAnalysisRecord(id);
}

export async function getDebtNodes(analysisId: string): Promise<DebtNode[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('debt_nodes')
      .select('*')
      .eq('analysis_id', analysisId)
      .order('debt_score', { ascending: false });
    if (!error) return (data ?? []) as DebtNode[];
  } catch (error) {
    if (!isSupabaseUnavailableError(error)) {
      console.warn(`[Supabase] Falling back to local node read for ${analysisId}:`, error);
    }
  }

  return loadLocalDebtNodes(analysisId);
}

export async function insertDebtNodes(
  nodes: Omit<DebtNode, 'id'>[]
): Promise<void> {
  const supabase = createServiceClient();
  const batchSize = 100;
  const localNodes = nodes.map((node) => ({ ...node, id: createLocalAnalysisId() } as DebtNode));

  let hasSavedLocally = false;
  for (let i = 0; i < nodes.length; i += batchSize) {
    const batch = nodes.slice(i, i + batchSize);
    try {
      const { error } = await supabase.from('debt_nodes').insert(batch);
      if (!error) continue;

      const errorMessage = error.message ?? '';
      const isSchemaCacheError = /schema cache|Could not find the '.+' column/i.test(errorMessage);
      if (!isSchemaCacheError) {
        throw new Error(`Failed to insert nodes: ${errorMessage}`);
      }

      const fallbackBatch = batch.map(({ security_score, security_weighted_score, has_critical_security, vulnerability_count, security_risk_level, owasp_categories, cwe_categories, security_findings, exploitability_score, collapse_risk, autofix_available, attack_surface_score, propagation_risk, public_exposure, critical_attack_paths, fix_patch, fix_confidence, merge_risk, ...rest }) => rest as Omit<DebtNode, 'id' | 'security_score' | 'security_weighted_score' | 'has_critical_security' | 'vulnerability_count' | 'security_risk_level' | 'owasp_categories' | 'cwe_categories' | 'security_findings' | 'exploitability_score' | 'collapse_risk' | 'autofix_available' | 'attack_surface_score' | 'propagation_risk' | 'public_exposure' | 'critical_attack_paths' | 'fix_patch' | 'fix_confidence' | 'merge_risk'>);
      const fallbackInsert = await supabase.from('debt_nodes').insert(fallbackBatch);
      if (fallbackInsert.error) {
        throw new Error(`Failed to insert nodes: ${fallbackInsert.error.message}`);
      }
    } catch (error) {
      if (!isSupabaseUnavailableError(error)) {
        throw error instanceof Error ? error : new Error('Failed to insert nodes');
      }

      hasSavedLocally = true;
      const analysisId = batch[0]?.analysis_id;
      if (analysisId) {
        const existingNodes = await loadLocalDebtNodes(analysisId);
        await saveLocalDebtNodes(analysisId, [...existingNodes, ...localNodes.slice(i, i + batchSize)]);
      }
    }
  }

  if (!hasSavedLocally && nodes.length > 0) {
    const analysisId = nodes[0].analysis_id;
    await saveLocalDebtNodes(analysisId, localNodes);
  }
}

export async function updateNodeExplanation(
  nodeId: string,
  explanation: string
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('debt_nodes')
      .update({ explanation })
      .eq('id', nodeId);
    if (!error) return;
    if (!isSupabaseUnavailableError(error)) {
      throw new Error(`Failed to update explanation: ${error.message}`);
    }
  } catch (error) {
    if (!isSupabaseUnavailableError(error)) {
      throw error instanceof Error ? error : new Error('Failed to update explanation');
    }
  }

  await updateLocalNodeExplanation(nodeId, explanation);
}
