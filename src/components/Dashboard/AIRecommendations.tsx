'use client';
import { Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useSharedState } from '@/lib/store';

export default function AIRecommendations() {
  const { state } = useSharedState();

  const standardRecommendations = [
    {
      id: 1,
      isUrgent: false,
      text: "Deploy 2 extra accessibility staff to Concourse 1.",
      reason: "Concourse 1 congestion is increasing to MEDIUM.",
      action: "Dispatch Staff"
    }
  ];

  const surgeRecommendations = [
    {
      id: 'surge',
      isUrgent: true,
      text: "CRITICAL: Redirect crowd from Gate C to Gate B immediately.",
      reason: "Massive unexpected crowd surge detected at Gate C. Wait times exceeding 120 minutes.",
      action: "Execute Reroute Protocol"
    },
    ...standardRecommendations
  ];

  const recommendations = state.gateCSurgeActive ? surgeRecommendations : standardRecommendations;

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 flex flex-col h-full shadow-lg transition-colors duration-500">
      <h3 className="text-lg font-bold mb-4 flex items-center text-slate-200">
        <Sparkles className="mr-2 h-5 w-5 text-amber-400" /> AI Recommendations
      </h3>
      
      <div className="space-y-4 flex-1">
        {recommendations.map(rec => (
          <div key={rec.id} className={`rounded-xl p-4 border transition-colors duration-500 ${rec.isUrgent ? 'bg-red-950/30 border-red-500/50 shadow-[0_0_15px_rgba(220,38,38,0.2)]' : 'bg-slate-900 border-slate-700/50'}`}>
            <p className={`font-bold mb-1 flex items-center ${rec.isUrgent ? 'text-red-400' : 'text-white'}`}>
              {rec.isUrgent && <AlertTriangle className="h-4 w-4 mr-2 animate-pulse" />}
              {rec.text}
            </p>
            <p className="text-sm text-slate-400 mb-3">{rec.reason}</p>
            <button className={`flex items-center text-sm font-semibold transition-colors px-3 py-1.5 rounded-lg border ${rec.isUrgent ? 'text-red-400 hover:text-red-300 bg-red-500/10 border-red-500/20' : 'text-blue-400 hover:text-blue-300 bg-blue-500/10 border-blue-500/20'}`}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> {rec.action}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
