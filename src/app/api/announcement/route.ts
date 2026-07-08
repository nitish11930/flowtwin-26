import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({});

export async function POST(req: Request) {
  try {
    const { staffInput } = await req.json();
    
    const systemPrompt = "Translate the following stadium announcement simultaneously into a JSON object with these exact keys: english, spanish, french, portuguese, arabic, hindi. Output ONLY raw JSON, no markdown blocks.";
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${systemPrompt}\n\nAnnouncement: ${staffInput}`
    });

    let jsonResponse;
    try {
      jsonResponse = JSON.parse(response.text?.replace(/```json/g, '').replace(/```/g, '').trim() || '{}');
    } catch(e) {
      jsonResponse = { error: "Failed to parse translations" };
    }

    return NextResponse.json({ translations: jsonResponse });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
