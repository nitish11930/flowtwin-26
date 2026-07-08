import Link from 'next/link';
import { ArrowLeft, Bell } from 'lucide-react';
import StadiumHeatMap from '@/components/Dashboard/StadiumHeatMap';
import MetricsPanel from '@/components/Dashboard/MetricsPanel';
import AIRecommendations from '@/components/Dashboard/AIRecommendations';

export default function OpsDashboard() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 flex flex-col">
      <header className="mb-8 flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center">
          <Link href="/" className="text-slate-400 hover:text-white flex items-center transition-colors mr-6">
            <ArrowLeft className="mr-2 h-4 w-4" /> Hub
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            FlowTwin Operations Command
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <button className="relative p-2 text-slate-400 hover:text-white transition-colors bg-slate-800 rounded-full border border-slate-700">
            <Bell className="h-5 w-5" />
            <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
          </button>
          <div className="h-8 w-8 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 font-bold text-sm">
            JS
          </div>
        </div>
      </header>
      
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
        {/* Left Column - Heat Map (spans 2 cols on large screens) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <StadiumHeatMap />
        </div>
        
        {/* Right Column - Metrics & AI */}
        <div className="flex flex-col gap-6">
          <MetricsPanel />
          <AIRecommendations />
        </div>
      </main>
    </div>
  );
}
