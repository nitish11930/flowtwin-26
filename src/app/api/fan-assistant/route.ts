import { NextResponse } from 'next/server';
import { generateAiResponse } from '../../../lib/flowtwinAI';

export async function POST(req: Request) {
  try {
    const { userMessage } = await req.json();
    
    const response = await generateAiResponse('fan_navigation', userMessage);
    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
