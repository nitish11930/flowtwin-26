import { NextResponse } from 'next/server';
import { store } from '@/lib/dataStore';

export async function GET() {
  return NextResponse.json(store.tasks);
}
