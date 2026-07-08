'use client';
import { useState, useEffect } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import SmartRouteCard from './SmartRouteCard';
import { RouteScoreResult } from '@/lib/routingEngine';

type Message = {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  routeData?: RouteScoreResult;
};

export default function ChatInterface({ gateCSurgeActive }: { gateCSurgeActive: boolean }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: "Hi! I'm your FlowTwin Copilot. Where are you starting from, where are you heading, and do you need accessible routing?",
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [lastInput, setLastInput] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (hasSearched) {
      callChatApi(lastInput, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateCSurgeActive]);

  const callChatApi = async (messageText: string, isUpdate = false) => {
    setIsTyping(true);
    const needsAccess = messageText.toLowerCase().includes('accessible') || messageText.toLowerCase().includes('wheelchair');
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, gateCSurgeActive, needsAccess })
      });
      
      const data = await response.json();
      
      if (data.routeData) {
        const botMsg: Message = {
          id: Date.now().toString(),
          sender: 'bot',
          text: isUpdate ? `Update: Live conditions have changed.\n\n${data.routeData.explanation}` : data.routeData.explanation,
          routeData: data.routeData
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'bot',
        text: "I'm sorry, I'm having trouble connecting to my AI brain right now."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    
    const newMsg: Message = { id: Date.now().toString(), sender: 'user', text: input };
    setMessages(prev => [...prev, newMsg]);
    setLastInput(input);
    setHasSearched(true);
    const currentInput = input;
    setInput('');
    
    callChatApi(currentInput, false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-lg">
      <div className="bg-blue-600 p-4 text-center font-bold text-white shadow-sm">
        Assistance Chat
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[95%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center shadow-md border-2 border-white ${msg.sender === 'user' ? 'bg-slate-800 ml-3' : 'bg-blue-600 mr-3'}`}>
                {msg.sender === 'user' ? <User size={20} className="text-white" /> : <Bot size={20} className="text-white" />}
              </div>
              <div className="flex flex-col min-w-0">
                <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap break-words ${msg.sender === 'user' ? 'bg-slate-800 text-white rounded-tr-none' : 'bg-white text-slate-900 rounded-tl-none border border-slate-200'}`}>
                  {msg.text}
                </div>
                {msg.routeData && <SmartRouteCard routeData={msg.routeData} />}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
             <div className="flex flex-row max-w-[85%]">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-600 mr-3 flex items-center justify-center shadow-md border-2 border-white">
                <Bot size={20} className="text-white" />
              </div>
              <div className="p-4 rounded-2xl bg-white text-slate-900 rounded-tl-none border border-slate-200 flex items-center gap-3 shadow-sm">
                <Loader2 size={18} className="animate-spin text-blue-600" />
                <span className="text-sm font-medium text-slate-600">Analyzing live stadium conditions...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your destination or needs..."
            className="w-full bg-slate-100 border-2 border-slate-200 text-slate-900 rounded-full py-4 pl-6 pr-16 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors placeholder:text-slate-500 font-medium text-sm"
          />
          <button 
            onClick={handleSend}
            className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-full text-white transition-colors shadow-md"
          >
            <Send size={16} className="ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
