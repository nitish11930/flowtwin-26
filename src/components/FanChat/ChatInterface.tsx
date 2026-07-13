'use client';
import { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import SmartRouteCard from './SmartRouteCard';
import AmenityCard from './AmenityCard';
import { RouteScoreResult } from '@/lib/routingEngine';
import type { AmenityRecommendation } from '@/lib/amenityEngine';

type IncidentDraft = {
  type: string;
  sector: string;
  location: string;
  description: string;
  severity: string;
  missingDetails?: Record<string, string>;
};

type Message = {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  routeData?: RouteScoreResult;
  amenityData?: AmenityRecommendation;
  intent?: string;
  actions?: string[];
  capturedDetails?: Record<string, string>;
  requiredDetails?: string[];
  createIncidentSuggested?: boolean;
  incidentDraft?: IncidentDraft;
  incidentId?: string;
  orderId?: string;
};

type LiveOpsAnnouncement = {
  text: string;
  source?: string;
  updatedAt?: number;
};

function getIncidentButtonLabel(intent?: string) {
  if (intent === 'medical') return 'Get medical help';
  if (intent === 'lost_child') return 'Alert stadium help';
  return 'Alert staff';
}

function buildFallbackIncidentDraft(message: Message): IncidentDraft {
  const missingDetails = Object.fromEntries((message.requiredDetails ?? []).map(detail => [detail, 'missing']));

  if (message.intent === 'medical') {
    return {
      type: 'medical',
      sector: 'Fan Copilot',
      location: 'Unknown medical location',
      description: 'Medical emergency reported via Fan Copilot | Exact location missing | Symptoms missing | Consciousness status missing | Breathing status missing',
      severity: 'red',
      missingDetails
    };
  }

  if (message.intent === 'lost_child') {
    return {
      type: 'lost_child',
      sector: 'Fan Copilot',
      location: 'Unknown last-seen location',
      description: 'Lost child reported via Fan Copilot | Child details pending secure intake',
      severity: 'amber',
      missingDetails
    };
  }

  return {
    type: message.intent || 'security',
    sector: 'Fan Copilot',
    location: 'Reported via Fan Copilot',
    description: `Incident reported via Fan Copilot: ${message.intent || 'security'}`,
    severity: 'high',
    missingDetails
  };
}

const FAN_CHAT_STORAGE_KEY = 'flowtwin-fan-chat-history';
const CHAT_HISTORY_TTL_MS = 30 * 60 * 1000;
const FAN_INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    sender: 'bot',
    text: "Hi! I'm your FlowTwin Copilot. Where are you starting from, where are you heading, and do you need accessible routing?",
  }
];

function loadStoredMessages() {
  if (typeof window === 'undefined') return FAN_INITIAL_MESSAGES;

  try {
    const stored = window.localStorage.getItem(FAN_CHAT_STORAGE_KEY);
    if (!stored) return FAN_INITIAL_MESSAGES;
    const parsed = JSON.parse(stored);
    const savedAt = typeof parsed?.savedAt === 'number' ? parsed.savedAt : null;
    const storedMessages = Array.isArray(parsed?.messages)
      ? parsed.messages
      : Array.isArray(parsed)
        ? parsed
        : null;

    if (!storedMessages || storedMessages.length === 0) return FAN_INITIAL_MESSAGES;
    if (!savedAt || Date.now() - savedAt > CHAT_HISTORY_TTL_MS) {
      window.localStorage.removeItem(FAN_CHAT_STORAGE_KEY);
      return FAN_INITIAL_MESSAGES;
    }

    return storedMessages;
  } catch {
    window.localStorage.removeItem(FAN_CHAT_STORAGE_KEY);
    return FAN_INITIAL_MESSAGES;
  }
}

function persistStoredMessages(messages: Message[]) {
  window.localStorage.setItem(FAN_CHAT_STORAGE_KEY, JSON.stringify({
    savedAt: Date.now(),
    messages
  }));
}

