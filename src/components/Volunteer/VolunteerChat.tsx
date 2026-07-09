'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, AlertCircle, Phone, CheckSquare } from 'lucide-react';

type Message = {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  isError?: boolean;
  checklist?: string[];
  recommendedContact?: string;
  createIncidentSuggested?: boolean;
  intent?: string;
  severity?: string;
  requiredDetails?: string[];
};

const QUICK_ACTIONS = ['Lost Child', 'Medical', 'Accessibility', 'Crowd', 'Directions', 'Translate'];
const VOLUNTEER_CHAT_STORAGE_KEY = 'flowtwin-volunteer-chat-history';
const VOLUNTEER_INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    sender: 'bot',
    text: "Hi! I'm the Volunteer Policy Assistant. Ask me any protocol questions (e.g. Lost Child, Medical).",
  }
];

function loadStoredMessages() {
  if (typeof window === 'undefined') return VOLUNTEER_INITIAL_MESSAGES;

  try {
    const stored = window.localStorage.getItem(VOLUNTEER_CHAT_STORAGE_KEY);
    if (!stored) return VOLUNTEER_INITIAL_MESSAGES;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : VOLUNTEER_INITIAL_MESSAGES;
  } catch {
    return VOLUNTEER_INITIAL_MESSAGES;
  }
}

