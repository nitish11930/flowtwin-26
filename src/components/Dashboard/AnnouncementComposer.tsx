'use client';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Megaphone, Send } from 'lucide-react';
import { useSharedState } from '@/lib/store';

export default function AnnouncementComposer() {
  const { state, setSharedState } = useSharedState();
  const [input, setInput] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translations, setTranslations] = useState<any>(null);
  const [lastSource, setLastSource] = useState<string | null>(null);
  const lastAutoAnnouncement = useRef<number | undefined>(undefined);

  const translateAnnouncement = async (announcementText: string, source?: string, shouldPublish = false) => {
    if (!announcementText.trim()) return;
    setIsTranslating(true);
    setLastSource(source || 'Manual announcement');

    try {
      const response = await fetch('/api/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffInput: announcementText })
      });
      const data = await response.json();
      setTranslations(data.translations);
      if (shouldPublish) {
        setSharedState({
          announcementDraft: announcementText,
          announcementSource: source || 'Manual announcement',
          announcementUpdatedAt: Date.now()
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  };

  useEffect(() => {
    if (!state.announcementDraft || !state.announcementUpdatedAt) return;
    if (lastAutoAnnouncement.current === state.announcementUpdatedAt) return;

    lastAutoAnnouncement.current = state.announcementUpdatedAt;
    setInput(state.announcementDraft);
    translateAnnouncement(state.announcementDraft, state.announcementSource, false);
  }, [state.announcementDraft, state.announcementSource, state.announcementUpdatedAt]);

  const handleTranslate = () => translateAnnouncement(input, 'Manual announcement', true);

  return (
    <section className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg" aria-labelledby="announcement-composer-heading">
      <h3 id="announcement-composer-heading" className="text-lg font-bold mb-4 flex items-center text-slate-200">
        <Megaphone className="mr-2 h-5 w-5 text-blue-400" aria-hidden="true" /> Announcement Composer
      </h3>

      <div className="space-y-4">
        {lastSource && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100" role="status" aria-live="polite">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
            <span>Announcement prepared from {lastSource}.</span>
          </div>
        )}

        <div>
          <label htmlFor="announcement-input" className="sr-only">Announcement text</label>
          <textarea
            id="announcement-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type announcement, or click Announce on a live metric card."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 min-h-[112px] resize-none"
          />
        </div>

        <button
          type="button"
          onClick={handleTranslate}
          disabled={isTranslating || !input.trim()}
          className="w-full flex items-center justify-center p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          {isTranslating ? <Loader2 className="animate-spin h-5 w-5" aria-hidden="true" /> : <><Send className="mr-2 h-5 w-5" aria-hidden="true" /> Broadcast & Translate</>}
        </button>

        {translations && !isTranslating && (
          <div className="mt-4 p-4 bg-slate-900 rounded-xl border border-slate-700 space-y-3" aria-live="polite">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Live Translations</h4>
            {Object.entries(translations).map(([lang, text]) => (
              <div key={lang} className="text-sm leading-relaxed">
                <span className="text-blue-400 capitalize font-semibold">{lang}:</span> <span className="text-slate-300">{text as string}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
