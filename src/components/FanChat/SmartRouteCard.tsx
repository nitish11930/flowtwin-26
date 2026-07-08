import { ShieldCheck } from 'lucide-react';
import { RouteScoreResult } from '@/lib/routingEngine';

export default function SmartRouteCard({ routeData }: { routeData: RouteScoreResult }) {
  if (!routeData) return null;

  return (
    <div className="bg-white rounded-2xl p-5 border-2 border-blue-100 shadow-md mt-2 w-full">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-blue-700 font-bold text-base flex items-center">
            <ShieldCheck className="mr-2 h-4 w-4" /> Smart Route
          </h3>
          <p className="text-slate-600 text-xs mt-1 font-medium">Optimized for safety and accessibility</p>
        </div>
        <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs font-bold border border-blue-200">
          Score: {routeData.score}
        </div>
      </div>

      <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
        {routeData.path.map((node: string, idx: number) => (
          <div key={idx} className="flex items-center">
            <div className="relative flex flex-col items-center mr-3">
              <div className={`h-4 w-4 rounded-full flex items-center justify-center shadow-sm border-2 border-white ${idx === 0 ? 'bg-blue-500' : idx === routeData.path.length - 1 ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              {idx < routeData.path.length - 1 && (
                <div className="h-6 w-0.5 bg-slate-300 my-1 rounded-full" />
              )}
            </div>
            <div className="text-slate-800 font-bold text-sm">
              {node.replace(/_/g, ' ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
