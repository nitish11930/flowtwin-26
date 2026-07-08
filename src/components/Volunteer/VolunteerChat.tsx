'use client';
import { useState } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';

type Message = {
  id: string;
  sender: 'user' | 'bot';
  text: string;
};

export default function VolunteerChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: "Hi! I'm the Volunteer Policy Assistant. Ask me any protocol questions (e.g. Lost Child, Medical).",
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userText = input;
    const newMsg: Message = { id: Date.now().toString(), sender: 'user', text: userText };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/volunteer-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userText })
      });
      const data = await response.json();
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'bot',
        text: data.answer || "Sorry, I couldn't find an answer to that."
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'bot',
        text: "Error reaching the policy database."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <section aria-label="Volunteer Policy Chat" className="flex flex-col h-[500px] bg-white rounded-2xl border-2 border-slate-200 overflow-hidden shadow-lg">
      <header className="bg-amber-500 p-4 font-bold text-white shadow-sm flex items-center">
        <Bot className="mr-2 h-5 w-5" /> Policy Assistant
      </header>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50" aria-live="polite">
        {messages.map(msg => (
          <article key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[90%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center shadow-sm border-2 border-white ${msg.sender === 'user' ? 'bg-slate-800 ml-2' : 'bg-amber-500 mr-2'}`}>
                {msg.sender === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
              </div>
              <div className={`p-3 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap break-words ${msg.sender === 'user' ? 'bg-slate-800 text-white rounded-tr-none' : 'bg-white text-slate-900 rounded-tl-none border border-slate-200'}`}>
                {msg.text}
              </div>
            </div>
          </article>
        ))}
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
      </div>

      <footer className="p-3 bg-white border-t border-slate-200">
        <div className="relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about stadium policies..."
            aria-label="Message input"
            className="w-full bg-slate-100 border-2 border-slate-200 text-slate-900 rounded-full py-3 pl-4 pr-12 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors placeholder:text-slate-600 font-medium text-sm"
          />
          <button 
            onClick={handleSend}
            aria-label="Send message"
            className="absolute right-2 top-1.5 bottom-1.5 aspect-square flex items-center justify-center bg-amber-500 hover:bg-amber-600 rounded-full text-white transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1"
          >
            <Send size={14} aria-hidden="true" />
          </button>
        </div>
      </footer>
    </section>
  );
}
