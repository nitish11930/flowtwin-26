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

        <div className="flex flex-col md:flex-row gap-8 w-full justify-center items-center">
          {/* Fan View Button */}
          <Link href="/fan" className="w-full md:w-1/2 max-w-md">
            <button className="w-full group relative flex flex-col items-center justify-center p-12 bg-white border-2 border-blue-600 hover:bg-blue-50 rounded-3xl transition-all shadow-xl hover:shadow-2xl hover:-translate-y-2 overflow-hidden">
              <Users className="h-20 w-20 text-blue-600 mb-6 group-hover:scale-110 transition-transform" />
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Fan Copilot</h2>
              <p className="text-slate-600">Mobile-First & Accessible</p>
            </button>
          </Link>

          {/* Operations View Button */}
          <Link href="/ops" className="w-full md:w-1/2 max-w-md">
            <button className="w-full group relative flex flex-col items-center justify-center p-12 bg-slate-900 border-2 border-slate-900 hover:bg-slate-800 rounded-3xl transition-all shadow-xl hover:shadow-2xl hover:-translate-y-2 overflow-hidden">
              <Activity className="h-20 w-20 text-emerald-400 mb-6 group-hover:scale-110 transition-transform" />
              <h2 className="text-3xl font-bold text-white mb-2">Ops Dashboard</h2>
              <p className="text-slate-400">Desktop Command Center</p>
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
}
