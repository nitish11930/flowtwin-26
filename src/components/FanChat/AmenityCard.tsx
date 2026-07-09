import { Accessibility, Clock3, MapPin, ShoppingBag, Utensils, Users } from 'lucide-react';
import type { AmenityRecommendation } from '@/lib/amenityEngine';

type AmenityCardProps = {
  amenityData: AmenityRecommendation;
  orderId?: string;
  isOrdering?: boolean;
  onReserve?: () => void;
};

const crowdTone: Record<string, string> = {
  Low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Moderate: 'bg-blue-50 text-blue-700 border-blue-200',
  High: 'bg-amber-50 text-amber-700 border-amber-200',
  Severe: 'bg-red-50 text-red-700 border-red-200'
};

export default function AmenityCard({ amenityData, orderId, isOrdering, onReserve }: AmenityCardProps) {
  const { amenity, alternative, routeSummary, reason, bookingAvailable } = amenityData;

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{amenity.category.replace('_', ' ')}</p>
            <h3 className="mt-1 text-base font-bold text-slate-900">{amenity.name}</h3>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${crowdTone[amenity.crowdLevel] ?? crowdTone.Moderate}`}>
            {amenity.crowdLevel} crowd
          </span>
        </div>
      </div>

      <div className="grid gap-3 p-4 text-sm text-slate-700">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3">
            <MapPin className="mt-0.5 h-4 w-4 text-emerald-600" />
            <span>{amenity.location}</span>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3">
            <Clock3 className="mt-0.5 h-4 w-4 text-emerald-600" />
            <span>{amenity.walkingTimeMins} min walk • {amenity.queueTimeMins} min queue</span>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3">
            <Users className="mt-0.5 h-4 w-4 text-emerald-600" />
            <span>{reason}</span>
          </div>
          <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3">
            <Accessibility className="mt-0.5 h-4 w-4 text-emerald-600" />
            <span>{amenity.accessible ? 'Accessible route available' : 'Ask a volunteer for accessible support'}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Available here</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {amenity.items.map(item => (
              <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                {item}
              </span>
            ))}
          </div>
        </div>

        <p className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs font-medium text-blue-900">
          {routeSummary}
        </p>

        {alternative && (
          <p className="text-xs text-slate-500">
            Backup option: <span className="font-semibold text-slate-700">{alternative.name}</span> near {alternative.location}.
          </p>
        )}

        {bookingAvailable && (
          <div className="flex flex-wrap items-center gap-2">
            {orderId ? (
              <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                <ShoppingBag className="mr-1.5 h-3.5 w-3.5" /> Pickup reserved: {orderId}
              </span>
            ) : (
              <button
                type="button"
                onClick={onReserve}
                disabled={isOrdering}
                className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <Utensils className="mr-1.5 h-3.5 w-3.5" />
                {isOrdering ? 'Reserving...' : 'Reserve pickup'}
              </button>
            )}
            <span className="text-xs font-medium text-slate-500">No payment in demo; confirms pickup slot only.</span>
          </div>
        )}
      </div>
    </section>
  );
}
