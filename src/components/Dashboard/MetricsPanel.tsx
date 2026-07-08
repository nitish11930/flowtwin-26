'use client';
import liveData from '@/data/live-crowd-data.json';
import { Activity, Clock, Users, Train, AlertCircle } from 'lucide-react';
import { useSharedState } from '@/lib/store';

export default function MetricsPanel() {
  const { state } = useSharedState();

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 flex flex-col h-full shadow-lg">
      <h3 className="text-lg font-bold mb-4 flex items-center text-slate-200">
        <Activity className="mr-2 h-5 w-5 text-emerald-400" /> Live Metrics
      </h3>
      
      <div className="grid grid-cols-2 gap-4 flex-1">
        <div className="bg-slate-900 rounded-xl p-4 border border-slate-700/50 flex flex-col justify-center">
          <div className="text-slate-400 text-sm flex items-center mb-1">
            <Users className="h-4 w-4 mr-1 text-yellow-400" /> Gate A Wait
          </div>
          <div className="text-2xl font-bold text-white">15 <span className="text-sm text-slate-500 font-normal">min</span></div>
        </div>

        <div className="bg-slate-900 rounded-xl p-4 border border-slate-700/50 flex flex-col justify-center">
          <div className="text-slate-400 text-sm flex items-center mb-1">
            <Users className="h-4 w-4 mr-1 text-emerald-400" /> Gate B Wait
          </div>
          <div className="text-2xl font-bold text-white">5 <span className="text-sm text-slate-500 font-normal">min</span></div>
        </div>

        <button 
          onClick={() => setSharedState({ gateCSurgeActive: !state.gateCSurgeActive })}
          className={`text-left rounded-xl p-4 border flex flex-col justify-center transition-colors duration-500 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-slate-500 ${state.gateCSurgeActive ? 'bg-red-950/40 border-red-500/50' : 'bg-slate-900 border-slate-700/50 cursor-pointer'}`}>
          <div className={`text-sm flex items-center mb-1 ${state.gateCSurgeActive ? 'text-red-400 font-bold' : 'text-slate-400'}`}>
            {state.gateCSurgeActive ? <AlertCircle className="h-4 w-4 mr-1 animate-pulse" /> : <Users className="h-4 w-4 mr-1 text-emerald-400" />}
            Gate C Wait (Toggle Surge)
          </div>
          <div className={`text-2xl font-bold ${state.gateCSurgeActive ? 'text-red-400' : 'text-white'}`}>
            {state.gateCSurgeActive ? '120+' : '10'} <span className="text-sm font-normal opacity-70">min</span>
          </div>
        </button>

        <div className="bg-slate-900 rounded-xl p-4 border border-slate-700/50 flex flex-col justify-center">
          <div className="text-slate-400 text-sm flex items-center mb-1">
            <Train className="h-4 w-4 mr-1 text-yellow-400" /> Metro Status
          </div>
          <div className="text-xl font-bold text-white capitalize">Delayed (12m)</div>
        </div>
      </div>
    </div>
  );
}
