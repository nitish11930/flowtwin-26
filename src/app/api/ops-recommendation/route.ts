import { NextResponse } from 'next/server';
import { generateAiResponse } from '../../../lib/flowtwinAI';

export async function POST() {
  try {
    const response = await generateAiResponse('operations_command', 'Analyze operations context and generate action plan');
    
    let plan = '';
    if (response.recommendations && response.recommendations.length > 0) {
      plan = response.recommendations.map((r: any) => `- ${r.title}: ${r.description}`).join('\n');
    } else {
      plan = 'All clear. Standard operations.';
    }

    return NextResponse.json({ actionPlan: plan });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
