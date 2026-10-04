import { NextRequest, NextResponse } from 'next/server';
import { queryAuditLogs, AuditEventType, AuditSeverity } from '@/lib/security/audit-logger';
import { verifyGitHubTokenScope } from '@/lib/security/token-scoping';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const eventType = (searchParams.get('eventType') as AuditEventType) || undefined;
  const repo = searchParams.get('repo') || undefined;
  const severity = (searchParams.get('severity') as AuditSeverity) || undefined;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100;
  const checkToken = searchParams.get('checkToken') === 'true';

  let tokenInfo = null;
  if (checkToken) {
    tokenInfo = await verifyGitHubTokenScope();
  }

  const logs = queryAuditLogs({ eventType, repo, severity, limit });

  return NextResponse.json({
    totalLogs: logs.length,
    tokenInfo,
    logs,
  });
}
