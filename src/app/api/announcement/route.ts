import { NextResponse } from 'next/server';
import { generateAiResponse } from '../../../lib/flowtwinAI';

export async function POST(req: Request) {
  try {
    const { staffInput } = await req.json();
    
    const response = await generateAiResponse('announcement', staffInput);
    return NextResponse.json({ translations: response });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
