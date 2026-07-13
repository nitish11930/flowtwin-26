import { GoogleGenAI } from '@google/genai';
import policies from '../data/stadium-policies.json';
import liveCrowd from '../data/live-crowd-data.json';
import stadiumMap from '../data/stadium-map.json';
import { calculateBestRoute } from './routingEngine';
import { buildAmenityAnswer, findBestAmenity, parseAmenitySearchContext } from './amenityEngine';
import { buildRagContext } from './ragKnowledge';

type AIMode = 'fan_navigation' | 'volunteer_policy' | 'operations_command' | 'announcement' | 'incident_support';

type ChatHistoryMessage = {
  sender?: 'user' | 'bot';
  role?: 'user' | 'assistant' | 'model' | 'bot';
  text?: string;
  content?: string;
  intent?: string;
};

type EmergencyMemoryState = {
  isActive: boolean;
  type?: 'lost_child' | 'medical';
  resolved: boolean;
};

type LostChildDetails = {
  childName?: string;
  age?: string;
  clothing?: string;
  lastSeenLocation?: string;
  timeLastSeen?: string;
  guardianContact?: string;
};

type MedicalDetails = {
  location?: string;
  symptoms?: string;
  consciousnessStatus?: string;
  breathingStatus?: string;
};

type StadiumKnowledgeEntry = {
  id?: string;
  category?: string;
  title?: string;
  detail?: string;
  location?: string;
  status?: string;
  updatedAt?: number;
};

export async function generateAiResponse(
  mode: AIMode,
  message: string,
  extraContext?: any
): Promise<any> {
  const chatHistory = normalizeChatHistory(extraContext?.chatHistory ?? extraContext?.messages);
  const latestMessage = message || getLastUserMessage(chatHistory) || '';
  const initialDynamicContext = buildDynamicAiContext(mode, latestMessage, chatHistory, extraContext);
  const bypassEmergencyMemory = shouldBypassEmergencyMemory(mode, latestMessage, extraContext, initialDynamicContext.emergencyState);
  const dynamicContext = bypassEmergencyMemory
    ? buildDynamicAiContext(mode, latestMessage, [], extraContext)
    : initialDynamicContext;
  const safetyMessage = dynamicContext.emergencyState.isActive && bypassEmergencyMemory === false
    ? buildEmergencyMemoryMessage(latestMessage, chatHistory)
    : latestMessage;

  if (dynamicContext.emergencyState.resolved) {
    return {
      intent: 'emergency_resolved',
      severity: 'low',
      answer: 'Understood. I have marked the emergency context as resolved for this conversation. What do you need help with next?',
      createIncidentSuggested: false
    };
  }

  const safetyResponse = getSafetyCriticalResponse(mode, safetyMessage, {
    latestMessage,
    dynamicContext,
    extraContext,
    chatHistory
  });
  if (safetyResponse) {
    return {
      ...safetyResponse,
      memoryState: bypassEmergencyMemory
        ? detectEmergencyMemory(latestMessage, [])
        : dynamicContext.emergencyState
    };
  }

  const enrichedContext = {
    ...extraContext,
    chatHistory,
    dynamicContext,
    systemInstruction: dynamicContext.systemInstruction
  };

  const scenarioResponse = getScenarioPatternResponse(mode, latestMessage, enrichedContext);
  if (scenarioResponse) {
    return scenarioResponse;
  }

  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasOpenAi = !!process.env.OPENAI_API_KEY;

  if (!hasGemini && !hasOpenAi) {
    return deterministicFallback(mode, latestMessage, enrichedContext);
  }

  const contextData = JSON.stringify({
    policies,
    liveCrowd,
    stadiumMap,
    liveState: dynamicContext.liveState,
    emergencyState: dynamicContext.emergencyState,
    retrievedKnowledge: dynamicContext.rag.retrieved,
    bestRoute: mode === 'fan_navigation' ? calculateBestRoute({ requiresAccessibility: latestMessage.toLowerCase().includes('accessible') || latestMessage.toLowerCase().includes('wheelchair') }) : null,
    ...enrichedContext
  });

  const finalUserPrompt = `Current user request: ${latestMessage}\n\nRetrieved stadium knowledge:\n${dynamicContext.rag.contextText}\n\nContext data for this turn:\n${contextData}\n\nRespond as valid JSON for the ${mode} mode. The answer field must be natural language for the current user role.`;
  const geminiContents = buildGeminiContents(chatHistory, finalUserPrompt);

  try {
    if (hasGemini) {
      const ai = new GoogleGenAI({});
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: geminiContents,
        config: {
          responseMimeType: 'application/json',
          systemInstruction: dynamicContext.systemInstruction,
        }
      });
      return JSON.parse(response.text || '{}');
    } else {
      // OpenAI Fallback if specified
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: dynamicContext.systemInstruction },
            ...buildOpenAiMessages(chatHistory),
            { role: 'user', content: finalUserPrompt }
          ],
          response_format: { type: 'json_object' }
        })
      });
      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    }
  } catch (error) {
    console.error('LLM Failed, using fallback:', error);
    return deterministicFallback(mode, latestMessage, enrichedContext);
  }
}

function normalizeChatHistory(rawHistory: unknown): ChatHistoryMessage[] {
  if (!Array.isArray(rawHistory)) return [];

  return rawHistory
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const message = item as ChatHistoryMessage;
      const text = typeof message.text === 'string'
        ? message.text
        : typeof message.content === 'string'
          ? message.content
          : '';

      if (!text.trim()) return null;

      return {
        sender: message.sender,
        role: message.role,
        text: text.trim(),
        intent: message.intent
      };
    })
    .filter(Boolean)
    .slice(-20) as ChatHistoryMessage[];
}

function getLastUserMessage(chatHistory: ChatHistoryMessage[]) {
  return [...chatHistory]
    .reverse()
    .find(message => getMessageSpeaker(message) === 'user')
    ?.text;
}

function getMessageSpeaker(message: ChatHistoryMessage) {
  if (message.sender === 'bot' || message.role === 'assistant' || message.role === 'model' || message.role === 'bot') {
    return 'model';
  }

  return 'user';
}

function buildDynamicAiContext(
  mode: AIMode,
  latestMessage: string,
  chatHistory: ChatHistoryMessage[],
  extraContext?: any
) {
  const liveState = buildLiveStateSummary();
  const emergencyState = detectEmergencyMemory(latestMessage, chatHistory);
  const rag = buildRagContext(latestMessage, mode, emergencyState.type);
  const userRole = extraContext?.userRole || getUserRole(mode);
  const personaInstruction = getPersonaInstruction(mode);
  const fewShotInstruction = getFewShotInstruction(mode);
  const liveOpsAnnouncement = buildLiveOpsAnnouncementSummary(extraContext?.liveOpsAnnouncement);
  const liveKnowledge = buildLiveKnowledgeSummary(extraContext?.stadiumKnowledge);
  const emergencyInstruction = emergencyState.isActive
    ? buildEmergencyPersonaInstruction(mode, emergencyState.type)
    : 'No unresolved emergency is active in the current conversation memory.';

  const systemInstruction = [
    'You are FlowTwin 26 Single Brain, the persistent GenAI intelligence for FIFA World Cup 2026 stadium operations.',
    `User Role: ${userRole}.`,
    personaInstruction,
    fewShotInstruction,
    'Do not break the assigned persona.',
    'Return JSON only to the backend API. The answer field must be plain natural language for the user.',
    'Never place raw JSON, internal incident IDs, private contacts, hidden chain-of-thought, or staff-only protocols inside a fan-facing answer.',
    'Use conversation history as persistent memory. Do not forget earlier emergency details, accessibility needs, language preference, location, or destination.',
    emergencyInstruction,
    'Authoritative retrieved stadium knowledge follows. Treat it as source of truth over general model knowledge.',
    rag.contextText,
    liveOpsAnnouncement,
    liveKnowledge,
    `Live State: ${liveState}`,
    'Use retrieved chunks from stadium-policies.json, stadium-map.json, live-crowd-data.json, routes.json, amenities.json, and transport-status.json before giving routes, crowd guidance, dispatch advice, or announcements.',
    'Do not invent stadium rules, emergency lockdowns, gate closures, or medical powers that are not present in the app context.'
  ].join('\n');

  return {
    systemInstruction,
    emergencyState,
    liveState,
    rag
  };
}

function buildLiveOpsAnnouncementSummary(liveOpsAnnouncement?: any) {
  const text = typeof liveOpsAnnouncement?.text === 'string' ? liveOpsAnnouncement.text.trim() : '';
  if (!text) return 'No current Ops broadcast has been shared with this assistant.';

  const source = typeof liveOpsAnnouncement?.source === 'string' ? liveOpsAnnouncement.source : 'Ops Dashboard';
  return `Current Ops Broadcast from ${source}: ${text}. Treat this as live operational truth for fan, volunteer, and operations answers until superseded.`;
}

function normalizeKnowledgeEntries(entries?: any): StadiumKnowledgeEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry): entry is StadiumKnowledgeEntry => Boolean(entry) && typeof entry.detail === 'string' && typeof entry.title === 'string')
    .slice(0, 30);
}

function buildLiveKnowledgeSummary(entries?: any) {
  const normalized = normalizeKnowledgeEntries(entries);
  if (normalized.length === 0) return 'No editable Stadium Knowledge Store entries are currently active.';

  const lines = normalized.slice(0, 12).map((entry) => (
    `- [${entry.category || 'general'}] ${entry.title}${entry.location ? ` @ ${entry.location}` : ''}${entry.status ? ` (${entry.status})` : ''}: ${entry.detail}`
  ));

  return ['Editable Stadium Knowledge Store entries from Ops Dashboard:', ...lines].join('\n');
}

