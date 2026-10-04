import { NextRequest, NextResponse } from 'next/server';
import { createApiKey, listApiKeys } from '@/lib/api-keys/key-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const keys = await listApiKeys();
    return NextResponse.json({ keys });
  } catch (err) {
    console.error('[API /api/keys] GET Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list API keys' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = body.name || 'Developer Key';
    const rateLimit = typeof body.rateLimit === 'number' ? body.rateLimit : 60;

    const result = await createApiKey({ name, rateLimit });

    return NextResponse.json(
      {
        message: 'API key created successfully. Store this secret key safely as it will not be shown again.',
        key: result.key,
        id: result.id,
        name: result.name,
        keyPrefix: result.keyPrefix,
        rateLimit: result.rateLimit,
        createdAt: result.createdAt,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[API /api/keys] POST Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create API key' },
      { status: 500 }
    );
  }
}