export default function VolunteerChat() {
  const [messages, setMessages] = useState<Message[]>(loadStoredMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [incidentNotice, setIncidentNotice] = useState<{ id: string; deduped?: boolean } | null>(null);
  
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    window.localStorage.setItem(VOLUNTEER_CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const handleSend = async (overrideText?: string) => {
    const userText = overrideText || input;
    if (!userText.trim()) return;
    
    const newMsg: Message = { id: Date.now().toString(), sender: 'user', text: userText };
    const nextMessages = [...messages, newMsg];
    setMessages(nextMessages);
    setInput('');
    setIsTyping(true);
    setIncidentNotice(null);

    try {
      const response = await fetch('/api/volunteer/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          messages: nextMessages,
          volunteerId: 'vol-123',
          sector: 'Sector 102',
          language: 'en'
        })
      });
      const data = await response.json();
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'bot',
        text: data.answer || "Sorry, I couldn't find an answer to that.",
        checklist: data.checklist,
        recommendedContact: data.recommendedContact,
        createIncidentSuggested: data.createIncidentSuggested,
        intent: data.intent,
        severity: data.severity,
        requiredDetails: data.requiredDetails
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'bot',
        text: "Error reaching the policy database.",
        isError: true
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleCreateIncident = async (msg: Message) => {
    const missingDetails = Object.fromEntries((msg.requiredDetails ?? []).map(detail => [detail, 'missing']));
    const isMedical = msg.intent === 'medical';
    const isLostChild = msg.intent === 'lost_child';
    const description = isMedical
      ? 'Medical emergency reported via Policy Assistant | Exact location missing | Symptoms missing | Consciousness status missing | Breathing status missing'
      : isLostChild
        ? 'Lost child reported via Policy Assistant | Child details pending secure intake'
        : `Auto-created incident for: ${msg.intent}`;

    try {
      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: msg.intent || 'security',
          sector: 'Sector 102',
          location: 'Reported via Chat',
          description,
          severity: msg.severity || 'low',
          missingDetails
        })
      });
      const data = await response.json();
      if (data.id) {
        setIncidentNotice({ id: data.id, deduped: Boolean(data.deduped) });
        // Dispatch an event to tell the page to refresh incidents
        window.dispatchEvent(new Event('refresh-incidents'));
      }
    } catch (error) {
      console.error('Failed to create incident', error);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <section aria-label="Volunteer Policy Chat" className="flex flex-col h-[700px] bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-lg">
      <header className="bg-amber-500 p-4 font-bold text-white shadow-sm flex items-center justify-between">
        <div className="flex items-center">
          <Bot className="mr-2 h-5 w-5" /> Policy Assistant
        </div>
      </header>
      
      {/* Quick Actions */}
      <div className="bg-slate-50 border-b border-slate-200 p-3 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
        {QUICK_ACTIONS.map(action => (
          <button 
            key={action}
            onClick={() => handleSend(action)}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-full text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:border-amber-400 hover:text-amber-700 transition-colors"
          >
            {action}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50" aria-live="polite">
        {messages.map(msg => (
          <article key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`flex max-w-[95%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center shadow-sm border-2 border-white ${msg.sender === 'user' ? 'bg-slate-800 ml-2' : 'bg-amber-500 mr-2'}`}>
                {msg.sender === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
              </div>
              <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap break-words ${msg.sender === 'user' ? 'bg-slate-800 text-white rounded-tr-none' : msg.isError ? 'bg-red-50 text-red-700 border-red-200 rounded-tl-none border' : 'bg-white text-slate-900 rounded-tl-none border border-slate-200'}`}>
                <div className="font-medium">{msg.text}</div>
                
                {msg.checklist && msg.checklist.length > 0 && (
                  <div className="mt-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <p className="font-bold text-xs text-slate-500 mb-2 uppercase tracking-wider">Required Steps</p>
                    <ul className="space-y-1">
                      {msg.checklist.map((step, idx) => (
                        <li key={idx} className="flex items-start text-xs text-slate-700">
                          <CheckSquare className="h-3 w-3 mr-1.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {msg.recommendedContact && (
                  <div className="mt-3 flex items-center text-xs font-bold text-blue-700 bg-blue-50 p-2 rounded-lg border border-blue-100">
                    <Phone className="h-3.5 w-3.5 mr-1.5" /> Contact: {msg.recommendedContact}
                  </div>
                )}
              </div>
            </div>
            
            {msg.sender === 'bot' && msg.createIncidentSuggested && (
              <div className="ml-10 mt-2">
                <button 
                  onClick={() => handleCreateIncident(msg)}
                  className="flex items-center text-xs font-bold bg-red-100 hover:bg-red-200 text-red-700 px-3 py-2 rounded-lg border border-red-200 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <AlertCircle className="h-3.5 w-3.5 mr-1.5" /> Create {msg.intent?.replace('_', ' ')} Incident
                </button>
              </div>
            )}
          </article>
        ))}
        
        {incidentNotice && (
          <div className="ml-10 flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200 animate-in fade-in slide-in-from-bottom-2">
            Incident {incidentNotice.id} successfully {incidentNotice.deduped ? 'updated' : 'created'} and escalated to Ops.
          </div>
        )}

        {isTyping && (
           <div className="flex justify-start">
             <div className="flex flex-row max-w-[85%]">
               <div className="flex-shrink-0 h-8 w-8 rounded-full bg-amber-500 mr-2 flex items-center justify-center shadow-sm border-2 border-white">
                 <Bot size={16} className="text-white" />
               </div>
               <div className="p-3 rounded-2xl bg-white text-slate-900 rounded-tl-none border border-slate-200 flex items-center gap-2 shadow-sm">
                 <Loader2 size={16} className="animate-spin text-amber-500" />
                 <span className="text-xs font-medium text-slate-500">Searching policies...</span>
               </div>
             </div>
           </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      <footer className="p-3 bg-white border-t border-slate-200">
        <div className="relative">
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about stadium policies... (Shift+Enter for new line)"
            aria-label="Message input"
            rows={1}
            className="w-full bg-slate-100 border-2 border-slate-200 text-slate-900 rounded-2xl py-3 pl-4 pr-12 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors placeholder:text-slate-500 font-medium text-sm resize-none overflow-y-auto max-h-[120px]"
          />
          <button 
            onClick={() => handleSend()}
            aria-label="Send message"
            className="absolute right-3 bottom-3 aspect-square flex items-center justify-center bg-amber-500 hover:bg-amber-600 rounded-full h-8 w-8 text-white transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
          >
            <Send size={14} aria-hidden="true" className="ml-0.5" />
          </button>
        </div>
      </footer>
    </section>
  );
}
