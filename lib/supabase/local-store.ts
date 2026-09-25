import { mkdir, readFile, readdir, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { AnalysisRecord, DebtNode } from '@/types';

type LocalAnalysisBundle = {
  analysis: Partial<AnalysisRecord> & { id: string };
  nodes: DebtNode[];
};

const LOCAL_DATA_DIR = path.join(process.cwd(), '.lume-data');
const ANALYSES_DIR = path.join(LOCAL_DATA_DIR, 'analyses');

async function ensureStore() {
  await mkdir(ANALYSES_DIR, { recursive: true });
}

function getAnalysisPath(id: string) {
  return path.join(ANALYSES_DIR, `${id}.json`);
}

async function readBundleByPath(filePath: string): Promise<LocalAnalysisBundle | null> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as LocalAnalysisBundle;
  } catch {
    return null;
  }
}

async function readBundle(id: string): Promise<LocalAnalysisBundle | null> {
  return readBundleByPath(getAnalysisPath(id));
}

async function writeBundle(id: string, bundle: LocalAnalysisBundle) {
  await ensureStore();
  await writeFile(getAnalysisPath(id), JSON.stringify(bundle, null, 2), 'utf8');
}

async function updateBundle(
  id: string,
  updater: (bundle: LocalAnalysisBundle) => LocalAnalysisBundle
) {
  const bundle = (await readBundle(id)) ?? {
    analysis: { id },
    nodes: [],
  };
  const nextBundle = updater(bundle);
  await writeBundle(id, nextBundle);
  return nextBundle;
}

export async function saveLocalAnalysisRecord(analysis: Partial<AnalysisRecord> & { id: string }) {
  const bundle = await updateBundle(analysis.id, (current) => ({
    analysis: { ...current.analysis, ...analysis },
    nodes: current.nodes,
  }));

  return bundle.analysis as AnalysisRecord;
}

export async function loadLocalAnalysisRecord(id: string) {
  const bundle = await readBundle(id);
  return (bundle?.analysis as AnalysisRecord | undefined) ?? null;
}

export async function saveLocalDebtNodes(analysisId: string, nodes: DebtNode[]) {
  await updateBundle(analysisId, (current) => ({
    analysis: current.analysis,
    nodes,
  }));
}

export async function loadLocalDebtNodes(analysisId: string) {
  const bundle = await readBundle(analysisId);
  return (bundle?.nodes ?? []) as DebtNode[];
}

export async function updateLocalAnalysisRecord(
  analysisId: string,
  updates: Partial<AnalysisRecord>
) {
  const bundle = await updateBundle(analysisId, (current) => ({
    analysis: { ...current.analysis, ...updates, id: analysisId },
    nodes: current.nodes,
  }));

  return bundle.analysis as AnalysisRecord;
}

export async function updateLocalNodeExplanation(nodeId: string, explanation: string) {
  await ensureStore();
  const files = await readdir(ANALYSES_DIR, { withFileTypes: true });

  for (const entry of files) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(ANALYSES_DIR, entry.name);
    const bundle = await readBundleByPath(filePath);
    if (!bundle) continue;

    const node = bundle.nodes.find((item) => item.id === nodeId);
    if (!node) continue;

    node.explanation = explanation;
    await writeFile(filePath, JSON.stringify(bundle, null, 2), 'utf8');
    return;
  }
}

export function createLocalAnalysisId() {
  return randomUUID();
}