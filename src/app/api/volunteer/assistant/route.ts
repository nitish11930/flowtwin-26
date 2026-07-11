import { NextResponse } from 'next/server';
import { generateAiResponse } from '../../../../lib/flowtwinAI';
import { store } from '@/lib/dataStore';

export async function POST(req: Request) {
  try {
    const { message, messages = [], quickAction, isQuickAction, volunteerId, sector, language } = await req.json();
    
    const response = await generateAiResponse('volunteer_policy', message, {
      chatHistory: messages,
      volunteerId,
      sector,
      language,
      quickAction,
      isQuickAction,
      userRole: `You are guiding a ${sector || 'Sector'} Volunteer.`,
      openIncidents: store.getIncidents().filter(incident => incident.status !== 'resolved')
    });
    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
