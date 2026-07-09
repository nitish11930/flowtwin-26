import { NextResponse } from 'next/server';
import { generateAiResponse } from '../../../lib/flowtwinAI';

export async function POST(req: Request) {
  try {
    const { userMessage, messages = [] } = await req.json();
    
    const response = await generateAiResponse('fan_navigation', userMessage, {
      chatHistory: messages,
      userRole: 'You are speaking to a stadium Fan.'
    });
    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
