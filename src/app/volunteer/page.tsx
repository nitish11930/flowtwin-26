import Link from 'next/link';
import { ArrowLeft, CheckSquare, ShieldAlert } from 'lucide-react';
import VolunteerChat from '@/components/Volunteer/VolunteerChat';
import policies from '@/data/stadium-policies.json';

export default function VolunteerDashboard() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col">
      <header className="mb-8 flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center">
          <Link href="/" className="text-slate-500 hover:text-slate-900 flex items-center transition-colors mr-6">
            <ArrowLeft className="mr-2 h-4 w-4" /> Hub
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Volunteer Hub
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold border border-amber-200">
            Sector 102
          </div>
        </div>
      </header>
      
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
        {/* Left Column - Tasks & Checklist */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-4 flex items-center text-slate-900">
              <CheckSquare className="mr-2 h-5 w-5 text-emerald-500" /> Active Tasks
            </h2>
            <ul className="space-y-3">
              <li className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center">
                <div>
                  <p className="font-bold text-slate-900 text-sm">Assist at Gate B Accessible Entry</p>
                  <p className="text-xs text-slate-500">Duration: 14:00 - 16:00</p>
                </div>
                <button className="px-4 py-2 bg-emerald-500 text-white text-sm font-semibold rounded-lg hover:bg-emerald-600 transition-colors">
                  Complete
                </button>
              </li>
              <li className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex justify-between items-center opacity-60">
                <div>
                  <p className="font-bold text-slate-900 text-sm line-through">Stock Water Stations</p>
                  <p className="text-xs text-slate-500">Duration: 13:00 - 14:00</p>
                </div>
                <span className="text-emerald-500 font-bold text-sm">Done</span>
              </li>
            </ul>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-4 flex items-center text-slate-900">
              <ShieldAlert className="mr-2 h-5 w-5 text-red-500" /> Emergency Checklist
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {policies.policies.map(policy => (
                <div key={policy.category} className="p-4 rounded-xl border border-slate-200 bg-red-50/30">
                  <h3 className="font-bold text-red-700 text-sm mb-2">{policy.category} ({policy.protocol})</h3>
                  <p className="text-xs text-slate-600 mb-2">{policy.instructions[0]}</p>
                  <p className="text-xs font-semibold text-slate-800">Contact: {policy.contactLocation}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
        
        {/* Right Column - RAG Chat */}
        <div className="flex flex-col gap-6">
          <VolunteerChat />
        </div>
      </main>
    </div>
  );
}
