import { NextResponse } from 'next/server';
import { generateAiResponse } from '../../../lib/flowtwinAI';
import { store } from '@/lib/dataStore';
import { buildConversationalResponse, classifyUniversalIntent, toChatPayload } from '@/lib/globalIntent';

export async function POST(req: Request) {
  try {
    const { question, message, messages = [], sector, volunteerId, language, liveOpsAnnouncement } = await req.json();
    const userMessage = message || question || '';
    const chatHistory = Array.isArray(messages) ? messages : [];
    const intent = await classifyUniversalIntent(userMessage, 'volunteer');

    if (intent === 'CONVERSATIONAL') {
      const text = await buildConversationalResponse('volunteer', userMessage, chatHistory);
      return NextResponse.json(toChatPayload(text));
    }

    const response = await generateAiResponse('volunteer_policy', userMessage, {
      chatHistory,
      volunteerId,
      sector,
      language,
      liveOpsAnnouncement,
      userRole: `You are guiding a ${sector || 'Sector'} Volunteer.`,
      openIncidents: store.getIncidents().filter(incident => incident.status !== 'resolved')
    });

    return NextResponse.json(toChatPayload(response.answer || 'I found the relevant volunteer guidance.', response));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
