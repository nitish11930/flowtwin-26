import Link from 'next/link';
import { Activity, Users } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-50 text-slate-900">
      <div className="z-10 max-w-4xl w-full flex flex-col items-center text-center gap-12">
        <div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4 text-slate-900">
            FlowTwin 26
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Select your portal to enter the stadium experience.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 w-full justify-center items-stretch">
          {/* Fan View Button */}
          <Link href="/fan" className="w-full md:w-1/3 max-w-sm">
            <button className="h-full w-full group relative flex flex-col items-center justify-center p-10 bg-white border-2 border-blue-600 hover:bg-blue-50 rounded-3xl transition-all shadow-xl hover:shadow-2xl hover:-translate-y-2 overflow-hidden">
              <Users className="h-16 w-16 text-blue-600 mb-4 group-hover:scale-110 transition-transform" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Fan Copilot</h2>
              <p className="text-slate-600 text-sm">Mobile-First & Accessible</p>
            </button>
          </Link>

          {/* Volunteer View Button */}
          <Link href="/volunteer" className="w-full md:w-1/3 max-w-sm">
            <button className="h-full w-full group relative flex flex-col items-center justify-center p-10 bg-white border-2 border-amber-500 hover:bg-amber-50 rounded-3xl transition-all shadow-xl hover:shadow-2xl hover:-translate-y-2 overflow-hidden">
              <Activity className="h-16 w-16 text-amber-500 mb-4 group-hover:scale-110 transition-transform" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Volunteer Hub</h2>
              <p className="text-slate-600 text-sm">RAG Policies & Tasks</p>
            </button>
          </Link>

          {/* Operations View Button */}
          <Link href="/ops" className="w-full md:w-1/3 max-w-sm">
            <button className="h-full w-full group relative flex flex-col items-center justify-center p-10 bg-slate-900 border-2 border-slate-900 hover:bg-slate-800 rounded-3xl transition-all shadow-xl hover:shadow-2xl hover:-translate-y-2 overflow-hidden">
              <Activity className="h-16 w-16 text-emerald-400 mb-4 group-hover:scale-110 transition-transform" />
              <h2 className="text-2xl font-bold text-white mb-2">Ops Dashboard</h2>
              <p className="text-slate-400 text-sm">Desktop Command Center</p>
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
}
