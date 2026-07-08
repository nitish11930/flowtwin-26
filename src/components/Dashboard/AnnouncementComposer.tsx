'use client';
import { useState } from 'react';
import { Megaphone, Send, Loader2 } from 'lucide-react';

export default function AnnouncementComposer() {
  const [input, setInput] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translations, setTranslations] = useState<any>(null);

  const handleTranslate = async () => {
    if (!input.trim()) return;
    setIsTranslating(true);
    try {
      const response = await fetch('/api/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffInput: input })
      });
      const data = await response.json();
      setTranslations(data.translations);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
      <h3 className="text-lg font-bold mb-4 flex items-center text-slate-200">
        <Megaphone className="mr-2 h-5 w-5 text-blue-400" /> Announcement Composer
      </h3>
      
      <div className="space-y-4">
        <div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type announcement (e.g. 'Train delayed by 15 mins. Use north gates.')"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 min-h-[100px] resize-none"
          ></textarea>
        </div>
        
        <button 
          onClick={handleTranslate}
          disabled={isTranslating || !input.trim()}
          className="w-full flex items-center justify-center p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold transition-colors"
        >
          {isTranslating ? <Loader2 className="animate-spin h-5 w-5" /> : <><Send className="mr-2 h-5 w-5" /> Broadcast & Translate</>}
        </button>

        {translations && !isTranslating && (
          <div className="mt-4 p-4 bg-slate-900 rounded-xl border border-slate-700 space-y-3">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Live Translations</h4>
            {Object.entries(translations).map(([lang, text]) => (
              <div key={lang} className="text-sm">
                <span className="text-blue-400 capitalize font-semibold">{lang}:</span> <span className="text-slate-300">{text as string}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
