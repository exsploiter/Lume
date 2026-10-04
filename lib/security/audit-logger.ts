import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

export type AuditEventType =
  | 'SCAN_INITIATED'
  | 'SCAN_COMPLETED'
  | 'SCAN_FAILED'
  | 'EXPLANATION_REQUEST'
  | 'AUTOFIX_REQUEST'
  | 'PR_CREATION'
  | 'TOKEN_VALIDATION'
  | 'SECURITY_ALERT'
  | 'WEBHOOK_RECEIVED'
  | 'CI_GATE_EVALUATED';

export type AuditSeverity = 'info' | 'warn' | 'error' | 'critical';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  actor?: string;
  repo?: string;
  status: 'success' | 'failure' | 'in_progress';
  details?: Record<string, unknown>;
  error?: string;
}

const AUDIT_FILE = path.join(process.cwd(), 'data', 'audit_logs.json');
const MAX_LOCAL_ENTRIES = 2000;
let inMemoryLogs: AuditLogEntry[] = [];
let loaded = false;

function ensureDirExists(dirPath: string) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch {
    // ignore
  }
}

function loadLogs() {
  if (loaded) return;
  loaded = true;
  try {
    if (fs.existsSync(AUDIT_FILE)) {
      const raw = fs.readFileSync(AUDIT_FILE, 'utf-8');
      inMemoryLogs = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[Audit Logger] Could not read audit logs from disk:', err);
  }
}

function persistLogs() {
  try {
    ensureDirExists(path.dirname(AUDIT_FILE));
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(inMemoryLogs, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Audit Logger] Could not write audit logs to disk:', err);
  }
}

export async function logAuditEvent(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry> {
  loadLogs();

  const fullEntry: AuditLogEntry = {
    ...entry,
    id: `audit_${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
  };

  inMemoryLogs.unshift(fullEntry);
  if (inMemoryLogs.length > MAX_LOCAL_ENTRIES) {
    inMemoryLogs = inMemoryLogs.slice(0, MAX_LOCAL_ENTRIES);
  }

  // Persist to local disk
  setTimeout(() => persistLogs(), 50);

  // Attempt Supabase insert in background
  try {
    const supabase = createServiceClient();
    Promise.resolve(
      supabase.from('audit_logs').insert({
        id: fullEntry.id,
        timestamp: fullEntry.timestamp,
        event_type: fullEntry.eventType,
        severity: fullEntry.severity,
        actor: fullEntry.actor,
        repo: fullEntry.repo,
        status: fullEntry.status,
        details: fullEntry.details,
        error: fullEntry.error,
      })
    )
      .then(({ error }) => {
        if (error) {
          // Table may not exist yet, local file fallback has it safely captured
        }
      })
      .catch(() => {});
  } catch {
    // ignore
  }

  console.log(`[Audit] [${fullEntry.severity.toUpperCase()}] ${fullEntry.eventType} - ${fullEntry.repo || 'system'} - Status: ${fullEntry.status}`);
  return fullEntry;
}

export function queryAuditLogs(filters?: {
  eventType?: AuditEventType;
  repo?: string;
  severity?: AuditSeverity;
  limit?: number;
}): AuditLogEntry[] {
  loadLogs();
  let results = inMemoryLogs;

  if (filters?.eventType) {
    results = results.filter((l) => l.eventType === filters.eventType);
  }
  if (filters?.repo) {
    results = results.filter((l) => l.repo?.toLowerCase().includes(filters.repo!.toLowerCase()));
  }
  if (filters?.severity) {
    results = results.filter((l) => l.severity === filters.severity);
  }

  return results.slice(0, filters?.limit ?? 100);
}
