'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckSquare, ShieldAlert, AlertTriangle, Bell, CheckCircle2, Edit3, UserCheck, Radio, Stethoscope, Clock3, ShieldCheck } from 'lucide-react';
import VolunteerChat from '@/components/Volunteer/VolunteerChat';
import policies from '@/data/stadium-policies.json';
import { Task, Incident, IncidentStatus } from '@/lib/dataStore';

const STATUS_STYLES: Record<IncidentStatus, string> = {
  open: 'bg-slate-100 text-slate-700',
  assigned: 'bg-blue-100 text-blue-800',
  team_notified: 'bg-emerald-100 text-emerald-800',
  in_progress: 'bg-amber-100 text-amber-800',
  resolved: 'bg-slate-200 text-slate-700'
};

const STATUS_LABELS: Record<IncidentStatus, string> = {
  open: 'open',
  assigned: 'assigned',
  team_notified: 'team notified',
  in_progress: 'in progress',
  resolved: 'resolved'
};

const maskSensitiveText = (text: string) => (
  text.replace(/\b(\d{4})\d{3,9}(\d{2})\b/g, '$1****$2')
);

export default function VolunteerDashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/volunteer/tasks');
      const data = await res.json();
      setTasks(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchIncidents = async () => {
    try {
      const res = await fetch('/api/incidents');
      const data = await res.json();
      setIncidents(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchIncidents();

    // Listen for custom event from VolunteerChat to refresh incidents
    const handleRefresh = () => fetchIncidents();
    window.addEventListener('refresh-incidents', handleRefresh);
    
    // Poll incidents every 10 seconds just in case
    const interval = setInterval(() => {
      fetchTasks();
      fetchIncidents();
    }, 10000);

    return () => {
      window.removeEventListener('refresh-incidents', handleRefresh);
      clearInterval(interval);
    };
  }, []);

  const completeTask = async (id: string) => {
    try {
      await fetch(`/api/volunteer/tasks/${id}/complete`, { method: 'PATCH' });
      fetchTasks(); // Refresh
    } catch (e) {
      console.error(e);
    }
  };

  const updateIncident = async (id: string, patch: Record<string, unknown>) => {
    try {
      await fetch(`/api/incidents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      fetchIncidents();
    } catch (e) {
      console.error(e);
    }
  };

  const getMissingDetails = (incident: Incident) => {
    const resolvedDetails = Object.entries(incident.missingDetails ?? {})
      .filter(([, value]) => String(value).toLowerCase() !== 'missing')
      .map(([key]) => key.toLowerCase());
    const directMissing = Object.entries(incident.missingDetails ?? {})
      .filter(([, value]) => String(value).toLowerCase() === 'missing')
      .map(([key]) => key);

    const descriptionMissing = incident.description
      .split('|')
      .map(part => part.trim())
      .filter(part => part.toLowerCase().includes('missing'))
      .map(part => part.split('missing')[0].replace(/[:|-]/g, '').trim().toLowerCase())
      .filter(Boolean);

    return Array.from(new Set([...directMissing, ...descriptionMissing]))
      .filter(detail => !resolvedDetails.includes(detail.toLowerCase()));
  };

  const getIncidentStatus = (incident: Incident): IncidentStatus => {
    const rawStatus = incident.status as unknown;

    if (
      rawStatus === 'open' ||
      rawStatus === 'assigned' ||
      rawStatus === 'team_notified' ||
      rawStatus === 'in_progress' ||
      rawStatus === 'resolved'
    ) {
      return rawStatus;
    }

    if (rawStatus && typeof rawStatus === 'object' && 'status' in rawStatus) {
      const nestedStatus = (rawStatus as { status?: unknown }).status;
      if (
        nestedStatus === 'open' ||
        nestedStatus === 'assigned' ||
        nestedStatus === 'team_notified' ||
        nestedStatus === 'in_progress' ||
        nestedStatus === 'resolved'
      ) {
        return nestedStatus;
      }
    }

    return 'open';
  };

  const getNextTeamStatus = (incident: Incident): IncidentStatus => {
    const status = getIncidentStatus(incident);
    return status === 'open' || status === 'assigned' ? 'team_notified' : status;
  };

  const assignIncident = (incident: Incident) => {
    updateIncident(incident.id, {
      status: 'assigned',
      assignedTo: 'Sector 102 Volunteer',
      notes: 'Assigned to Sector 102 volunteer from Volunteer Hub.'
    });
  };

  const markSecurityNotified = (incident: Incident, label = 'Nearest usher/security guard notified from Volunteer Hub.') => {
    updateIncident(incident.id, {
      status: getNextTeamStatus(incident),
      securityNotified: true,
      teamNotified: true,
      notes: label
    });
  };

  const notifyMedicalTeam = (incident: Incident) => {
    updateIncident(incident.id, {
      status: getNextTeamStatus(incident),
      medicalTeamNotified: true,
      teamNotified: true,
      notes: 'First-aid or medical team notified from Volunteer Hub.'
    });
  };

  const dispatchFirstAid = (incident: Incident) => {
    updateIncident(incident.id, {
      status: 'in_progress',
      medicalTeamNotified: true,
      dispatchNotified: true,
      teamNotified: true,
      notes: 'First-aid dispatch started and route support requested.'
    });
  };

  const sendToGuestServices = (incident: Incident) => {
    updateIncident(incident.id, {
      status: getNextTeamStatus(incident),
      securityNotified: true,
      teamNotified: true,
      notes: 'Code Amber details sent to Guest Services Desk Section 112.'
    });
  };

  const updateLastSeenTime = (incident: Incident) => {
    const timeLastSeen = window.prompt('Enter time last seen, for example 01:22 AM');
    if (!timeLastSeen?.trim()) return;

    updateIncident(incident.id, {
      missingDetails: {
        'time last seen': timeLastSeen.trim()
      },
      notes: `Time last seen updated: ${timeLastSeen.trim()}`
    });
  };

  const addMedicalSymptoms = (incident: Incident) => {
    const symptoms = window.prompt('Add symptoms, consciousness, breathing, and exact location if known');
    if (!symptoms?.trim()) return;

    updateIncident(incident.id, {
      status: getIncidentStatus(incident) === 'open' ? 'assigned' : getIncidentStatus(incident),
      missingDetails: {
        symptoms: symptoms.trim()
      },
      notes: `Medical details updated: ${symptoms.trim()}`
    });
  };

  const resolveIncident = (incident: Incident) => {
    updateIncident(incident.id, {
      status: 'resolved',
      notes: 'Incident marked resolved from Volunteer Hub.'
    });
  };

  const openIncidents = incidents.filter(incident => getIncidentStatus(incident) !== 'resolved');

  const getTimeline = (incident: Incident) => {
    if (incident.timeline?.length) {
      return incident.timeline;
    }

    return [{
      label: 'Incident reported',
      status: 'open' as IncidentStatus,
      timestamp: incident.createdAt
    }];
  };

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
              {tasks.length === 0 ? (
                <p className="text-sm text-slate-500">No active tasks.</p>
              ) : (
                tasks.map(task => (
                  <li key={task.id} className={`p-4 rounded-xl border flex justify-between items-center transition-opacity ${task.isComplete ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <div>
                      <p className={`font-bold text-sm ${task.isComplete ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{task.title}</p>
                      <p className="text-xs text-slate-500">{task.description} • {task.timeframe}</p>
                    </div>
                    {task.isComplete ? (
                      <span className="text-emerald-500 font-bold text-sm flex items-center"><CheckSquare className="h-4 w-4 mr-1" /> Done</span>
                    ) : (
                      <button 
                        onClick={() => completeTask(task.id)}
                        className="px-4 py-2 bg-emerald-500 text-white text-sm font-semibold rounded-lg hover:bg-emerald-600 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
                      >
                        Complete
                      </button>
                    )}
                  </li>
                ))
              )}
            </ul>
          </section>

          {openIncidents.length > 0 && (
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in">
              <h2 className="text-xl font-bold mb-4 flex items-center text-slate-900">
                <AlertTriangle className="mr-2 h-5 w-5 text-red-500" /> Open Incidents
              </h2>
              <div className="grid gap-3">
                {openIncidents.map(inc => {
                  const missingDetails = getMissingDetails(inc);
                  const isLostChild = inc.type === 'lost_child';
                  const isMedical = inc.type === 'medical';
                  const incidentStatus = getIncidentStatus(inc);
                  const timeline = getTimeline(inc);
                  const protocolLabel = isLostChild ? 'Code Amber' : isMedical ? 'Code Red' : 'Ops Response';
                  const cardTone = isMedical
                    ? 'bg-red-50/70 border-red-200'
                    : isLostChild
                      ? 'bg-amber-50/60 border-amber-200'
                      : 'bg-slate-50 border-slate-200';

                  return (
                    <div key={inc.id} className={`p-4 border rounded-xl ${cardTone}`}>
                      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-bold text-red-700 text-sm capitalize">{inc.type.replace('_', ' ')}</span>
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-[10px] font-bold uppercase">{inc.severity}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_STYLES[incidentStatus]}`}>{STATUS_LABELS[incidentStatus]}</span>
                            <span className="px-2 py-0.5 bg-white text-slate-700 rounded text-[10px] font-bold uppercase border border-slate-200">{protocolLabel}</span>
                            {inc.securityNotified && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold uppercase">Security notified</span>
                            )}
                            {inc.medicalTeamNotified && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold uppercase">Medical notified</span>
                            )}
                            {inc.dispatchNotified && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold uppercase">Dispatch active</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 break-words">{maskSensitiveText(inc.description)}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
                            <span>ID: {inc.id}</span>
                            <span>Location: {inc.location}</span>
                            {inc.assignedTo && <span>Assigned: {inc.assignedTo}</span>}
                            <span>{new Date(inc.createdAt).toLocaleTimeString()}</span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {timeline.map((event, idx) => (
                              <div key={`${event.timestamp}-${idx}`} className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                <Clock3 className="mr-1 h-3 w-3 text-slate-400" />
                                <span>{event.label}</span>
                                <span className="ml-1 text-slate-400">{new Date(event.timestamp).toLocaleTimeString()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 md:min-w-[320px]">
                          <button
                            onClick={() => assignIncident(inc)}
                            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-center text-xs font-bold leading-tight text-blue-700 hover:bg-blue-100"
                          >
                            <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Assign to me
                          </button>
                          {isMedical ? (
                            <>
                              <button
                                onClick={() => notifyMedicalTeam(inc)}
                                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-bold leading-tight text-emerald-700 hover:bg-emerald-100"
                              >
                                <Stethoscope className="mr-1.5 h-3.5 w-3.5" /> Medical notified
                              </button>
                              <button
                                onClick={() => dispatchFirstAid(inc)}
                                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-center text-xs font-bold leading-tight text-red-700 hover:bg-red-50"
                              >
                                <Radio className="mr-1.5 h-3.5 w-3.5" /> Dispatch first aid
                              </button>
                              <button
                                onClick={() => addMedicalSymptoms(inc)}
                                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-bold leading-tight text-amber-700 hover:bg-amber-100"
                              >
                                <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Add symptoms
                              </button>
                            </>
                          ) : isLostChild ? (
                            <>
                              <button
                                onClick={() => markSecurityNotified(inc)}
                                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-bold leading-tight text-emerald-700 hover:bg-emerald-100"
                              >
                                <Bell className="mr-1.5 h-3.5 w-3.5" /> Security notified
                              </button>
                              <button
                                onClick={() => sendToGuestServices(inc)}
                                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-center text-xs font-bold leading-tight text-indigo-700 hover:bg-indigo-100"
                              >
                                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Guest Services
                              </button>
                              <button
                                onClick={() => updateLastSeenTime(inc)}
                                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-bold leading-tight text-amber-700 hover:bg-amber-100"
                              >
                                <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Update last seen
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => markSecurityNotified(inc, 'Response team notified from Volunteer Hub.')}
                              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-bold leading-tight text-emerald-700 hover:bg-emerald-100"
                            >
                              <Bell className="mr-1.5 h-3.5 w-3.5" /> Team notified
                            </button>
                          )}
                          <button
                            onClick={() => resolveIncident(inc)}
                            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-xs font-bold leading-tight text-slate-700 hover:bg-slate-100"
                          >
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Resolve
                          </button>
                        </div>
                      </div>

                      {isLostChild && (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Code Amber action checklist</p>
                          <ul className="mt-2 grid gap-1 text-xs text-amber-900 sm:grid-cols-2">
                            <li>Stay at last-seen location.</li>
                            <li>Notify nearest usher/security guard.</li>
                            <li>Send details to Guest Services Desk Section 112.</li>
                            <li>Do not publicly announce private contact details.</li>
                          </ul>
                          {missingDetails.length > 0 && (
                            <div className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-red-700">
                              <span className="font-bold">Missing: </span>
                              {missingDetails.join(', ')}
                            </div>
                          )}
                        </div>
                      )}

                      {isMedical && (
                        <div className="mt-3 rounded-xl border border-red-200 bg-white p-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-red-700">Code Red response checklist</p>
                          <ul className="mt-2 grid gap-1 text-xs text-red-900 sm:grid-cols-2">
                            <li>Call first-aid dispatch now.</li>
                            <li>Do not move the person unless unsafe.</li>
                            <li>Keep the surrounding crowd clear.</li>
                            <li>Guide medical staff to the exact location.</li>
                          </ul>
                          {inc.missingDetails?.symptoms && String(inc.missingDetails.symptoms).toLowerCase() !== 'missing' && (
                            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                              <span className="font-bold">Medical detail: </span>
                              {inc.missingDetails.symptoms}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-4 flex items-center text-slate-900">
              <ShieldAlert className="mr-2 h-5 w-5 text-amber-500" /> Emergency Checklist
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {policies.policies.map(policy => (
                <div key={policy.category} className="p-4 rounded-xl border border-slate-200 bg-amber-50/30 hover:bg-amber-50/60 transition-colors">
                  <h3 className="font-bold text-amber-700 text-sm mb-2">{policy.category} ({policy.protocol})</h3>
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
