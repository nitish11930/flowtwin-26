import Link from 'next/link';
import { Users, ShieldAlert, Bot } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-slate-50 text-slate-900">
      <div className="z-10 max-w-7xl w-full flex flex-col items-center text-center gap-12">
        <div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-4 text-slate-900">
            FlowTwin 26
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Select your portal to enter the stadium experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
          {/* Fan Portal */}
          <Link 
            href="/fan" 
            className="group block p-8 rounded-3xl bg-blue-600 hover:bg-blue-700 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
              <Users size={80} />
            </div>
            <div className="relative z-10 text-left">
              <Users className="text-white mb-6 h-12 w-12" />
              <h2 className="text-3xl font-bold text-white mb-3">Fan Copilot</h2>
              <p className="text-blue-100 font-medium text-lg leading-relaxed">
                Mobile-first experience for stadium navigation and real-time support.
              </p>
            </div>
          </Link>

          {/* Volunteer Portal */}
          <Link 
            href="/volunteer" 
            className="group block p-8 rounded-3xl bg-amber-500 hover:bg-amber-600 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity">
              <Users size={80} />
            </div>
            <div className="relative z-10 text-left">
              <Users className="text-white mb-6 h-12 w-12" />
              <h2 className="text-3xl font-bold text-white mb-3">Volunteer Hub</h2>
              <p className="text-amber-100 font-medium text-lg leading-relaxed">
                Manage tasks, view active incidents, and access the emergency checklist.
              </p>
            </div>
          </Link>
          
          {/* Operations Portal */}
          <Link 
            href="/ops" 
            className="group block p-8 rounded-3xl bg-slate-900 hover:bg-slate-800 transition-all duration-300 transform hover:-translate-y-2 hover:shadow-2xl shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <ShieldAlert size={80} />
            </div>
            <div className="relative z-10 text-left">
              <ShieldAlert className="text-white mb-6 h-12 w-12" />
              <h2 className="text-3xl font-bold text-white mb-3">Operations</h2>
              <p className="text-slate-400 font-medium text-lg leading-relaxed">
                Monitor live crowds, dispatch AI announcements, and oversee stadium flow.
              </p>
            </div>
          </Link>
          
        </div>
      </div>
    </main>
  );
}
