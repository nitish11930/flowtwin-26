import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import policies from '@/data/stadium-policies.json';

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const { question } = await req.json();
    
    const contextStr = `Policies: ${JSON.stringify(policies, null, 2)}`;
    
    const systemPrompt = "You are a stadium volunteer assistant. Answer the volunteer's question strictly using the provided policies. Do not hallucinate outside information. Keep it concise.";
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${systemPrompt}\n\nContext:\n${contextStr}\n\nQuestion: ${question}`
    });

    return NextResponse.json({ answer: response.text });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
