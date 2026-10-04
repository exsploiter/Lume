import { NextRequest, NextResponse } from 'next/server';
import { revokeApiKey } from '@/lib/api-keys/key-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const keyId = params.id;
    const success = await revokeApiKey(keyId);

    if (!success) {
      return NextResponse.json(
        { error: 'Not Found', message: `API key ${keyId} not found or already inactive.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: `API key ${keyId} has been successfully revoked.`,
    });
  } catch (err) {
    console.error(`[API /api/keys/${params.id}] DELETE Error:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}
