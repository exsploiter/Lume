import { NextRequest, NextResponse } from 'next/server';
import { getDebtNodes } from '@/lib/supabase/server';
import { exportToCSV } from '@/lib/csv';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const nodes = await getDebtNodes(params.id);
    const csv = exportToCSV(nodes);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="debtradar-${params.id}.csv"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 }
    );
  }
}
