import { NextResponse } from 'next/server';
import { getSharedStatePersistenceMode, patchSharedState, readSharedState, writeSharedState } from '@/lib/sharedStateServer';
import { normalizeSharedState } from '@/lib/sharedStateCore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await readSharedState();
    return NextResponse.json({ state, persistence: getSharedStatePersistenceMode() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to read shared state' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const state = await patchSharedState(body?.updates || {});
    return NextResponse.json({ state, persistence: getSharedStatePersistenceMode() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to update shared state' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const state = await writeSharedState(normalizeSharedState(body?.state || body));
    return NextResponse.json({ state, persistence: getSharedStatePersistenceMode() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to replace shared state' }, { status: 500 });
  }
}
