'use client';
import { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useSharedState } from '@/lib/store';

export default function AIRecommendations() {
  const { state } = useSharedState();
  const [recommendation, setRecommendation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!state.gateCSurgeActive) {
        setRecommendation('All clear. Gate C surge mode is off. Gate B is currently the fastest entry option, and standard volunteer coverage is sufficient.');
        setIsUrgent(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch('/api/ops-recommendation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Gate C is surging. Generate action plan for rerouting fans and public announcements.' })
        });
        const data = await response.json();
        setRecommendation(data.text || data.widgetData?.actionPlan || 'All clear. Standard operations.');
        setIsUrgent(true);
      } catch (e) {
        console.error(e);
        setRecommendation('Unable to refresh AI recommendations. Keep Gate C monitored and use manual crowd-control procedures.');
        setIsUrgent(true);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRecommendations();
  }, [state.gateCSurgeActive]);

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 flex flex-col h-full shadow-lg transition-colors duration-500">
      <h3 className="text-lg font-bold mb-4 flex items-center text-slate-200">
        <Sparkles className="mr-2 h-5 w-5 text-amber-400" /> AI Recommendations
      </h3>
      
      <div className="space-y-4 flex-1">
        {isLoading ? (
          <div className="flex items-center text-slate-400">
            <Loader2 className="animate-spin mr-2 h-5 w-5" /> Analyzing live sensors...
          </div>
        ) : (
          <div className={`rounded-xl p-4 border transition-colors duration-500 ${isUrgent ? 'bg-red-950/30 border-red-500/50 shadow-[0_0_15px_rgba(220,38,38,0.2)]' : 'bg-slate-900 border-slate-700/50'}`}>
            <p className={`font-bold mb-1 flex items-center ${isUrgent ? 'text-red-400' : 'text-emerald-400'}`}>
              {isUrgent ? <AlertTriangle className="h-4 w-4 mr-2 animate-pulse" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {isUrgent ? 'CRITICAL ACTION REQUIRED' : 'Status Normal'}
            </p>
            <p className="text-sm text-slate-300 mt-2 whitespace-pre-line">{recommendation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
