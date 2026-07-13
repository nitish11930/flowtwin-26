import { NextResponse } from 'next/server';
import { generateAiResponse } from '../../../../lib/flowtwinAI';
import { store } from '@/lib/dataStore';
import { buildConversationalResponse, classifyUniversalIntent, toChatPayload } from '@/lib/globalIntent';

export async function POST(req: Request) {
  try {
    const { message, messages = [], quickAction, isQuickAction, volunteerId, sector, language } = await req.json();
    const chatHistory = Array.isArray(messages) ? messages : [];
    const intent = await classifyUniversalIntent(message || '', 'volunteer');

    if (intent === 'CONVERSATIONAL') {
      const text = await buildConversationalResponse('volunteer', message || '', chatHistory);
      return NextResponse.json(toChatPayload(text));
    }
    
    const response = await generateAiResponse('volunteer_policy', message, {
      chatHistory,
      volunteerId,
      sector,
      language,
      quickAction,
      isQuickAction,
      userRole: `You are guiding a ${sector || 'Sector'} Volunteer.`,
      openIncidents: store.getIncidents().filter(incident => incident.status !== 'resolved')
    });
    return NextResponse.json(toChatPayload(response.answer || 'I found the relevant volunteer guidance.', response));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
