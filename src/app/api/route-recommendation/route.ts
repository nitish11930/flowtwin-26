import { NextResponse } from 'next/server';
import { calculateBestRoute } from '@/lib/routingEngine';

export async function POST(req: Request) {
  try {
    const { needsAccess, gateCSurgeActive } = await req.json();
    const best = calculateBestRoute({ requiresAccessibility: needsAccess }, gateCSurgeActive);
    
    if (!best) {
      return NextResponse.json({ error: "No valid route found." }, { status: 400 });
    }

    return NextResponse.json({ routeData: best });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
