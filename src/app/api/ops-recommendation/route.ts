import { NextResponse } from 'next/server';
import { generateAiResponse } from '../../../lib/flowtwinAI';
import { buildConversationalResponse, classifyUniversalIntent, toChatPayload } from '@/lib/globalIntent';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = body.message || body.question || 'Analyze operations context and generate action plan';
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const stadiumKnowledge = Array.isArray(body.stadiumKnowledge) ? body.stadiumKnowledge : [];
    const intent = await classifyUniversalIntent(message, 'ops');

    if (intent === 'CONVERSATIONAL') {
      const text = await buildConversationalResponse('ops', message, messages);
      return NextResponse.json(toChatPayload(text));
    }

    const response = await generateAiResponse('operations_command', message, {
      chatHistory: messages,
      stadiumKnowledge,
      userRole: 'You are advising an Operations Organizer.'
    });
    
    let plan = '';
    if (response.recommendations && response.recommendations.length > 0) {
      plan = response.recommendations.map((r: any) => `- ${r.title}: ${r.description}`).join('\n');
    } else {
      plan = 'All clear. Standard operations.';
    }

    return NextResponse.json(toChatPayload(plan, { actionPlan: plan, recommendations: response.recommendations ?? [], raw: response }));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
