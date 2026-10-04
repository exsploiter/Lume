import { NextRequest, NextResponse } from 'next/server';
import { seedDemoPreset, DEMO_PRESETS, DemoPresetMeta } from '@/lib/demo/demo-presets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: NextRequest,
  { params }: { params: { presetId: string } }
) {
  try {
    const presetId = params.presetId as DemoPresetMeta['id'];
    const valid = DEMO_PRESETS.some((p) => p.id === presetId);

    if (!valid) {
      return NextResponse.json(
        {
          error: 'Invalid preset ID',
          availablePresets: DEMO_PRESETS.map((p) => ({ id: p.id, name: p.name })),
        },
        { status: 400 }
      );
    }

    const analysisId = await seedDemoPreset(presetId);

    return NextResponse.json({
      success: true,
      analysisId,
      redirectUrl: `/analyze/${analysisId}`,
      message: `Demo repository "${presetId}" seeded and ready for interactive exploration.`,
    });
  } catch (err) {
    console.error(`[API /api/demo/preset/${params.presetId}] Error:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to seed demo preset' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { presetId: string } }
) {
  return POST(request, { params });
}