export default function ChatInterface({ gateCSurgeActive, liveOpsAnnouncement }: { gateCSurgeActive: boolean; liveOpsAnnouncement?: LiveOpsAnnouncement }) {
  const [messages, setMessages] = useState<Message[]>(loadStoredMessages);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [orderingMessageId, setOrderingMessageId] = useState<string | null>(null);
  const [lastInput, setLastInput] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const lastOpsUpdateRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    persistStoredMessages(messages);
  }, [messages]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      try {
        const stored = window.localStorage.getItem(FAN_CHAT_STORAGE_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored);
        const savedAt = typeof parsed?.savedAt === 'number' ? parsed.savedAt : null;
        if (!savedAt || Date.now() - savedAt > CHAT_HISTORY_TTL_MS) {
          window.localStorage.removeItem(FAN_CHAT_STORAGE_KEY);
          setMessages(FAN_INITIAL_MESSAGES);
          setLastInput('');
          setHasSearched(false);
        }
      } catch {
        window.localStorage.removeItem(FAN_CHAT_STORAGE_KEY);
        setMessages(FAN_INITIAL_MESSAGES);
        setLastInput('');
        setHasSearched(false);
      }
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (hasSearched) {
      callChatApi(lastInput, true, messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateCSurgeActive]);

  useEffect(() => {
    if (!liveOpsAnnouncement?.text || !liveOpsAnnouncement.updatedAt) return;
    if (lastOpsUpdateRef.current === liveOpsAnnouncement.updatedAt) return;

    lastOpsUpdateRef.current = liveOpsAnnouncement.updatedAt;
    setMessages(prev => [
      ...prev,
      {
        id: `ops-${liveOpsAnnouncement.updatedAt}`,
        sender: 'bot',
        text: `Live stadium update${liveOpsAnnouncement.source ? ` from ${liveOpsAnnouncement.source}` : ''}: ${liveOpsAnnouncement.text}`,
        intent: 'live_ops_update'
      }
    ]);
  }, [liveOpsAnnouncement?.text, liveOpsAnnouncement?.source, liveOpsAnnouncement?.updatedAt]);

  const callChatApi = async (messageText: string, isUpdate = false, chatHistory: Message[] = messages) => {
    setIsTyping(true);
    
    try {
      // Step 1: Check intent via Fan Assistant
      const aiResponse = await fetch('/api/fan-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage: messageText, messages: chatHistory, gateCSurgeActive, liveOpsAnnouncement })
      });
      const aiData = await aiResponse.json();
      const widgetData = aiData.widgetData;
      const routeData = widgetData?.routeData;
      const botText = aiData.text || widgetData?.answer || "I'm here to help.";

      const botMsg: Message = {
        id: Date.now().toString(),
        sender: 'bot',
        text: isUpdate ? `Update: Live conditions have changed.\n\n${botText}` : botText,
        intent: widgetData?.intent,
        routeData,
        amenityData: widgetData?.amenityData,
        actions: widgetData?.actions,
        capturedDetails: widgetData?.capturedDetails,
        requiredDetails: widgetData?.requiredDetails,
        createIncidentSuggested: widgetData?.createIncidentSuggested,
        incidentDraft: widgetData?.incidentDraft
      };
      setMessages(prev => [...prev, botMsg]);
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

  const handleReservePickup = async (messageId: string) => {
    const targetMessage = messages.find(msg => msg.id === messageId);
    const amenity = targetMessage?.amenityData?.amenity;
    if (!amenity) return;

    setOrderingMessageId(messageId);
    try {
      const response = await fetch('/api/food-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amenityId: amenity.id,
          amenityName: amenity.name,
          pickupLocation: amenity.location,
          items: amenity.items.slice(0, 2),
          pickupEtaMins: Math.max(8, amenity.queueTimeMins)
        })
      });

      if (!response.ok) {
        throw new Error('Could not reserve pickup');
      }

      const order = await response.json();
      setMessages(prev => prev.map(msg => (
        msg.id === messageId ? { ...msg, orderId: order.id } : msg
      )));
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'bot',
        text: 'I could not reserve pickup right now. You can still go to the stall using the route shown.'
      }]);
    } finally {
      setOrderingMessageId(null);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    
    const newMsg: Message = { id: Date.now().toString(), sender: 'user', text: input };
    const nextMessages = [...messages, newMsg];
    setMessages(nextMessages);
    setLastInput(input);
    setHasSearched(true);
    const currentInput = input;
    setInput('');
    
    callChatApi(currentInput, false, nextMessages);
  };

  const handleCreateIncident = async (messageId: string) => {
    const targetMessage = messages.find(msg => msg.id === messageId);
    if (!targetMessage) return;
    const incidentDraft = targetMessage.incidentDraft ?? buildFallbackIncidentDraft(targetMessage);

    try {
      const response = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incidentDraft)
      });

      if (!response.ok) {
        throw new Error('Could not create incident');
      }

      const incident = await response.json();
      setMessages(prev => prev.map(msg => (
        msg.id === messageId ? { ...msg, incidentId: incident.id } : msg
      )));
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'bot',
        text: 'I could not alert staff from here. Please notify the nearest usher or security guard now and share the details shown above.'
      }]);
    }
  };

  return (
    <section aria-label="Assistance Chat" className="flex flex-col h-[calc(100vh-140px)] bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-lg">
      <header className="bg-blue-600 p-4 text-center font-bold text-white shadow-sm">
        Assistance Chat
      </header>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50" aria-live="polite">
        {messages.map(msg => (
          <article key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[95%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center shadow-md border-2 border-white ${msg.sender === 'user' ? 'bg-slate-800 ml-3' : 'bg-blue-600 mr-3'}`}>
                {msg.sender === 'user' ? <User size={20} className="text-white" /> : <Bot size={20} className="text-white" />}
              </div>
              <div className="flex flex-col min-w-0">
                <div className={`p-4 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-wrap break-words ${msg.sender === 'user' ? 'bg-slate-800 text-white rounded-tr-none' : 'bg-white text-slate-900 rounded-tl-none border border-slate-200'}`}>
                  {msg.text}
                </div>
                {msg.capturedDetails && Object.keys(msg.capturedDetails).length > 0 && (
                  <div className="mt-2 text-xs bg-emerald-50 text-emerald-900 p-3 rounded-lg border border-emerald-200 shadow-sm">
                    <strong>Captured details:</strong>
                    <dl className="mt-2 grid gap-1">
                      {Object.entries(msg.capturedDetails)
                        .filter(([, value]) => Boolean(value))
                        .map(([key, value]) => (
                          <div key={key} className="grid grid-cols-[120px_1fr] gap-2">
                            <dt className="font-bold capitalize">{key.replace(/([A-Z])/g, ' $1')}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                    </dl>
                  </div>
                )}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-2 text-xs bg-blue-50 text-blue-900 p-3 rounded-lg border border-blue-200 shadow-sm">
                    <strong>Ready actions:</strong>
                    <ol className="list-decimal ml-5 mt-1 space-y-0.5">
                      {msg.actions.map((action, idx) => (
                        <li key={idx}>{action}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {msg.requiredDetails && msg.requiredDetails.length > 0 && (
                  <div className="mt-2 text-xs bg-red-50 text-red-800 p-3 rounded-lg border border-red-200 shadow-sm">
                    <strong>Missing details only:</strong>
                    <ul className="list-disc ml-5 mt-1 space-y-0.5">
                      {msg.requiredDetails.map((detail, idx) => (
                        <li key={idx} className="capitalize">{detail}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {msg.createIncidentSuggested && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-red-700">
                    {msg.incidentId ? (
                      <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
                        Help request sent to stadium staff.
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleCreateIncident(msg.id)}
                          className="rounded-lg bg-red-600 px-3 py-2 text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        >
                          {getIncidentButtonLabel(msg.intent)}
                        </button>
                        <span>Also notify staff immediately.</span>
                      </>
                    )}
                  </div>
                )}
                {msg.amenityData && (
                  <AmenityCard
                    amenityData={msg.amenityData}
                    orderId={msg.orderId}
                    isOrdering={orderingMessageId === msg.id}
                    onReserve={() => handleReservePickup(msg.id)}
                  />
                )}
                {msg.routeData && <SmartRouteCard routeData={msg.routeData} />}
              </div>
            </div>
          </article>
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

      <footer className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your destination or needs..."
            aria-label="Message input"
            className="w-full bg-slate-100 border-2 border-slate-200 text-slate-900 rounded-full py-4 pl-6 pr-16 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors placeholder:text-slate-600 font-medium text-sm"
          />
          <button 
            onClick={handleSend}
            aria-label="Send message"
            className="absolute right-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-blue-600 hover:bg-blue-700 rounded-full text-white transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Send size={16} className="ml-1" aria-hidden="true" />
          </button>
        </div>
      </footer>
    </section>
  );
}
