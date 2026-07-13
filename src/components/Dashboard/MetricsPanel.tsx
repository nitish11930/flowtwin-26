'use client';
import type { ReactNode } from 'react';
import { Activity, AlertCircle, CheckCircle2, Megaphone, Train, Users } from 'lucide-react';
import { useSharedState } from '@/lib/store';

type MetricCardProps = {
  title: string;
  value: string;
  unit?: string;
  status: string;
  iconColor: string;
  tone?: 'normal' | 'good' | 'warning' | 'critical';
  onAnnounce: () => void;
  announceLabel: string;
  children?: ReactNode;
};

function MetricCard({ title, value, unit, status, iconColor, tone = 'normal', onAnnounce, announceLabel, children }: MetricCardProps) {
  const toneClasses = {
    normal: 'bg-slate-900 border-slate-700/50',
    good: 'bg-emerald-950/20 border-emerald-500/40',
    warning: 'bg-yellow-950/20 border-yellow-500/40',
    critical: 'bg-red-950/40 border-red-500/50 shadow-[0_0_16px_rgba(239,68,68,0.18)]'
  }[tone];

  return (
    <article className={`rounded-xl p-4 border flex flex-col justify-between min-h-[164px] transition-colors duration-300 ${toneClasses}`}>
      <div>
        <div className="text-slate-300 text-sm flex items-center gap-2 mb-2">
          <Users className={`h-4 w-4 ${iconColor}`} aria-hidden="true" />
          <span>{title}</span>
        </div>
        <div className="text-2xl font-bold text-white">
          {value} {unit ? <span className="text-sm text-slate-400 font-normal">{unit}</span> : null}
        </div>
        <p className="mt-2 text-xs text-slate-400">{status}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAnnounce}
          aria-label={announceLabel}
          className="inline-flex items-center gap-2 rounded-lg border border-blue-400/40 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-200 transition-colors hover:bg-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <Megaphone className="h-4 w-4" aria-hidden="true" />
          Announce
        </button>
        {children}
      </div>
    </article>
  );
}

export default function MetricsPanel() {
  const { state, setSharedState } = useSharedState();

  const publishAnnouncement = (source: string, draft: string) => {
    setSharedState({
      announcementDraft: draft,
      announcementSource: source,
      announcementUpdatedAt: Date.now()
    });
  };

  const toggleGateCSurge = () => {
    const nextSurge = !state.gateCSurgeActive;
    setSharedState({
      gateCSurgeActive: nextSurge,
      announcementDraft: nextSurge
        ? 'Gate C is currently experiencing a heavy surge. Please use Gate A or Gate B for faster entry, follow volunteer directions, and keep accessible lanes clear.'
        : 'Gate C crowd pressure has eased. Fans may use Gate C again while following staff directions and keeping accessible lanes clear.',
      announcementSource: nextSurge ? 'Gate C surge activated' : 'Gate C surge cleared',
      announcementUpdatedAt: Date.now()
    });
  };

  return (
    <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6 flex flex-col h-full shadow-lg" aria-labelledby="live-metrics-heading">
      <h3 id="live-metrics-heading" className="text-lg font-bold mb-4 flex items-center text-slate-200">
        <Activity className="mr-2 h-5 w-5 text-emerald-400" aria-hidden="true" /> Live Metrics
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
        <MetricCard
          title="Gate A Wait"
          value="15"
          unit="min"
          status="Open with moderate entry flow"
          iconColor="text-yellow-400"
          tone="warning"
          announceLabel="Announce Gate A entry status"
          onAnnounce={() => publishAnnouncement('Gate A', 'Gate A is open with an estimated 15 minute wait. Fans who need faster entry should consider Gate B, and all fans should follow staff directions.')}
        />

        <MetricCard
          title="Gate B Wait"
          value="5"
          unit="min"
          status="Best current entry option"
          iconColor="text-emerald-400"
          tone="good"
          announceLabel="Announce Gate B is clear for fan movement"
          onAnnounce={() => publishAnnouncement('Gate B', 'Gate B is currently clear with an estimated 5 minute wait. Fans may move to Gate B for faster entry. Please keep accessible lanes clear and follow staff directions.')}
        />

        <MetricCard
          title="Gate C Wait"
          value={state.gateCSurgeActive ? '120+' : '10'}
          unit="min"
          status={state.gateCSurgeActive ? 'Surge active, reroute fans now' : 'Normal flow, surge toggle ready'}
          iconColor={state.gateCSurgeActive ? 'text-red-400' : 'text-emerald-400'}
          tone={state.gateCSurgeActive ? 'critical' : 'normal'}
          announceLabel="Announce Gate C status"
          onAnnounce={() => publishAnnouncement(
            'Gate C',
            state.gateCSurgeActive
              ? 'Gate C is currently experiencing a heavy surge. Please use Gate A or Gate B for faster entry, follow volunteer directions, and keep accessible lanes clear.'
              : 'Gate C is currently open with an estimated 10 minute wait. Fans may use Gate C while following volunteer directions and keeping accessible lanes clear.'
          )}
        >
          <button
            type="button"
            onClick={toggleGateCSurge}
            aria-pressed={state.gateCSurgeActive}
            aria-label={state.gateCSurgeActive ? 'Disable Gate C surge simulation' : 'Enable Gate C surge simulation'}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 ${state.gateCSurgeActive ? 'border-red-400/60 bg-red-500/15 text-red-100 hover:bg-red-500/25 focus:ring-red-300' : 'border-slate-500/60 bg-slate-700/50 text-slate-100 hover:bg-slate-700 focus:ring-slate-300'}`}
          >
            {state.gateCSurgeActive ? <AlertCircle className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
            {state.gateCSurgeActive ? 'Clear Surge' : 'Toggle Surge'}
          </button>
        </MetricCard>

        <article className="rounded-xl p-4 border border-slate-700/50 bg-slate-900 flex flex-col justify-between min-h-[164px]">
          <div>
            <div className="text-slate-300 text-sm flex items-center gap-2 mb-2">
              <Train className="h-4 w-4 text-yellow-400" aria-hidden="true" />
              <span>Metro Status</span>
            </div>
            <div className="text-xl font-bold text-white capitalize">Delayed (12m)</div>
            <p className="mt-2 text-xs text-slate-400">Transit announcement ready</p>
          </div>
          <button
            type="button"
            onClick={() => publishAnnouncement('Metro', 'Transit update: Metro service is delayed by 12 minutes. Please allow extra travel time, follow staff directions, and use the least crowded available gate.')}
            aria-label="Announce Metro delay"
            className="mt-4 inline-flex w-fit items-center gap-2 rounded-lg border border-blue-400/40 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-200 transition-colors hover:bg-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <Megaphone className="h-4 w-4" aria-hidden="true" />
            Announce
          </button>
        </article>
      </div>
    </section>
  );
}
