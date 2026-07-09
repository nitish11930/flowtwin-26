import { NextResponse } from 'next/server';
import { store } from '@/lib/dataStore';

export async function GET() {
  return NextResponse.json(store.getFoodOrders());
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const order = store.createFoodOrder({
      amenityId: data.amenityId,
      amenityName: data.amenityName,
      pickupLocation: data.pickupLocation,
      items: Array.isArray(data.items) ? data.items : [],
      pickupEtaMins: data.pickupEtaMins
    });

    return NextResponse.json(order);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
