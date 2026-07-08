import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import liveCrowdData from '@/data/live-crowd-data.json';

const ai = new GoogleGenAI({});

export async function POST() {
  try {
    // Check if congested or severe weather
    const isCongested = Object.values(liveCrowdData.congestion).some((c: any) => c.level === 'Severe' || c.level === 'High');
    const hasSevereWeather = liveCrowdData.weatherAlerts.some((w: any) => w.active && w.severity === 'Warning');
    
    if (!isCongested && !hasSevereWeather) {
      return NextResponse.json({ actionPlan: "All clear. Standard operations." });
    }

    const contextStr = `
    Live Crowd Data: ${JSON.stringify(liveCrowdData, null, 2)}
    `;

    const systemPrompt = "You are FlowTwin 26 Ops AI. The stadium is experiencing severe congestion or weather alerts. Generate a concise, bulleted staff action plan (e.g., Deploy 3 ushers to Gate C, open overflow ramps).";
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${systemPrompt}\n\nContext:\n${contextStr}`
    });

    return NextResponse.json({ actionPlan: response.text });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
