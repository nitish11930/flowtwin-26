'use client';
import { useMemo, useState } from 'react';
import { Database, Plus, Trash2 } from 'lucide-react';
import { useSharedState } from '@/lib/store';
import type { StadiumKnowledgeCategory, StadiumKnowledgeEntry } from '@/lib/store';

const CATEGORY_OPTIONS: Array<{ value: StadiumKnowledgeCategory; label: string }> = [
  { value: 'transport', label: 'Transport' },
  { value: 'accessibility', label: 'Accessibility' },
  { value: 'security', label: 'Security' },
  { value: 'policy', label: 'Policy' },
  { value: 'amenity', label: 'Amenity' },
  { value: 'operations', label: 'Operations' },
  { value: 'sustainability', label: 'Sustainability' }
];

const EXAMPLES = [
  {
    category: 'transport' as StadiumKnowledgeCategory,
    title: 'Metro delay',
    location: 'Metro Line 1',
    status: 'Delayed 15 min',
    detail: 'Metro Line 1 is delayed by 15 minutes. Fans should allow extra travel time and use shuttle or rideshare backup if they are in a hurry.'
  },
  {
    category: 'accessibility' as StadiumKnowledgeCategory,
    title: 'Accessible shuttle gate',
    location: 'Gate C',
    status: 'Active',
    detail: 'Accessible shuttle pickup is currently at Gate C. Use step-free access lanes and ask mobility volunteers for shuttle boarding help.'
  },
  {
    category: 'security' as StadiumKnowledgeCategory,
    title: 'Bag check policy',
    location: 'All gates',
    status: 'Active',
    detail: 'Large backpacks are not allowed through entry gates. Direct fans to bag-check support before they enter the queue.'
  }
];

const emptyForm = {
  category: 'transport' as StadiumKnowledgeCategory,
  title: '',
  location: '',
  status: '',
  detail: ''
};

export default function StadiumKnowledgeStore() {
  const { state, setSharedState } = useSharedState();
  const [form, setForm] = useState(emptyForm);

  const sortedEntries = useMemo(() => (
    [...state.stadiumKnowledge].sort((a, b) => b.updatedAt - a.updatedAt)
  ), [state.stadiumKnowledge]);

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const saveEntry = () => {
    if (!form.title.trim() || !form.detail.trim()) return;

    const entry: StadiumKnowledgeEntry = {
      id: `knowledge-${Date.now()}`,
      category: form.category,
      title: form.title.trim(),
      detail: form.detail.trim(),
      location: form.location.trim() || undefined,
      status: form.status.trim() || undefined,
      updatedAt: Date.now()
    };

    setSharedState({ stadiumKnowledge: [entry, ...state.stadiumKnowledge].slice(0, 30) });
    setForm(emptyForm);
  };

  const removeEntry = (entryId: string) => {
    setSharedState({ stadiumKnowledge: state.stadiumKnowledge.filter(entry => entry.id !== entryId) });
  };

  const loadExample = (example: typeof EXAMPLES[number]) => {
    setForm(example);
  };

  return (
    <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg" aria-labelledby="knowledge-store-heading">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 id="knowledge-store-heading" className="text-lg font-bold flex items-center text-slate-200">
            <Database className="mr-2 h-5 w-5 text-emerald-400" aria-hidden="true" /> Stadium Knowledge Store
          </h3>
          <p className="mt-1 text-sm text-slate-400">Add live facts, policies, access notes, and security guidance. Fan, Volunteer, and Ops assistants will use these entries as live context.</p>
        </div>
        <div className="text-xs font-semibold text-emerald-200 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 w-fit">
          {state.stadiumKnowledge.length} active entries
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div>
          <label htmlFor="knowledge-category" className="text-xs font-bold uppercase tracking-wide text-slate-400">Category</label>
          <select
            id="knowledge-category"
            value={form.category}
            onChange={(event) => updateForm('category', event.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
          >
            {CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="knowledge-title" className="text-xs font-bold uppercase tracking-wide text-slate-400">Title</label>
          <input
            id="knowledge-title"
            value={form.title}
            onChange={(event) => updateForm('title', event.target.value)}
            placeholder="Train delay, Gate rule, etc."
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>
        <div>
          <label htmlFor="knowledge-location" className="text-xs font-bold uppercase tracking-wide text-slate-400">Location</label>
          <input
            id="knowledge-location"
            value={form.location}
            onChange={(event) => updateForm('location', event.target.value)}
            placeholder="Gate C, Metro Line 1"
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>
        <div>
          <label htmlFor="knowledge-status" className="text-xs font-bold uppercase tracking-wide text-slate-400">Status</label>
          <input
            id="knowledge-status"
            value={form.status}
            onChange={(event) => updateForm('status', event.target.value)}
            placeholder="Active, delayed 15m"
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>
      </div>

      <div className="mt-3">
        <label htmlFor="knowledge-detail" className="text-xs font-bold uppercase tracking-wide text-slate-400">Information</label>
        <textarea
          id="knowledge-detail"
          value={form.detail}
          onChange={(event) => updateForm('detail', event.target.value)}
          placeholder="Describe the rule, update, policy, contact point, or fan instruction."
          className="mt-1 min-h-[104px] w-full resize-none rounded-xl border border-slate-700 bg-slate-900 p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-300"
        />
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map(example => (
            <button
              key={example.title}
              type="button"
              onClick={() => loadExample(example)}
              className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              Use {example.title}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={saveEntry}
          disabled={!form.title.trim() || !form.detail.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Save Knowledge
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {sortedEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-600 p-4 text-sm text-slate-400">No live knowledge entries yet. Add train delays, accessible gates, policies, or security notes here.</div>
        ) : sortedEntries.map(entry => (
          <article key={entry.id} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-bold uppercase tracking-wide text-emerald-300">{entry.category}</span>
                  {entry.status && <span className="rounded-full bg-blue-500/10 px-2 py-1 text-xs font-bold text-blue-200">{entry.status}</span>}
                  {entry.location && <span className="text-xs font-semibold text-slate-400">{entry.location}</span>}
                </div>
                <h4 className="mt-2 font-bold text-white">{entry.title}</h4>
                <p className="mt-1 text-sm leading-relaxed text-slate-300">{entry.detail}</p>
              </div>
              <button
                type="button"
                onClick={() => removeEntry(entry.id)}
                aria-label={`Delete ${entry.title}`}
                className="inline-flex w-fit items-center gap-2 rounded-lg border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-red-300"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
