import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const { routeData, userMessage } = await req.json();
    
    const contextStr = `
    User Request: "${userMessage}"
    Calculated Route: ${JSON.stringify(routeData, null, 2)}
    `;

    const systemPrompt = "You are FlowTwin 26, a stadium assistant. Explain the route to the fan naturally, e.g., 'wait 8 minutes'. Add a sustainability nudge if the sustainability bonus is high.";
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${systemPrompt}\n\nContext:\n${contextStr}`
    });

    return NextResponse.json({ explanation: response.text });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