function getUserRole(mode: AIMode) {
  switch (mode) {
    case 'fan_navigation':
      return 'You are speaking to a stadium Fan.';
    case 'volunteer_policy':
      return 'You are guiding a Sector Volunteer.';
    case 'operations_command':
      return 'You are advising an Operations Organizer.';
    case 'announcement':
      return 'You are helping stadium staff compose public announcements.';
    case 'incident_support':
      return 'You are assisting venue staff with incident support.';
    default:
      return 'You are assisting a stadium user.';
  }
}

function getPersonaInstruction(mode: AIMode) {
  switch (mode) {
    case 'fan_navigation':
      return [
        'Fan persona firewall: speak only as a calm public-facing stadium assistant.',
        'Never say Code Amber, Code Red, incident draft, dispatch, protocol, Ops Dashboard, captured details, raw policy, or internal staff workflow in the fan-facing answer.',
        'Translate emergency policy into compassionate plain language: tell the fan what to do now, reassure them that trained stadium staff have been alerted, and protect private contact details.',
        'For short replies like ok, great, thanks, or got it during an emergency, acknowledge naturally and do not repeat the full emergency summary or detail card.'
      ].join(' ');
    case 'volunteer_policy':
      return 'Volunteer persona rules: give concise protocol steps, safe escalation contacts, missing-detail checks, privacy reminders, and operational actions for the assigned sector.';
    case 'operations_command':
      return 'Operations persona rules: prioritize safety, crowd pressure, accessibility lanes, dispatch sequencing, and manager-ready summaries.';
    case 'announcement':
      return 'Announcement persona rules: produce short, safe, public-facing text. Remove private contact data and avoid panic language.';
    default:
      return 'Persona rules: keep responses practical, safe, and grounded in stadium context.';
  }
}

function getFewShotInstruction(mode: AIMode) {
  switch (mode) {
    case 'fan_navigation':
      return [
        'Few-shot fan behavior examples:',
        'If the fan says an older person cannot use stairs, infer an accessibility need and override shortest-path routing with elevators, ramps, rest, and mobility-cart support.',
        'If the fan says someone collapsed or cannot breathe, do not route them. Calmly anchor them in place, say medical staff have been alerted, tell them not to move the person, and ask them to wave down a yellow-vest steward.',
        'If the fan complains about a food line or missing the game, acknowledge the frustration, use live amenity data, and suggest a faster nearby food option with pickup guidance.'
      ].join(' ');
    case 'volunteer_policy':
      return [
        'Few-shot volunteer behavior examples:',
        'Angry ticket issue: coach de-escalation first, give exact words to say, move the fan aside for space, walk them to Box Office/manual pass support, and radio a supervisor if escalation continues.',
        'Broken sparking turnstile: block the device, redirect the line to adjacent turnstiles, log maintenance, and tell the volunteer not to repair it.',
        'Unattended bag: Code Black. Do not touch the item, clear nearby rows, hold the aisle, and request security.'
      ].join(' ');
    case 'operations_command':
      return [
        'Few-shot operations behavior examples:',
        'Transit crisis: respond with Broadcast, Reroute, and Dispatch actions; protect the gate-to-transit bottleneck before fans arrive.',
        'Lightning or game suspension: trigger severe-weather shelter messaging, clear exposed seating, unlock overflow covered areas, and dispatch volunteers to upper decks.'
      ].join(' ');
    default:
      return 'Few-shot examples: prefer calm, specific, role-appropriate actions grounded in live stadium context.';
  }
}

function buildLiveStateSummary() {
  const congestion = Object.entries(liveCrowd.congestion ?? {})
    .map(([location, data]: [string, any]) => `${location}: ${data.level}, wait ${data.estimatedWaitTimeMins} mins`)
    .join('; ');
  const gates = Object.entries(stadiumMap.gates ?? {})
    .map(([gate, data]: [string, any]) => `${gate}: ${data.status}`)
    .join('; ');
  const transit = Object.entries(stadiumMap.transit ?? {})
    .map(([name, data]: [string, any]) => `${name}: ${data.status}${data.delayMinutes ? `, ${data.delayMinutes} min delay` : ''}`)
    .join('; ');
  const activeAlerts = (liveCrowd.weatherAlerts ?? [])
    .filter((alert: any) => alert.active)
    .map((alert: any) => `${alert.type} ${alert.severity}: ${alert.message}`)
    .join('; ') || 'No active weather emergency.';

  return `Crowd: ${congestion}. Gates: ${gates}. Transit: ${transit}. Weather: ${activeAlerts}`;
}

function detectEmergencyMemory(latestMessage: string, chatHistory: ChatHistoryMessage[]): EmergencyMemoryState {
  const memoryTexts = chatHistory
    .filter(message => getMessageSpeaker(message) === 'user' || message.intent === 'lost_child' || message.intent === 'medical')
    .map(message => message.text);
  const transcript = [...memoryTexts, latestMessage].join('\n').toLowerCase();
  const latestLower = latestMessage.toLowerCase();
  const resolved =
    /\b(found|reunited|resolved|safe now|cancel code|stand down|closed)\b/.test(latestLower) &&
    /\b(child|kid|person|patient|medical|incident|emergency|sania)\b/.test(latestLower);

  if (resolved) {
    return { isActive: false, resolved: true };
  }

  const hasLostChild =
    transcript.includes('lost child') ||
    transcript.includes('missing child') ||
    transcript.includes('my child') ||
    /\b(child|kid)\b.*\b(missing|lost)\b/.test(transcript) ||
    /\b(can'?t|cant|cannot|can not)\s+find\s+(my|our|their|his|her)\s+(son|daughter|child|kid)\b/.test(transcript) ||
    transcript.includes('code amber');

  const hasMedical =
    transcript.includes('medical') ||
    transcript.includes('code red') ||
    transcript.includes('chest pain') ||
    transcript.includes('cannot breathe') ||
    transcript.includes('fainted') ||
    transcript.includes('unconscious') ||
    transcript.includes('breathing difficulty');

  if (hasMedical) {
    return { isActive: true, type: 'medical', resolved: false };
  }

  if (hasLostChild) {
    return { isActive: true, type: 'lost_child', resolved: false };
  }

  return { isActive: false, resolved: false };
}

function buildEmergencyMemoryMessage(latestMessage: string, chatHistory: ChatHistoryMessage[]) {
  const relevantHistory = chatHistory
    .filter(message => message.text)
    .map(message => `${getMessageSpeaker(message) === 'model' ? 'Assistant' : 'User'}: ${message.text}`)
    .join('\n');

  return `${relevantHistory}\nUser: ${latestMessage}`.slice(-5000);
}

function buildGeminiContents(chatHistory: ChatHistoryMessage[], finalUserPrompt: string) {
  const historyContents = chatHistory.map(message => ({
    role: getMessageSpeaker(message),
    parts: [{ text: message.text || '' }]
  }));

  return [
    ...historyContents,
    {
      role: 'user',
      parts: [{ text: finalUserPrompt }]
    }
  ];
}

function buildOpenAiMessages(chatHistory: ChatHistoryMessage[]) {
  return chatHistory.map(message => ({
    role: getMessageSpeaker(message) === 'model' ? 'assistant' : 'user',
    content: message.text || ''
  }));
}

function buildEmergencyPersonaInstruction(mode: AIMode, emergencyType?: EmergencyMemoryState['type']) {
  if (mode === 'fan_navigation') {
    const emergencyLabel = emergencyType === 'medical' ? 'urgent medical help' : 'urgent child-help';
    return [
      'Ongoing emergency memory: an ' + emergencyLabel + ' situation is active in this fan conversation.',
      'Bypass standard routing, food, and small-talk flows until the user clearly says it is resolved.',
      'Use only fan-safe language. Do not mention internal alert names, incident drafts, dispatch, protocols, or dashboards.',
      'If the latest fan message is only conversational acknowledgement, respond briefly with reassurance and stay available instead of repeating the full summary.'
    ].join(' ');
  }

  return `Ongoing emergency memory: ${emergencyType === 'medical' ? 'Code Red medical' : 'Code Amber lost child'} is active in this conversation. Bypass standard routing, food, and small-talk flows until the user clearly resolves it. Continue emergency protocol, ask only for missing critical details, and keep the user anchored to safe next actions.`;
}

function shouldBypassEmergencyMemory(
  mode: AIMode,
  message: string,
  extraContext?: any,
  emergencyState?: EmergencyMemoryState
) {
  const quickAction = normalizeQuickAction(extraContext?.quickAction || message);
  const scopedQuickActions = ['lost child', 'medical', 'accessibility', 'crowd', 'directions', 'translate'];

  if (mode === 'volunteer_policy' && extraContext?.isQuickAction && scopedQuickActions.includes(quickAction)) {
    return true;
  }

  if (mode === 'volunteer_policy' && ['accessibility', 'crowd', 'directions', 'translate'].includes(quickAction)) {
    return true;
  }

  if (!emergencyState?.isActive) return false;
  if (messageContainsEmergencySignal(message)) return false;

  return messageContainsNonEmergencyTopicSwitch(message);
}

function messageContainsEmergencySignal(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes('lost child') ||
    lower.includes('missing child') ||
    lower.includes('my child') ||
    lower.includes('medical') ||
    lower.includes('hurt') ||
    lower.includes('injured') ||
    lower.includes('fainted') ||
    lower.includes('unconscious') ||
    lower.includes('chest pain') ||
    lower.includes('cannot breathe') ||
    lower.includes('breathing') ||
    lower.includes('code amber') ||
    lower.includes('code red') ||
    /\b(child|kid|son|daughter)\b.*\b(missing|lost)\b/.test(lower)
  );
}

