import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import policies from '@/data/stadium-policies.json';
import { buildRagContext } from '@/lib/ragKnowledge';
import { buildConversationalResponse, classifyUniversalIntent, toChatPayload } from '@/lib/globalIntent';

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const { question, messages = [] } = await req.json();
    const intent = await classifyUniversalIntent(question || '', 'volunteer');

    if (intent === 'CONVERSATIONAL') {
      const text = await buildConversationalResponse('volunteer', question || '', Array.isArray(messages) ? messages : []);
      return NextResponse.json(toChatPayload(text));
    }

    const rag = buildRagContext(question, 'volunteer_policy');
    
    const contextStr = `Policies: ${JSON.stringify(policies, null, 2)}`;
    
    const systemPrompt = [
      'You are a stadium volunteer assistant for FlowTwin Arena.',
      "Answer strictly using retrieved stadium knowledge and policies.",
      'Do not hallucinate outside information.',
      'Keep it concise and operational.',
      'Retrieved knowledge:',
      rag.contextText
    ].join('\n');
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${systemPrompt}\n\nContext:\n${contextStr}\n\nQuestion: ${question}`
    });

    const text = response.text || 'I found the relevant volunteer guidance.';
    return NextResponse.json(toChatPayload(text, { answer: text, retrievedKnowledge: rag.retrieved }));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
