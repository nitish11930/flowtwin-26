import { NextResponse } from 'next/server';
import { generateAiResponse } from '../../../../lib/flowtwinAI';
import { store } from '@/lib/dataStore';

export async function POST(req: Request) {
  try {
    const { message, volunteerId, sector, language } = await req.json();
    
    const response = await generateAiResponse('volunteer_policy', message, {
      volunteerId,
      sector,
      language,
      openIncidents: store.getIncidents().filter(incident => incident.status !== 'resolved')
    });
    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
