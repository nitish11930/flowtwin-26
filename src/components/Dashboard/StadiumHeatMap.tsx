'use client';
import liveData from '@/data/live-crowd-data.json';
import { Map } from 'lucide-react';
import { useSharedState } from '@/lib/store';

export default function StadiumHeatMap() {
  const { state } = useSharedState();

  const getCongestionColor = (status: string, isGateC: boolean = false) => {
    if (isGateC && state.gateCSurgeActive) {
      return 'bg-red-600 border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.8)] animate-pulse'; // Extra red and pulsating for surge
    }

    switch (status) {
      case 'high': return 'bg-red-500/80 border-red-400';
      case 'medium': return 'bg-yellow-500/80 border-yellow-400';
      case 'low': return 'bg-emerald-500/80 border-emerald-400';
      default: return 'bg-slate-500/80 border-slate-400';
    }
  };

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 flex flex-col h-full shadow-lg">
      <h3 className="text-lg font-bold mb-4 flex items-center text-slate-200">
        <Map className="mr-2 h-5 w-5 text-blue-400" /> Stadium Heat Map
      </h3>
      
      <div className="flex-1 relative bg-slate-900 rounded-xl border border-slate-700 p-4 min-h-[400px] flex items-center justify-center overflow-hidden">
        {/* A simple visual representation of the stadium */}
        <div className="w-64 h-64 border-4 border-slate-700 rounded-full flex items-center justify-center relative bg-slate-800">
          <div className="text-slate-500 font-bold tracking-widest">PITCH</div>
          
          {/* Gate A */}
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-12 rounded-lg border-2 flex items-center justify-center text-xs font-bold text-white transition-colors duration-500 ${getCongestionColor(liveData.congestion?.['Gate A']?.level?.toLowerCase() || 'low')}`}>
            GATE A
          </div>

          {/* Gate B */}
          <div className={`absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-12 h-20 rounded-lg border-2 flex items-center justify-center text-xs font-bold text-white transition-colors duration-500 ${getCongestionColor(liveData.congestion?.['Gate B']?.level?.toLowerCase() || 'low')}`}>
            <span className="-rotate-90 block">GATE B</span>
          </div>

          {/* Gate C (New Gate for Surge Demo) */}
          <div className={`absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-12 h-20 rounded-lg border-2 flex items-center justify-center text-xs font-bold text-white transition-colors duration-500 ${getCongestionColor('low', true)}`}>
            <span className="rotate-90 block">GATE C</span>
          </div>

          {/* Concourse 1 */}
          <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 w-40 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white transition-colors duration-500 ${getCongestionColor(liveData.congestion?.['Food Court North']?.level?.toLowerCase() || 'low')}`}>
            CONCOURSE 1
          </div>
        </div>
      </div>
      
      <div className="mt-6 flex gap-6 text-sm text-slate-400 justify-center">
        <div className="flex items-center"><div className="w-4 h-4 rounded bg-red-500 mr-2" /> High Congestion</div>
        <div className="flex items-center"><div className="w-4 h-4 rounded bg-yellow-500 mr-2" /> Medium</div>
        <div className="flex items-center"><div className="w-4 h-4 rounded bg-emerald-500 mr-2" /> Low</div>
      </div>
    </div>
  );
}
