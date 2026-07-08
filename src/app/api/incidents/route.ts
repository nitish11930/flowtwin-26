import { NextResponse } from 'next/server';
import { store } from '@/lib/dataStore';

export async function GET() {
  return NextResponse.json(store.getIncidents());
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const newIncident = store.addIncident({
      type: data.type,
      sector: data.sector,
      location: data.location,
      description: data.description,
      severity: data.severity,
      status: data.status,
      assignedTo: data.assignedTo,
      securityNotified: data.securityNotified,
      teamNotified: data.teamNotified,
      medicalTeamNotified: data.medicalTeamNotified,
      dispatchNotified: data.dispatchNotified,
      missingDetails: data.missingDetails,
      notes: data.notes,
      timeline: data.timeline
    });
    return NextResponse.json(newIncident);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
