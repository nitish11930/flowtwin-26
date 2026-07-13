'use client';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Megaphone } from 'lucide-react';
import ChatInterface from '@/components/FanChat/ChatInterface';
import { useSharedState } from '@/lib/store';

export default function FanPage() {
  const { state, setSharedState } = useSharedState();

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col">
      <header className="mb-4 flex items-center justify-between max-w-md mx-auto w-full">
        <Link href="/" className="text-blue-700 hover:text-blue-900 flex items-center transition-colors font-medium">
          <ArrowLeft className="mr-2 h-5 w-5" /> Back
        </Link>
        <h1 className="text-xl font-bold text-slate-900">
          Fan Copilot
        </h1>
        <div className="w-20"></div> {/* Spacer */}
      </header>
      
      <div className="max-w-md mx-auto w-full flex justify-center mb-6">
        <button 
          onClick={() => setSharedState({ gateCSurgeActive: !state.gateCSurgeActive })}
          className={`flex items-center px-4 py-2 rounded-full font-bold shadow-md transition-all ${state.gateCSurgeActive ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
        >
          <AlertTriangle className="mr-2 h-4 w-4" />
          {state.gateCSurgeActive ? 'Disable Gate C Surge' : 'Simulate Gate C Surge'}
        </button>
      </div>

      <main className="flex-1 max-w-md mx-auto w-full">
        {state.announcementDraft && (
          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 shadow-sm" role="status" aria-live="polite">
            <div className="mb-1 flex items-center gap-2 font-bold">
              <Megaphone className="h-4 w-4" aria-hidden="true" />
              Live stadium update{state.announcementSource ? ` from ${state.announcementSource}` : ''}
            </div>
            <p>{state.announcementDraft}</p>
          </div>
        )}
        <ChatInterface
          gateCSurgeActive={state.gateCSurgeActive}
          liveOpsAnnouncement={state.announcementDraft ? {
            text: state.announcementDraft,
            source: state.announcementSource,
            updatedAt: state.announcementUpdatedAt
          } : undefined}
        />
      </main>
    </div>
  );
}