function messageContainsNonEmergencyTopicSwitch(message: string) {
  const lower = message.toLowerCase();
  return /\b(food|stall|drink|water|restroom|bathroom|toilet|sponsor|route|directions?|wayfind(?:ing)?|exit|seat|accessibility|accessible|wheelchair|crowd|congestion|surge|translate|language|parking|metro|transport|shuttle|nearest|find|reach)\b/.test(lower);
}

function getSafetyCriticalResponse(mode: AIMode, message: string, responseContext?: any) {
  if (mode !== 'fan_navigation' && mode !== 'volunteer_policy' && mode !== 'incident_support') {
    return null;
  }

  const lowerMsg = message.toLowerCase();
  const latestLowerMsg = (responseContext?.latestMessage || message).toLowerCase();
  const isFan = mode === 'fan_navigation';
  const emergencyType = responseContext?.dynamicContext?.emergencyState?.type;

  if (isFan && responseContext?.dynamicContext?.emergencyState?.isActive && isAcknowledgementOnly(latestLowerMsg)) {
    return getFanEmergencyAcknowledgement(emergencyType);
  }

  const hasPhoneNumber = /\b\d{7,}\b/.test(lowerMsg);

  if (mode === 'volunteer_policy' && lowerMsg.includes('notified security') && lowerMsg.includes('lost child')) {
    return {
      intent: 'lost_child_next_step',
      severity: 'amber',
      answer: 'Good. Next, radio Command Center with the Code Amber details, keep the reporting guardian exactly where they are, update the incident timeline as Security Notified, and fill any missing detail such as time last seen.',
      checklist: [
        'Radio Command Center with Code Amber details',
        'Keep guardian at exact reported location',
        'Update missing details in the incident card',
        'Wait for Command Center handoff'
      ],
      recommendedContact: 'Command Center radio channel',
      createIncidentSuggested: false
    };
  }

  const hasLostChildSignal =
    lowerMsg.includes('lost child') ||
    lowerMsg.includes('child lost') ||
    lowerMsg.includes('my child') ||
    lowerMsg.includes('kid lost') ||
    lowerMsg.includes('missing kid') ||
    lowerMsg.includes("can't find my son") ||
    lowerMsg.includes('cant find my son') ||
    lowerMsg.includes('cannot find my son') ||
    lowerMsg.includes('can not find my son') ||
    lowerMsg.includes("can't find my daughter") ||
    lowerMsg.includes('cant find my daughter') ||
    lowerMsg.includes('cannot find my daughter') ||
    lowerMsg.includes('can not find my daughter') ||
    /\b(can'?t|cant|cannot|can not)\s+find\s+(my|our|their|his|her)\s+(son|daughter|child|kid)\b/.test(lowerMsg) ||
    lowerMsg.includes('missing child') ||
    lowerMsg.includes('has been lost') ||
    /\b(child|kid)\b.*\bmissing\b/.test(lowerMsg) ||
    lowerMsg.includes('last seen') ||
    (lowerMsg.includes('age') && lowerMsg.includes('clothing')) ||
    (lowerMsg.includes('age') && hasPhoneNumber) ||
    (lowerMsg.includes('gate') && lowerMsg.includes('contact') && hasPhoneNumber);

  if (hasLostChildSignal) {
    const details = extractLostChildDetails(message);
    const missingDetails = getMissingLostChildDetails(details);
    const capturedSummary = summarizeLostChildDetails(details);
    const locationText = details.lastSeenLocation || 'the last-seen location';
    const missingText = missingDetails.length > 0
      ? 'Missing detail' + (missingDetails.length === 1 ? '' : 's') + ': ' + missingDetails.join(', ') + '.'
      : 'All core Code Amber details are captured.';
    const isVolunteer = mode === 'volunteer_policy';
    const hasPriorFanCard = Boolean(responseContext?.extraContext?.hasPriorLostChildCard);
    const baseLostChildResponse: any = {
      intent: 'lost_child',
      severity: 'amber',
      answer: isVolunteer
        ? 'Code Amber active. ' + capturedSummary + ' ' + missingText + ' Proceed to ' + locationText + " immediately, gather the child's physical description, and radio Command Center. Keep the reporting guardian exactly where they are and do not publicly announce private contact details."
        : buildFanLostChildAnswer(details, missingDetails),
      checklist: isVolunteer ? [
        'Proceed to ' + locationText + ' immediately',
        "Gather the child's physical description",
        'Radio Command Center',
        'Escalate Code Amber to Ops Dashboard'
      ] : [
        'Stay exactly where you are at ' + locationText,
        'Do not leave to search by yourself',
        'Look for the nearest yellow-vest staff member without moving away',
        'Keep your phone available for stadium staff'
      ],
      actions: isVolunteer ? [
        'Assign the open incident to yourself',
        'Proceed to the fan location',
        'Radio Command Center',
        'Keep the reporting guardian at the exact location',
        'Update the incident when the missing detail is known'
      ] : [
        'Stay exactly where you are',
        'Keep watching the last-seen area if it is safe',
        'Tell the nearest yellow-vest staff member these details',
        'Share any new detail here'
      ],
      requiredDetails: missingDetails,
      recommendedContact: isVolunteer ? 'Command Center radio channel' : 'Nearest yellow-vest staff member',
      createIncidentSuggested: isVolunteer || !hasPriorFanCard,
      incidentDraft: {
        type: 'lost_child',
        sector: 'Fan Copilot',
        location: details.lastSeenLocation || 'Unknown last-seen location',
        description: buildLostChildIncidentDescription(details),
        severity: 'amber',
        missingDetails: Object.fromEntries(missingDetails.map(detail => [detail, 'missing']))
      }
    };

    if (isVolunteer || !hasPriorFanCard) {
      baseLostChildResponse.capturedDetails = details;
    } else {
      delete baseLostChildResponse.incidentDraft;
      baseLostChildResponse.createIncidentSuggested = false;
    }

    return baseLostChildResponse;
  }
  const hasMedicalSignal =
    lowerMsg.includes('medical') ||
    lowerMsg.includes('hurt') ||
    lowerMsg.includes('injured') ||
    lowerMsg.includes('collapsed') ||
    lowerMsg.includes('collapse') ||
    lowerMsg.includes('fainted') ||
    lowerMsg.includes('faint') ||
    lowerMsg.includes('dizzy') ||
    lowerMsg.includes('unconscious') ||
    lowerMsg.includes('bleeding') ||
    lowerMsg.includes('headache') ||
    lowerMsg.includes('headach') ||
    lowerMsg.includes('headech') ||
    lowerMsg.includes('chest pain') ||
    lowerMsg.includes('cannot breathe') ||
    lowerMsg.includes('breathing') ||
    lowerMsg.includes('breathe') ||
    lowerMsg.includes('breathless') ||
    lowerMsg.includes('shortness of breath') ||
    lowerMsg.includes('problem in breathing');

  if (hasMedicalSignal) {
    const details = extractMedicalDetails(message);
    const missingDetails = getMissingMedicalDetails(details);
    const capturedSummary = summarizeMedicalDetails(details);
    const hasPriorFanCard = Boolean(responseContext?.extraContext?.hasPriorMedicalCard);
    const baseMedicalResponse: any = {
      intent: 'medical',
      severity: 'red',
      answer: mode === 'fan_navigation'
        ? buildFanMedicalAnswer(details, missingDetails)
        : 'Code Red active. ' + capturedSummary + ' Dispatch emergency medical services to the section now. Clear the aisles, keep regular traffic away from this sector, and do not move the person unless there is immediate danger.',
      checklist: mode === 'fan_navigation'
        ? ['Stay with the person if it is safe', 'Keep the aisle clear', 'Do not move them unless there is immediate danger', 'Tell the nearest staff member the exact location']
        : ['Dispatch EMS to the section', 'Clear the aisles', 'Route regular traffic away from this sector', 'Do not move person unless unsafe'],
      actions: mode === 'fan_navigation' ? [
        'Call for the nearest staff member now',
        'Keep space around the person',
        'Do not move the person unless unsafe',
        'Share breathing and consciousness status with staff'
      ] : [
        mode === 'volunteer_policy' ? 'Mark EMS notified in the incident card' : 'Call emergency medical services now',
        mode === 'volunteer_policy' ? 'Dispatch EMS and guide them to the exact location' : 'Clear the aisle around the person',
        'Do not move the person unless unsafe',
        'Share this medical summary with staff'
      ],
      requiredDetails: missingDetails,
      recommendedContact: mode === 'fan_navigation' ? 'Nearest first-aid team or yellow-vest staff member' : 'First Aid stations at Sections 105, 215, 330',
      createIncidentSuggested: mode !== 'fan_navigation' || !hasPriorFanCard,
      incidentDraft: {
        type: 'medical',
        sector: 'Fan Copilot',
        location: details.location || 'Unknown medical location',
        description: buildMedicalIncidentDescription(details),
        severity: 'red',
        missingDetails: Object.fromEntries(missingDetails.map(detail => [detail, 'missing']))
      }
    };

    if (mode !== 'fan_navigation' || !hasPriorFanCard) {
      baseMedicalResponse.capturedDetails = details;
    } else {
      delete baseMedicalResponse.incidentDraft;
      baseMedicalResponse.createIncidentSuggested = false;
    }

    return baseMedicalResponse;
  }
  const hasExtremeWeatherSignal =
    lowerMsg.includes('heat stroke') ||
    lowerMsg.includes('too hot') ||
    lowerMsg.includes('dehydrated') ||
    lowerMsg.includes('dehydration') ||
    lowerMsg.includes('heat exhaustion');

  if (hasExtremeWeatherSignal) {
    return {
      intent: 'extreme_weather',
      severity: 'high',
      answer: 'Extreme Weather support. Go to the nearest Cooling Center or Hydration Station now. Use refill stations instead of buying plastic bottles where possible. I am flagging Ops to increase AC output in indoor concourses.',
      checklist: [
        'Move to nearest Cooling Center or Hydration Station',
        'Use refill station for water if safe',
        'Alert Ops about heat risk',
        'Seek medical help immediately if symptoms are severe'
      ],
      recommendedContact: 'Cooling Center / Hydration Station / Ops Dashboard',
      createIncidentSuggested: true
    };
  }

  return null;
}

function getFanEmergencyAcknowledgement(emergencyType?: EmergencyMemoryState['type']) {
  if (emergencyType === 'medical') {
    return {
      intent: 'medical',
      severity: 'red',
      answer: "I'm here with you. Keep the area clear, do not move the person unless there is immediate danger, and tell me right away if their breathing or consciousness changes.",
      createIncidentSuggested: false
    };
  }

  return {
    intent: 'lost_child',
    severity: 'amber',
    answer: "I'm here with you until help arrives. Stay exactly where you are, keep looking around the last-seen area if it is safe, and tell me right away if you see your child or remember anything new.",
    createIncidentSuggested: false
  };
}

function buildFanLostChildAnswer(details: LostChildDetails, missingDetails: string[]) {
  const locationText = details.lastSeenLocation || 'your current location';
  const childText = details.childName ? 'find ' + details.childName : 'find your child';
  const missingText = missingDetails.length > 0
    ? ' If you can, send only this missing detail next: ' + missingDetails.join(', ') + '.'
    : '';

  return 'I know this is incredibly stressful, but please try to stay calm. Stay exactly where you are at ' + locationText + '. Do not leave to search by yourself. I have alerted our security team and they are on their way to help you ' + childText + '. Look for the nearest yellow-vest staff member and show them this chat.' + missingText;
}

function buildFanMedicalAnswer(details: MedicalDetails, missingDetails: string[]) {
  const locationText = details.location || 'your exact location';
  const missingText = missingDetails.length > 0
    ? ' If you can, tell me: ' + missingDetails.join(', ') + '.'
    : '';

  return 'Listen to me carefully: stay calm and stay right where you are at ' + locationText + '. I have alerted the stadium medical team and they are on their way. Do not move the person unless there is immediate danger. Keep the area clear, and if there is a yellow-vest steward nearby, wave them down now. If they stop breathing or lose consciousness, tell the nearest staff member immediately.' + missingText;
}

function findBestKnowledgeEntry(message: string, entries?: any): StadiumKnowledgeEntry | null {
  const normalized = normalizeKnowledgeEntries(entries);
  if (normalized.length === 0) return null;

  const queryTokens = tokenizeKnowledgeText(message);
  if (queryTokens.length === 0) return null;

  const scored = normalized.map((entry) => {
    const haystack = [entry.category, entry.title, entry.location, entry.status, entry.detail].filter(Boolean).join(' ');
    const entryTokens = tokenizeKnowledgeText(haystack);
    let score = 0;

    for (const token of queryTokens) {
      if (entryTokens.includes(token)) score += 2;
      if ((entry.title || '').toLowerCase().includes(token)) score += 2;
      if ((entry.location || '').toLowerCase().includes(token)) score += 2;
      if ((entry.category || '').toLowerCase().includes(token)) score += 1;
    }

    if (/delay|delayed|late|train|metro|shuttle|transport/i.test(message) && entry.category === 'transport') score += 4;
    if (/accessible|accessibility|wheelchair|mobility|shuttle/i.test(message) && entry.category === 'accessibility') score += 4;
    if (/security|bag|policy|rule|allowed|not allowed/i.test(message) && (entry.category === 'security' || entry.category === 'policy')) score += 4;
    if (/food|drink|water|stall|restroom/i.test(message) && entry.category === 'amenity') score += 4;

    return { entry, score };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.score >= 4 ? scored[0].entry : null;
}

function tokenizeKnowledgeText(text: string) {
  const stopWords = new Set(['the', 'is', 'are', 'a', 'an', 'to', 'for', 'of', 'and', 'or', 'in', 'on', 'at', 'now', 'what', 'where', 'which', 'tell', 'me', 'about', 'can', 'i']);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1 && !stopWords.has(token));
}

function buildKnowledgeResponse(mode: AIMode, entry: StadiumKnowledgeEntry) {
  const locationText = entry.location ? ` Location: ${entry.location}.` : '';
  const statusText = entry.status ? ` Current status: ${entry.status}.` : '';

  if (mode === 'fan_navigation') {
    return {
      intent: 'knowledge_lookup',
      answer: `Current stadium update: ${entry.detail}${locationText}${statusText}`,
      source: 'stadium_knowledge_store',
      knowledgeData: entry,
      actions: buildKnowledgeActions(entry)
    };
  }

  if (mode === 'volunteer_policy') {
    return {
      intent: 'knowledge_lookup',
      severity: entry.category === 'security' ? 'high' : 'low',
      answer: `Ops Knowledge Store entry: ${entry.title}. ${entry.detail}${locationText}${statusText}`,
      checklist: buildKnowledgeActions(entry),
      recommendedContact: entry.category === 'security' ? 'Security Command / Ops Dashboard' : 'Ops Dashboard',
      createIncidentSuggested: false,
      knowledgeData: entry
    };
  }

  return {
    recommendations: [
      {
        type: 'knowledge_lookup',
        title: entry.title || 'Knowledge Store Entry',
        description: `${entry.detail}${locationText}${statusText}`,
        priority: entry.category === 'security' ? 'high' : 'medium'
      }
    ],
    knowledgeData: entry
  };
}

function buildKnowledgeActions(entry: StadiumKnowledgeEntry) {
  const actions = ['Use this live Ops knowledge as the current source of truth'];
  if (entry.location) actions.push(`Guide people using location: ${entry.location}`);
  if (entry.status) actions.push(`Mention status: ${entry.status}`);
  if (entry.category === 'security') actions.push('Escalate uncertainty to Security Command');
  if (entry.category === 'accessibility') actions.push('Preserve accessible lanes and offer step-free support');
  return actions;
}

function getScenarioPatternResponse(mode: AIMode, message: string, extraContext?: any) {
  const lowerMsg = message.toLowerCase();
  const liveOpsText = typeof extraContext?.liveOpsAnnouncement?.text === 'string'
    ? extraContext.liveOpsAnnouncement.text
    : '';
  const lowerLiveOpsText = liveOpsText.toLowerCase();
  const matchingKnowledge = findBestKnowledgeEntry(message, extraContext?.stadiumKnowledge);

  if (matchingKnowledge && (mode === 'fan_navigation' || mode === 'volunteer_policy' || mode === 'operations_command')) {
    return buildKnowledgeResponse(mode, matchingKnowledge);
  }

  if (mode === 'fan_navigation') {
    if (isAcknowledgementOnly(lowerMsg)) {
      return {
        intent: 'acknowledgement',
        answer: 'Glad it helped. I can still help with food, water, restrooms, your seat, accessibility support, crowd-safe routes, or finding stadium staff.',
        createIncidentSuggested: false
      };
    }

    const asksLiveGate =
      lowerMsg.includes('gate now') ||
      lowerMsg.includes('accessible gate') ||
      lowerMsg.includes('best gate') ||
      lowerMsg.includes('fastest gate') ||
      lowerMsg.includes('which gate') ||
      lowerMsg.includes('free gate') ||
      lowerMsg.includes('free to move') ||
      lowerMsg.includes('available gate') ||
      (lowerMsg.includes('gate') && lowerMsg.includes('now'));

    const gateBIsLiveOption =
      lowerLiveOpsText.includes('gate b') &&
      (lowerLiveOpsText.includes('clear') || lowerLiveOpsText.includes('faster entry') || lowerLiveOpsText.includes('available'));

    if (asksLiveGate && gateBIsLiveOption) {
      return {
        intent: 'navigation',
        answer: 'Live Ops update says Gate B is currently the best option. It has about a 5 minute wait and supports accessible entry, so head to Gate B and use the North Ramp Route. Keep accessible lanes clear and follow staff directions when you arrive.',
        accessibility: true,
        crowdAware: true,
        source: 'Ops broadcast',
        actions: ['Go to Gate B for faster entry', 'Use the accessible North Ramp Route', 'Follow staff directions at the gate'],
        routeData: {
          route: {
            id: 'live-gate-b-accessible',
            name: 'North Ramp Route B',
            startPoint: 'Gate B',
            endPoint: 'Section 102',
            distanceMeters: 400,
            isAccessible: true,
            hasStairs: false,
            averageTimeMins: 7,
            transitId: 'transit-shuttle-north',
            sustainabilityBonus: 30
          },
          score: 120,
          explanation: 'Updated from live Ops broadcast: Gate B is clear and available for faster accessible entry.'
        }
      };
    }

    if ((lowerMsg.includes('grandpa') || lowerMsg.includes('grandfather') || lowerMsg.includes('tired') || lowerMsg.includes("can't walk") || lowerMsg.includes('cannot walk')) && (lowerMsg.includes('stairs') || lowerMsg.includes('section 315'))) {
      return {
        intent: 'navigation',
        answer: "I completely understand. Let's avoid the stairs. Use Elevator E2 near the concession stand, about 50 meters to your left, to reach the 300-level concourse beside Section 315. Take your time, and I can help request a mobility cart if he needs extra support.",
        accessibility: true,
        crowdAware: true,
        actions: ['Avoid stairs and escalators', 'Use Elevator E2', 'Pause near the concession stand if he needs rest', 'Ask yellow-vest staff for a mobility cart']
      };
    }

    if ((lowerMsg.includes('line') || lowerMsg.includes('queue')) && (lowerMsg.includes('food') || lowerMsg.includes('missing the game') || lowerMsg.includes('ridiculous'))) {
      const recommendation = findBestAmenity({ category: 'food', avoidCrowds: true, wantsPreOrder: true });
      if (recommendation) {
        return {
          intent: 'food_search',
          answer: "I know, food lines get really frustrating when you are missing the match. " + buildAmenityAnswer(recommendation, { category: 'food', avoidCrowds: true, wantsPreOrder: true }) + ' Should I guide you there now?',
          amenityData: recommendation,
          actions: ['Guide me there', recommendation.bookingAvailable ? 'Reserve pickup' : 'Show backup option', 'Avoid the main concourse line'],
          crowdAware: true
        };
      }
    }

    const amenityContext = parseAmenitySearchContext(message);
    if (amenityContext) {
      const recommendation = findBestAmenity(amenityContext);
      if (recommendation) {
        const category = recommendation.amenity.category;
        const intent = category === 'restroom'
          ? 'restroom_search'
          : category === 'water'
            ? 'water_search'
            : category === 'sponsor'
              ? 'sponsor_search'
              : category === 'drink'
                ? 'drink_search'
                : 'food_search';

        return {
          intent,
          answer: buildAmenityAnswer(recommendation, amenityContext),
          amenityData: recommendation,
          actions: [
            'Navigate with crowd-aware route',
            recommendation.bookingAvailable ? 'Reserve pickup' : 'Follow signs to location',
            recommendation.amenity.accessible ? 'Use accessible path' : 'Ask a volunteer before moving'
          ],
          crowdAware: true,
          accessibility: Boolean(amenityContext.requiresAccessibility || recommendation.amenity.accessible),
          language: amenityContext.language
        };
      }
    }

    const wantsHindi = lowerMsg.includes('hindi') || lowerMsg.includes('only speak hindi') || lowerMsg.includes('speak hindi');
    const wantsAccessibleRoute =
      lowerMsg.includes('wheelchair') ||
      lowerMsg.includes('accessible') ||
      lowerMsg.includes('accessibility') ||
      lowerMsg.includes('nearest accessible entrance');
    const wantsCrowdAvoidance =
      lowerMsg.includes('avoid') ||
      lowerMsg.includes('crowded') ||
      lowerMsg.includes('most crowded') ||
      lowerMsg.includes('concourse') ||
      lowerMsg.includes('gate c is crowded');

    if (wantsHindi && wantsAccessibleRoute) {
      const route = calculateBestRoute({ requiresAccessibility: true }, lowerMsg.includes('gate c'));
      return {
        intent: 'navigation',
        language: 'hi',
        answer: route
          ? `Hindi सहायता: सबसे सुरक्षित accessible entrance ${route.route.startPoint} है. ${route.route.name} लें; wheelchair के लिए केवल Elevator E1, Elevator E2, या Ramp A use करें. Stairs या escalators न लें, और भीड़ वाले Gate C से बचें.`
          : 'Hindi सहायता: अभी accessible route calculate नहीं हो पाया. कृपया nearest volunteer से accessible entrance पूछें.',
        accessibility: true,
        crowdAware: true
      };
    }

    if (wantsAccessibleRoute || wantsCrowdAvoidance) {
      const route = calculateBestRoute({ requiresAccessibility: wantsAccessibleRoute }, wantsCrowdAvoidance || lowerMsg.includes('gate c'));
      if (route) {
        const accessibilityText = route.route.isAccessible
          ? 'It is wheelchair accessible: use only Elevator E1, Elevator E2, or Ramp A, and avoid stairs or escalators.'
          : 'This route is not fully accessible, so ask a volunteer before using it.';
        const congestionText = 'Gate C is marked severe in live crowd data, so this recommendation avoids the highest-pressure path.';

        return {
          intent: 'navigation',
          answer: `Take ${route.route.name} from ${route.route.startPoint} toward ${route.route.endPoint}. ${accessibilityText} ${congestionText} Current score: ${route.score}.`,
          accessibility: wantsAccessibleRoute,
          crowdAware: true
        };
      }
    }
  }

  if (mode === 'volunteer_policy') {
    const quickAction = normalizeQuickAction(message);

    if (liveOpsText && (lowerMsg.includes('latest announcement') || lowerMsg.includes('ops announcement') || lowerMsg.includes('current update') || lowerMsg.includes('gate b'))) {
      return {
        intent: 'live_ops_update',
        severity: 'low',
        answer: `Current Ops broadcast: ${liveOpsText} Use this wording when guiding fans, keep accessible lanes clear, and route entry questions according to this live update.`,
        checklist: ['Repeat the Ops broadcast consistently', 'Guide fans to the announced gate', 'Keep accessible lanes clear'],
        recommendedContact: 'Ops Dashboard / Crowd Lead',
        createIncidentSuggested: false
      };
    }

    if ((lowerMsg.includes('ticket') || lowerMsg.includes('scan') || lowerMsg.includes('scanner')) && (lowerMsg.includes('screaming') || lowerMsg.includes('angry') || lowerMsg.includes('scammer') || lowerMsg.includes("won't scan") || lowerMsg.includes('will not scan'))) {
      return {
        intent: 'conflict_resolution',
        severity: 'medium',
        answer: "Take a breath; you can handle this. Step slightly to the side to give them space, keep your hands visible, and say: 'I know this is incredibly frustrating, and I want to get you inside as fast as possible. The scanners have been glitching with screen glare today. Let's walk over to the Box Office window so they can manually print your pass.' If they keep shouting or blocking the lane, radio your Zone Supervisor.",
        checklist: ['Give the fan space', 'Use the de-escalation script', 'Move to Box Office/manual pass support', 'Radio Zone Supervisor if aggression continues'],
        recommendedContact: 'Box Office window / Zone Supervisor',
        createIncidentSuggested: false
      };
    }

    if ((lowerMsg.includes('turnstile') || lowerMsg.includes('gate')) && (lowerMsg.includes('broke') || lowerMsg.includes('broken') || lowerMsg.includes('spark') || lowerMsg.includes('sparking'))) {
      return {
        intent: 'equipment_failure',
        severity: 'high',
        answer: 'Action required immediately: physically block the unsafe turnstile so no fan touches it, redirect the current line to the adjacent turnstiles, and keep the queue moving away from the spark risk. I am logging emergency maintenance for the gate. Do not attempt to fix the equipment yourself.',
        checklist: ['Block the unsafe turnstile', 'Redirect fans to adjacent turnstiles', 'Keep accessible and emergency lanes clear', 'Log emergency maintenance', 'Do not repair the equipment yourself'],
        recommendedContact: 'Maintenance Lead and Gate Supervisor',
        createIncidentSuggested: true
      };
    }

    if ((lowerMsg.includes('backpack') || lowerMsg.includes('bag') || lowerMsg.includes('unattended item')) && (lowerMsg.includes('left') || lowerMsg.includes('under a seat') || lowerMsg.includes('no one') || lowerMsg.includes('unattended'))) {
      return {
        intent: 'security_unattended_item',
        severity: 'critical',
        answer: 'Code Black Protocol: DO NOT touch or move the item. Clear the immediate row, keep fans from approaching the seat, and request security to the exact section now. Stand at the end of the aisle until security arrives.',
        checklist: ['Do not touch or move the item', 'Clear the immediate row', 'Hold the aisle so no one approaches', 'Radio security with exact section and seat area'],
        recommendedContact: 'Security Command / nearest security guard',
        createIncidentSuggested: true
      };
    }

    if (quickAction === 'crowd' || lowerMsg.includes('crowd') || lowerMsg.includes('congestion') || lowerMsg.includes('surge')) {
      return {
        intent: 'crowd_policy',
        severity: 'high',
        answer: 'Crowd support mode. Keep exits and accessible lanes clear, redirect fans away from Gate C pressure toward Gate A or Gate B, and report any stopped flow or pushing to Ops immediately.',
        checklist: [
          'Stand before the bottleneck, not inside it',
          'Redirect fans to Gate A or Gate B',
          'Keep accessible and emergency lanes clear',
          'Escalate pushing, blocked exits, or crowd crush risk to Ops'
        ],
        actions: [
          'Notify Ops Dashboard of the pressure point',
          'Ask nearby volunteers to form a visible wayfinding line',
          'Use short multilingual directions instead of long explanations'
        ],
        recommendedContact: 'Ops Dashboard / Crowd Lead',
        createIncidentSuggested: false
      };
    }

    if (quickAction === 'accessibility' || lowerMsg.includes('accessibility') || lowerMsg.includes('accessible') || lowerMsg.includes('wheelchair')) {
      return {
        intent: 'accessibility_policy',
        severity: 'medium',
        answer: 'Accessibility support. Ask the fan for their destination, use step-free routes only, avoid Gate C if it is crowded, and connect them with ADA Assistance at Gate A when they need escort or seating support.',
        checklist: [
          'Ask destination and mobility need',
          'Use ramps, elevators, and step-free concourses',
          'Avoid stairs and severe crowd zones',
          'Keep accessible lanes open'
        ],
        actions: [
          'Guide the fan toward Gate A ADA Assistance if support is needed',
          'Offer a quieter route if the fan reports sensory or mobility needs',
          'Do not separate the fan from their group unless they ask'
        ],
        recommendedContact: 'ADA Assistance Kiosk at Gate A',
        createIncidentSuggested: false
      };
    }

    if (quickAction === 'directions' || lowerMsg.includes('direction') || lowerMsg.includes('bathroom') || lowerMsg.includes('restroom') || lowerMsg.includes('stall')) {
      return {
        intent: 'directions_policy',
        severity: 'low',
        answer: 'Directions support. Ask for the fan’s current location and destination, then give one clear route using landmarks such as gates, sections, restrooms, food stalls, sponsor zones, or elevators. If Gate C is crowded, route around it.',
        checklist: [
          'Confirm current location',
          'Confirm destination',
          'Mention accessible option if needed',
          'Avoid known crowd pressure zones'
        ],
        recommendedContact: 'Nearest wayfinding volunteer or Ops Dashboard',
        createIncidentSuggested: false
      };
    }

    if (quickAction === 'translate' || lowerMsg.includes('translate') || lowerMsg.includes('language')) {
      return {
        intent: 'translation_policy',
        severity: 'low',
        answer: 'Translation support. Ask the fan to speak or type one short request, translate only the operational need, and never repeat private phone numbers, child details, or medical information over public channels.',
        checklist: [
          'Use short sentences',
          'Confirm the fan’s language',
          'Translate the action needed, not private details',
          'Bring a bilingual volunteer for emergencies'
        ],
        recommendedContact: 'Nearest bilingual volunteer or Guest Services',
        createIncidentSuggested: false
      };
    }

    if (
      lowerMsg.includes('announce') &&
      (lowerMsg.includes('guardian phone') || lowerMsg.includes('phone number') || lowerMsg.includes('contact'))
    ) {
      return {
        intent: 'privacy_policy',
        severity: 'high',
        answer: 'No. Do not announce a guardian phone number or private contact details publicly. Share the contact only through the secure incident channel with Command Center, security, or Ops.',
        checklist: [
          'Do not broadcast private contact details',
          'Use secure incident notes for phone numbers',
          'Share only child description and safe reunification instructions publicly'
        ],
        recommendedContact: 'Command Center radio channel',
        createIncidentSuggested: false
      };
    }

    if (lowerMsg.includes('notified security') && lowerMsg.includes('lost child')) {
      return {
        intent: 'lost_child_next_step',
        severity: 'amber',
        answer: 'Good. Next, radio Command Center with the Code Amber details, keep the reporting guardian exactly where they are, update the incident timeline as Security Notified, and fill any missing detail such as time last seen.',
        checklist: [
          'Radio Command Center with Code Amber details',
          'Keep guardian at exact reported location',
          'Update missing details in the incident card',
          'Wait for Command Center handoff'
        ],
        recommendedContact: 'Command Center radio channel',
        createIncidentSuggested: false
      };
    }

    if (lowerMsg.includes('which incident') && lowerMsg.includes('missing')) {
      return summarizeMissingIncidentDetails(extraContext?.openIncidents ?? []);
    }
  }

  if (mode === 'operations_command') {
    if ((lowerMsg.includes('metro') || lowerMsg.includes('train') || lowerMsg.includes('line 1')) && (lowerMsg.includes('suspended') || lowerMsg.includes('delayed') || lowerMsg.includes('service'))) {
      return {
        recommendations: [
          {
            type: 'broadcast',
            title: 'Broadcast Transit Diversion',
            description: 'Generate a PA and push announcement that Metro Line 1 service is suspended, then direct fans to Rideshare Lot C and South Shuttle buses before they reach the station queue.',
            priority: 'critical'
          },
          {
            type: 'routing',
            title: 'Reroute Fan Copilot Traffic',
            description: 'Immediately penalize Gate A and Metro Station routing in Fan Copilot so exiting fans are guided toward alternate transport exits and shuttle corridors.',
            priority: 'critical'
          },
          {
            type: 'dispatch',
            title: 'Staff the Bottleneck',
            description: 'Send 15 additional crowd-control staff to the Metro Station entrance and Gate A approaches to turn fans before the bottleneck forms.',
            priority: 'critical'
          }
        ]
      };
    }

    if (lowerMsg.includes('lightning') || (lowerMsg.includes('game') && lowerMsg.includes('suspended')) || lowerMsg.includes('severe weather')) {
      return {
        recommendations: [
          {
            type: 'weather_protocol',
            title: 'Trigger Severe Weather Shelter Messaging',
            description: 'Send push notifications and PA messages telling fans to leave exposed seating and move calmly into interior concourses immediately.',
            priority: 'critical'
          },
          {
            type: 'dispatch',
            title: 'Clear Upper-Deck Seating',
            description: 'Dispatch volunteers and security to upper decks and uncovered aisles to guide fans into covered concourses without running.',
            priority: 'critical'
          },
          {
            type: 'capacity',
            title: 'Open Overflow Interior Areas',
            description: 'Unlock Media Room B, VIP Lounge corridors, and other approved covered overflow spaces to absorb the concourse capacity surge.',
            priority: 'high'
          }
        ]
      };
    }

    if (lowerMsg.includes('highest priority') || lowerMsg.includes('priority')) {
      return {
        recommendations: [
          {
            type: 'priority',
            title: 'Highest Priority: Code Red Medical',
            description: 'Handle medical/red incidents before amber lost-child and crowd-flow items because breathing, chest pain, fainting, or unconsciousness can become life-threatening.',
            priority: 'critical'
          },
          {
            type: 'dispatch',
            title: 'Second Priority: Code Amber Lost Child',
            description: 'Assign security and Guest Services while the medical team is dispatched.',
            priority: 'high'
          }
        ]
      };
    }

    if (lowerMsg.includes('reduce crowd') || lowerMsg.includes('without closing')) {
      return {
        recommendations: [
          {
            type: 'crowd_control',
            title: 'Reduce Gate C Pressure Without Closing',
            description: 'Open soft diversion to Gate A and Gate B, deploy volunteers with signs before the bottleneck, slow entry in short waves, and push multilingual wayfinding announcements.',
            priority: 'high'
          },
          {
            type: 'routing',
            title: 'Protect Accessible Routes',
            description: 'Keep accessible lanes clear and route wheelchair users through Gate A or North Ramp Route B.',
            priority: 'high'
          }
        ]
      };
    }

    if (lowerMsg.includes('2-minute') || lowerMsg.includes('stadium manager') || lowerMsg.includes('summary')) {
      return {
        recommendations: [
          {
            type: 'briefing',
            title: 'Manager Briefing',
            description: 'Gate C is under severe crowd pressure. Active risks: one Code Red medical response and one Code Amber lost-child flow. Next decisions: dispatch medical first aid, keep Security/Guest Services on Code Amber, divert fans from Gate C, and issue safe multilingual announcements.',
            priority: 'critical'
          }
        ]
      };
    }

    if (
      lowerMsg.includes('gate c') &&
      (lowerMsg.includes('crowd') || lowerMsg.includes('status') || lowerMsg.includes('congestion') || lowerMsg.includes('wait')) &&
      !lowerMsg.includes('incident')
    ) {
      return {
        recommendations: [
          {
            type: 'crowd_status',
            title: 'Gate C Crowd Status',
            description: 'Gate C remains the highest-pressure entry area. Keep redirecting fans toward Gate A and Gate B, protect accessible lanes, and keep multilingual wayfinding visible before the bottleneck.',
            priority: 'high'
          },
          {
            type: 'wayfinding',
            title: 'Fan Flow Adjustment',
            description: 'Use volunteers and signage to move food, restroom, and seating questions away from Gate C approaches until the wait time drops.',
            priority: 'medium'
          }
        ]
      };
    }

    return {
      recommendations: [
        {
          type: 'dispatch',
          title: 'Gate C Surge Response',
          description: 'Dispatch volunteers to Gate C approaches, redirect fans to Gate A and Gate B, protect accessible lanes, and prepare multilingual congestion announcements.',
          priority: 'high'
        },
        {
          type: 'incident_command',
          title: 'Coordinate Sector 102 Incidents',
          description: 'Prioritize Code Red medical response first, then maintain Code Amber lost-child handoff through Security and Guest Services.',
          priority: 'critical'
        }
      ]
    };
  }

  if (mode === 'announcement') {
    return buildPublicAnnouncement(message);
  }

  return null;
}

function summarizeMissingIncidentDetails(openIncidents: any[]) {
  if (!Array.isArray(openIncidents) || openIncidents.length === 0) {
    return {
      intent: 'incident_audit',
      severity: 'low',
      answer: 'No open incidents are currently available to audit.',
      checklist: [],
      createIncidentSuggested: false
    };
  }

  const summaries = openIncidents
    .filter(incident => incident?.status !== 'resolved')
    .map(incident => {
      const missing = Object.entries(incident?.missingDetails ?? {})
        .filter(([, value]) => String(value).toLowerCase() === 'missing')
        .map(([key]) => key);
      const descriptionMissing = String(incident?.description ?? '')
        .split('|')
        .map(part => part.trim())
        .filter(part => part.toLowerCase().includes('missing'))
        .map(part => part.replace(/missing/ig, '').replace(/[:|-]/g, '').trim().toLowerCase())
        .filter(Boolean);
      const allMissing = Array.from(new Set([...missing, ...descriptionMissing]));
      return allMissing.length > 0
        ? `${String(incident.type).replace('_', ' ')} at ${incident.location}: missing ${allMissing.join(', ')}`
        : null;
    })
    .filter(Boolean);

  return {
    intent: 'incident_audit',
    severity: summaries.length > 0 ? 'high' : 'low',
    answer: summaries.length > 0
      ? `Open incident audit: ${summaries.join('; ')}. Update these fields before handoff.`
      : 'All open incidents have their core required details captured.',
    checklist: summaries.length > 0 ? ['Update missing details', 'Confirm response owner', 'Record next timeline event'] : [],
    createIncidentSuggested: false
  };
}

function buildPublicAnnouncement(message: string) {
  const safeMessage = message.replace(/\b\d{7,15}\b/g, '[private contact removed]');
  const lowerSafeMessage = safeMessage.toLowerCase();
  const isGateAClear = lowerSafeMessage.includes('gate a') && (lowerSafeMessage.includes('open') || lowerSafeMessage.includes('clear'));
  const isGateBClear = lowerSafeMessage.includes('gate b') && (lowerSafeMessage.includes('open') || lowerSafeMessage.includes('clear') || lowerSafeMessage.includes('faster entry'));
  const isGateCClear = lowerSafeMessage.includes('gate c') && (lowerSafeMessage.includes('open') || lowerSafeMessage.includes('eased') || lowerSafeMessage.includes('normal'));
  const isGateCCongestion = lowerSafeMessage.includes('gate c') || lowerSafeMessage.includes('congestion');
  const isTransitDelay =
    lowerSafeMessage.includes('train') ||
    lowerSafeMessage.includes('metro') ||
    lowerSafeMessage.includes('rail') ||
    lowerSafeMessage.includes('transit');
  const delayMinutes = safeMessage.match(/\b(\d{1,3})\s*(?:min|mins|minute|minutes)\b/i)?.[1] ?? '15';

  if (isGateBClear) {
    return {
      english: 'Gate B is currently clear and available for faster entry. Please follow staff directions and keep accessible lanes clear.',
      spanish: 'La Puerta B esta despejada y disponible para una entrada mas rapida. Siga las indicaciones del personal y mantenga libres los carriles accesibles.',
      french: 'La porte B est actuellement degagee et disponible pour une entree plus rapide. Veuillez suivre les consignes du personnel et garder les voies accessibles libres.',
      portuguese: 'O Portao B esta livre e disponivel para entrada mais rapida. Siga a orientacao da equipe e mantenha livres as faixas acessiveis.',
      arabic: 'Gate B is clear for faster entry. Please follow staff directions and keep accessible lanes clear.',
      hindi: 'गेट B अभी खाली है और तेज़ entry के लिए उपलब्ध है। कृपया staff के निर्देशों का पालन करें और accessible lanes खाली रखें।'
    };
  }

  if (isGateAClear) {
    return {
      english: 'Gate A is open with moderate entry flow. For faster entry, fans may also use Gate B. Please follow staff directions.',
      spanish: 'La Puerta A esta abierta con flujo moderado. Para entrar mas rapido, tambien puede usar la Puerta B. Siga las indicaciones del personal.',
      french: 'La porte A est ouverte avec un flux modere. Pour une entree plus rapide, les spectateurs peuvent aussi utiliser la porte B. Veuillez suivre les consignes du personnel.',
      portuguese: 'O Portao A esta aberto com fluxo moderado. Para entrada mais rapida, os torcedores tambem podem usar o Portao B. Siga a orientacao da equipe.',
      arabic: 'Gate A is open with moderate flow. For faster entry, fans may also use Gate B. Please follow staff directions.',
      hindi: 'गेट A खुला है और entry flow मध्यम है। तेज़ entry के लिए fans गेट B भी उपयोग कर सकते हैं। कृपया staff के निर्देशों का पालन करें।'
    };
  }

  if (isGateCClear && !lowerSafeMessage.includes('surge') && !lowerSafeMessage.includes('heavy')) {
    return {
      english: 'Gate C is open with normal entry flow. Please continue to follow volunteer directions and keep accessible lanes clear.',
      spanish: 'La Puerta C esta abierta con flujo normal. Siga las indicaciones de los voluntarios y mantenga libres los carriles accesibles.',
      french: 'La porte C est ouverte avec un flux normal. Veuillez suivre les consignes des benevoles et garder les voies accessibles libres.',
      portuguese: 'O Portao C esta aberto com fluxo normal. Siga a orientacao dos voluntarios e mantenha livres as faixas acessiveis.',
      arabic: 'Gate C is open with normal entry flow. Please follow volunteer directions and keep accessible lanes clear.',
      hindi: 'गेट C normal entry flow के साथ खुला है। कृपया volunteers के निर्देशों का पालन करें और accessible lanes खाली रखें।'
    };
  }

  if (isGateCCongestion) {
    return {
      english: 'Gate C is currently very crowded. Please use Gate A or Gate B if possible, follow volunteer directions, and keep accessible lanes clear.',
      spanish: 'La Puerta C esta muy congestionada. Use la Puerta A o la Puerta B si es posible, siga las indicaciones del personal y mantenga libres los carriles accesibles.',
      french: 'La porte C est tres frequentee. Veuillez utiliser la porte A ou B si possible, suivre les consignes du personnel et garder les voies accessibles degagees.',
      portuguese: 'O Portao C esta muito cheio. Use o Portao A ou B se possivel, siga a orientacao da equipe e mantenha livres as faixas acessiveis.',
      arabic: 'Gate C is crowded. Please use Gate A or Gate B and follow staff directions.',
      hindi: 'गेट C पर बहुत भीड़ है। कृपया संभव हो तो गेट A या गेट B का उपयोग करें, स्टाफ के निर्देशों का पालन करें और accessible lanes खाली रखें।'
    };
  }

  if (isTransitDelay || lowerSafeMessage.includes('delayed') || lowerSafeMessage.includes('delay')) {
    return {
      english: `Transit update: trains are delayed by ${delayMinutes} minutes. Please allow extra travel time, follow staff directions, and use the least crowded available gate.`,
      spanish: `Actualizacion de transporte: los trenes tienen una demora de ${delayMinutes} minutos. Prevea mas tiempo, siga las indicaciones del personal y use la puerta disponible con menos fila.`,
      french: `Information transport: les trains ont ${delayMinutes} minutes de retard. Prevoyez plus de temps, suivez les consignes du personnel et utilisez la porte disponible la moins chargee.`,
      portuguese: `Atualizacao de transporte: os trens estao atrasados ${delayMinutes} minutos. Reserve mais tempo, siga a orientacao da equipe e use o portao disponivel menos cheio.`,
      arabic: `Transit update: trains are delayed by ${delayMinutes} minutes. Please allow extra travel time and follow staff directions.`,
      hindi: `यातायात सूचना: ट्रेनें ${delayMinutes} मिनट देरी से चल रही हैं। कृपया अतिरिक्त समय रखें, स्टाफ के निर्देशों का पालन करें और कम भीड़ वाले उपलब्ध गेट का उपयोग करें।`
    };
  }

  return {
    english: `Stadium update: ${safeMessage}`,
    spanish: `Aviso del estadio: ${safeMessage}`,
    french: `Annonce du stade: ${safeMessage}`,
    portuguese: `Aviso do estadio: ${safeMessage}`,
    arabic: `Stadium update: ${safeMessage}`,
    hindi: `स्टेडियम सूचना: ${safeMessage}`
  };
}

function normalizeQuickAction(message: string) {
  return message.trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

function isAcknowledgementOnly(lowerMsg: string) {
  const normalized = lowerMsg.trim().replace(/[.!?]+$/g, '').replace(/\s+/g, ' ');
  return [
    'great',
    'thanks',
    'thank you',
    'thank u',
    'ok',
    'okay',
    'cool',
    'nice',
    'got it',
    'good',
    'awesome',
    'perfect',
    'done'
  ].includes(normalized);
}

function titleCase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cleanExtractedValue(value?: string) {
  if (!value) return undefined;
  return value
    .trim()
    .replace(/[.,;]+$/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeLocation(value?: string) {
  const cleaned = cleanExtractedValue(value);
  if (!cleaned) return undefined;

  const gateMatch = cleaned.match(/gate\s*(?:no\.?|number)?\s*([a-z0-9]+)/i);
  if (gateMatch) {
    return `Gate ${gateMatch[1].toUpperCase()}`;
  }

  return titleCase(cleaned);
}

function extractLostChildDetails(message: string): LostChildDetails {
  const details: LostChildDetails = {};
  const normalized = message.replace(/\s+/g, ' ').trim();

  const nameMatch =
    normalized.match(/my child\s+([a-z][a-z'-]+)\s+is\s+missing/i) ||
    normalized.match(/(?:lost child incident for|incident for|lost child)\s+([a-z][a-z'-]+)(?=,|\s+(?:age|aged)\b|$)/i) ||
    normalized.match(/(?:child(?:'s)? name|name)\s*(?:is|:)?\s*([a-z][a-z\s'-]*?)(?=\s+(?:age|aged|clothing|last|contact|guardian|phone|mobile)\b|$)/i) ||
    normalized.match(/^([a-z][a-z'-]+)\s+(?:age|aged)\b/i);
  if (nameMatch) details.childName = titleCase(nameMatch[1]);

  const ageMatch =
    normalized.match(/(?:age(?: is)?|aged)\s*(?:is\s*)?(\d{1,2})\b/i) ||
    normalized.match(/\b(?:she|he|they|child)\s+is\s+(\d{1,2})\b/i);
  if (ageMatch) details.age = ageMatch[1];

  const clothingMatch =
    normalized.match(/clothing\s*(?:is|:)?\s*(.*?)(?=\s+(?:last seen|last-seen|contact|guardian|phone|mobile|number)\b|$)/i) ||
    normalized.match(/wearing\s+(.*?)(?=,?\s*(?:last seen|last-seen|contact|guardian|phone|mobile|number)\b|$)/i);
  if (clothingMatch) details.clothing = cleanExtractedValue(clothingMatch[1]);
  if (!details.clothing) {
    const clothingAfterAgeMatch = normalized.match(/(?:age(?: is)?|aged)\s*(?:is\s*)?\d{1,2}\s*(?:years?|yrs?|year old|years old)?\s*,?\s*(.*?)(?=,?\s*(?:last seen|last-seen|contact|guardian|phone|mobile|number)\b|$)/i);
    if (clothingAfterAgeMatch) details.clothing = cleanExtractedValue(clothingAfterAgeMatch[1]);
  }

  const locationMatch = normalized.match(/(?:last seen(?: location)?|last-seen location)\s*(?:was|is|:)?\s*(.*?)(?=\s+(?:contact|guardian|phone|mobile|number|time)\b|$)/i);
  if (locationMatch) details.lastSeenLocation = normalizeLocation(locationMatch[1]);

  const contactMatch = normalized.match(/\b\d{7,15}\b/);
  if (contactMatch) details.guardianContact = contactMatch[0];

  const timeMatch = normalized.match(/(?:time last seen|last seen time|time)\s*(?:was|is|:)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (timeMatch) details.timeLastSeen = cleanExtractedValue(timeMatch[1]);

  return details;
}

function getMissingLostChildDetails(details: LostChildDetails) {
  const required: Array<[keyof LostChildDetails, string]> = [
    ['childName', 'child name'],
    ['age', 'age'],
    ['clothing', 'clothing'],
    ['lastSeenLocation', 'last seen location'],
    ['timeLastSeen', 'time last seen'],
    ['guardianContact', 'guardian contact']
  ];

  return required
    .filter(([key]) => !details[key])
    .map(([, label]) => label);
}

function summarizeLostChildDetails(details: LostChildDetails) {
  const captured = [
    details.childName ? `name: ${details.childName}` : null,
    details.age ? `age: ${details.age}` : null,
    details.clothing ? `clothing: ${details.clothing}` : null,
    details.lastSeenLocation ? `last seen: ${details.lastSeenLocation}` : null,
    details.guardianContact ? `contact: ${details.guardianContact}` : null,
    details.timeLastSeen ? `time: ${details.timeLastSeen}` : null
  ].filter(Boolean);

  if (captured.length === 0) {
    return 'No child details were captured yet.';
  }

  return `Captured ${captured.join('; ')}.`;
}

function buildLostChildIncidentDescription(details: LostChildDetails) {
  return [
    details.childName ? `Child: ${details.childName}` : 'Child name missing',
    details.age ? `Age: ${details.age}` : 'Age missing',
    details.clothing ? `Clothing: ${details.clothing}` : 'Clothing missing',
    details.lastSeenLocation ? `Last seen: ${details.lastSeenLocation}` : 'Last-seen location missing',
    details.timeLastSeen ? `Time last seen: ${details.timeLastSeen}` : 'Time last seen missing',
    details.guardianContact ? `Guardian contact: ${details.guardianContact}` : 'Guardian contact missing'
  ].join(' | ');
}

function extractMedicalDetails(message: string): MedicalDetails {
  const details: MedicalDetails = {};
  const normalized = message.replace(/\s+/g, ' ').trim();
  const lower = normalized.toLowerCase();

  const sectionMatch = normalized.match(/\bsection\s*([a-z0-9]+)/i);
  const gateMatch = normalized.match(/\bgate\s*(?:no\.?|number)?\s*([a-z0-9]+)/i);
  if (sectionMatch) details.location = `Section ${sectionMatch[1].toUpperCase()}`;
  if (!details.location && gateMatch) details.location = `Gate ${gateMatch[1].toUpperCase()}`;

  const symptoms: string[] = [];
  if (/headache|headach|headech/i.test(normalized)) symptoms.push('headache');
  if (/chest pain/i.test(normalized)) symptoms.push('chest pain');
  if (/bleeding/i.test(normalized)) symptoms.push('bleeding');
  if (/collapsed|collapse/i.test(normalized)) symptoms.push('collapsed');
  if (/fainted|faint/i.test(normalized)) symptoms.push('fainted');
  if (/dizzy/i.test(normalized)) symptoms.push('dizziness');
  if (/hurt|injured|pain/i.test(normalized) && symptoms.length === 0) symptoms.push('pain or injury');
  if (symptoms.length > 0) details.symptoms = symptoms.join(', ');

  if (/unconscious|not conscious/i.test(normalized)) {
    details.consciousnessStatus = 'unconscious';
  } else if (/\bconscious\b|awake|responding/i.test(normalized)) {
    details.consciousnessStatus = 'conscious/responding';
  }

  if (/cannot breathe|can't breathe|cant breathe|not breathing/i.test(lower)) {
    details.breathingStatus = 'cannot breathe';
  } else if (/\bis breathing\b|breathing normally|able to breathe/i.test(lower)) {
    details.breathingStatus = 'breathing';
  } else if (/problem in breathing|trouble breathing|difficulty breathing|breathing problem|shortness of breath|breathless|breathing/i.test(lower)) {
    details.breathingStatus = 'breathing difficulty';
  }

  return details;
}

function getMissingMedicalDetails(details: MedicalDetails) {
  const required: Array<[keyof MedicalDetails, string]> = [
    ['location', 'exact location'],
    ['symptoms', 'symptoms'],
    ['consciousnessStatus', 'consciousness status'],
    ['breathingStatus', 'breathing status']
  ];

  return required
    .filter(([key]) => !details[key])
    .map(([, label]) => label);
}

function summarizeMedicalDetails(details: MedicalDetails) {
  const captured = [
    details.location ? `location: ${details.location}` : null,
    details.symptoms ? `symptoms: ${details.symptoms}` : null,
    details.consciousnessStatus ? `consciousness: ${details.consciousnessStatus}` : null,
    details.breathingStatus ? `breathing: ${details.breathingStatus}` : null
  ].filter(Boolean);

  return captured.length > 0
    ? `Captured ${captured.join('; ')}.`
    : 'No medical details were captured yet.';
}

function buildMedicalIncidentDescription(details: MedicalDetails) {
  return [
    details.location ? `Location: ${details.location}` : 'Exact location missing',
    details.symptoms ? `Symptoms: ${details.symptoms}` : 'Symptoms missing',
    details.consciousnessStatus ? `Consciousness: ${details.consciousnessStatus}` : 'Consciousness status missing',
    details.breathingStatus ? `Breathing: ${details.breathingStatus}` : 'Breathing status missing'
  ].join(' | ');
}

function deterministicFallback(mode: AIMode, message: string, extraContext?: any) {
  const lowerMsg = message.toLowerCase();

  switch (mode) {
    case 'volunteer_policy':
      if (lowerMsg.includes('lost') || lowerMsg.includes('child')) {
        return {
          intent: 'lost_child',
          severity: 'amber',
          answer: "Code Amber. Proceed to the fan's location immediately, keep the reporting guardian exactly where they are, gather the child's physical description, and radio Command Center.",
          checklist: ["Proceed to fan's location", "Gather child's physical description", 'Radio Command Center', 'Escalate Code Amber to Ops Dashboard'],
          requiredDetails: ['age', 'clothing', 'lastSeenLocation', 'guardianContact'],
          recommendedContact: 'Command Center radio channel',
          createIncidentSuggested: true
        };
      }
      if (lowerMsg.includes('medical') || lowerMsg.includes('hurt')) {
        return {
          intent: 'medical',
          severity: 'red',
          answer: 'Code Red. Dispatch EMS to the section, clear the aisles, route regular traffic away from this sector, and do not move the person unless there is immediate danger.',
          checklist: ['Dispatch EMS', 'Clear aisles', 'Route regular traffic away', 'Collect exact symptoms and location'],
          requiredDetails: ['symptoms', 'location', 'consciousness'],
          recommendedContact: 'First Aid stations at Sections 105, 215, 330',
          createIncidentSuggested: true
        };
      }
      return {
        intent: 'general_policy',
        severity: 'low',
        answer: 'Please consult the exact policies in your dashboard or ask a specific policy question.',
        checklist: [],
        requiredDetails: [],
        recommendedContact: 'Ops Dashboard',
        createIncidentSuggested: false
      };

    case 'fan_navigation':
      if (lowerMsg.includes('lost') || lowerMsg.includes('child')) {
        return {
          intent: 'lost_child',
          severity: 'amber',
          answer: 'I know this is incredibly stressful, but please try to stay calm. Stay exactly where you are. Do not leave to search by yourself. I have alerted our security team and they are on their way to help. Identify the nearest staff member in a yellow vest and show them this chat.',
          requiredDetails: ['child name', 'age', 'clothing', 'last seen location', 'time last seen', 'guardian contact'],
          recommendedContact: 'Nearest yellow-vest staff member',
          createIncidentSuggested: true
        };
      }
      if (lowerMsg.includes('medical') || lowerMsg.includes('hurt')) {
        return {
          intent: 'medical',
          severity: 'red',
          answer: 'Listen to me carefully: stay calm and stay right where you are. I have alerted the stadium medical team and they are on their way. Do not move the person unless there is immediate danger. Keep the area clear, and wave down a yellow-vest steward if one is nearby.',
          requiredDetails: ['symptoms', 'location'],
          createIncidentSuggested: true
        };
      }

      const isAccessible = lowerMsg.includes('accessible') || lowerMsg.includes('wheelchair');
      const route = calculateBestRoute({ requiresAccessibility: isAccessible });
      if (route) {
        return {
          intent: 'navigation',
          answer: `I recommend taking ${route.route.name} from ${route.route.startPoint}. The routing engine scored this path as optimal based on live congestion.`
        };
      }
      return { intent: 'general_help', answer: 'I could not calculate a route at this time.' };

    case 'operations_command':
      return {
        recommendations: [
          {
            type: 'dispatch',
            title: 'Crowd Pressure at Gate C',
            description: 'Gate C has severe congestion. Dispatch volunteers to redirect fans.',
            priority: 'high'
          }
        ]
      };

    case 'announcement':
      return buildPublicAnnouncement(message);

    case 'incident_support':
      return {
        answer: 'I have logged this incident detail.'
      };

    default:
      return { answer: 'Message received.' };
  }
}
