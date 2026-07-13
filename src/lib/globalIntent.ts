import { GoogleGenAI } from '@google/genai';

export type GlobalIntent = 'CONVERSATIONAL' | 'ACTIONABLE';
export type PersonaMode = 'fan' | 'volunteer' | 'ops';

export type ChatPayload = {
  text: string;
  widgetData?: any;
};

type HistoryMessage = {
  sender?: string;
  role?: string;
  text?: string;
  content?: string;
};

const CONVERSATIONAL_PATTERNS = [
  /^(hi|hello|hey|yo|namaste|hola|bonjour)$/i,
  /^(hi|hello|hey|yo|namaste|hola|bonjour)[!. ]*$/i,
  /^(how are you|how r u|who are you|what are you|what can you do|help)$/i,
  /^(thanks|thank you|thank u|great|ok|okay|cool|nice|awesome|perfect|got it|good|done)$/i
];

const ACTIONABLE_PATTERNS = [
  /\b(lost|missing|child|kid|son|daughter|medical|hurt|injured|fainted|unconscious|chest pain|breath|breathing)\b/i,
  /\b(route|way|directions?|exit|gate|section|seat|bathroom|restroom|food|water|drink|accessible|wheelchair)\b/i,
  /\b(crowd|surge|congestion|dispatch|incident|policy|protocol|announce|translate|staff|security|ops)\b/i
];

export function deterministicIntent(message: string): GlobalIntent {
  const normalized = message.trim().replace(/\s+/g, ' ');
  if (!normalized) return 'CONVERSATIONAL';
  if (ACTIONABLE_PATTERNS.some(pattern => pattern.test(normalized))) return 'ACTIONABLE';
  if (CONVERSATIONAL_PATTERNS.some(pattern => pattern.test(normalized))) return 'CONVERSATIONAL';
  if (normalized.split(' ').length <= 3 && /^[a-z0-9'’!?. ]+$/i.test(normalized)) return 'CONVERSATIONAL';
  return 'ACTIONABLE';
}

export async function classifyUniversalIntent(message: string, persona: PersonaMode): Promise<GlobalIntent> {
  const fallback = deterministicIntent(message);
  if (!process.env.GEMINI_API_KEY) return fallback;

  try {
    const ai = new GoogleGenAI({});
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        'Classify the latest stadium assistant user message into exactly one bucket.',
        'Return only CONVERSATIONAL or ACTIONABLE.',
        'CONVERSATIONAL examples: hi, how are you, who are you, thanks, great, ok.',
        'ACTIONABLE examples: I need an exit, lost child protocol, dispatch staff to Gate C, wheelchair route.',
        `Persona: ${persona}`,
        `Message: ${message}`
      ].join('\n'),
      config: {
        temperature: 0,
        maxOutputTokens: 8
      }
    });

    const text = (response.text || '').trim().toUpperCase();
    return text.includes('CONVERSATIONAL') ? 'CONVERSATIONAL' : text.includes('ACTIONABLE') ? 'ACTIONABLE' : fallback;
  } catch {
    return fallback;
  }
}

export async function buildConversationalResponse(
  persona: PersonaMode,
  message: string,
  history: HistoryMessage[] = []
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) return fallbackConversationalResponse(persona, message);

  try {
    const ai = new GoogleGenAI({});
    const recentHistory = history
      .slice(-8)
      .map(item => `${getSpeaker(item)}: ${item.text || item.content || ''}`)
      .join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        getPersonaPrompt(persona),
        'This is a conversational turn. Do not run routing, RAG, incident creation, policy lookup, or operational recommendation logic.',
        'Reply naturally in 1-2 short sentences. Do not return JSON inside the text.',
        recentHistory ? `Recent chat:\n${recentHistory}` : '',
        `Latest message: ${message}`
      ].filter(Boolean).join('\n\n'),
      config: {
        temperature: 0.5,
        maxOutputTokens: 120
      }
    });

    return (response.text || '').trim() || fallbackConversationalResponse(persona, message);
  } catch {
    return fallbackConversationalResponse(persona, message);
  }
}

export function toChatPayload(text: string, widgetData?: any): ChatPayload {
  return widgetData === undefined || widgetData === null
    ? { text }
    : { text, widgetData };
}

function getSpeaker(message: HistoryMessage) {
  return message.sender === 'bot' || message.role === 'assistant' || message.role === 'model' ? 'Assistant' : 'User';
}

function getPersonaPrompt(persona: PersonaMode) {
  switch (persona) {
    case 'fan':
      return 'You are FlowTwin Fan Copilot: friendly, calm, public-facing, and helpful for stadium visitors.';
    case 'volunteer':
      return 'You are FlowTwin Volunteer Policy Assistant: professional, concise, and supportive for stadium volunteers.';
    case 'ops':
      return 'You are FlowTwin Ops Intelligence: calm, executive-ready, and helpful for stadium operations leaders.';
  }
}

function fallbackConversationalResponse(persona: PersonaMode, message: string) {
  const normalized = message.trim().toLowerCase();
  const thanks = /^(thanks|thank you|thank u|great|ok|okay|cool|nice|awesome|perfect|got it|good|done)[!. ]*$/.test(normalized);

  if (persona === 'fan') {
    return thanks
      ? "You're welcome. I'm here if you need routes, food, accessibility help, or stadium support."
      : "Hi, I'm FlowTwin Fan Copilot. I can help with routes, accessibility, food, restrooms, crowd-safe movement, and urgent stadium help.";
  }

  if (persona === 'volunteer') {
    return thanks
      ? "You're welcome. Ask me anytime for lost child, medical, accessibility, crowd, direction, or translation support."
      : "Hi, I'm the Volunteer Policy Assistant. I can help you handle lost child, medical, accessibility, crowd, directions, and translation questions.";
  }

  return thanks
    ? "Understood. I'm ready whenever you need the next operational summary or decision recommendation."
    : "Hi, I'm FlowTwin Ops Intelligence. I can summarize live risks, prioritize incidents, and suggest stadium operations actions.";
}
