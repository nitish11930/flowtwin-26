import { NextResponse } from 'next/server';
import { generateAiResponse } from '../../../lib/flowtwinAI';
import { calculateBestRoute } from '@/lib/routingEngine';
import { buildConversationalResponse, classifyUniversalIntent, toChatPayload } from '@/lib/globalIntent';

type FanChatMessage = {
  sender?: string;
  role?: string;
  text?: string;
  content?: string;
  intent?: string;
  capturedDetails?: Record<string, string>;
  createIncidentSuggested?: boolean;
  incidentDraft?: unknown;
};

export async function POST(req: Request) {
  try {
    const { userMessage, messages = [], gateCSurgeActive = false, liveOpsAnnouncement } = await req.json();
    const chatHistory = Array.isArray(messages) ? messages : [];
    const intent = await classifyUniversalIntent(userMessage || '', 'fan');

    if (intent === 'CONVERSATIONAL') {
      const text = await buildConversationalResponse('fan', userMessage || '', chatHistory);
      return NextResponse.json(toChatPayload(text));
    }

    const response = await generateAiResponse('fan_navigation', userMessage, {
      chatHistory,
      userRole: 'You are speaking to a stadium Fan.',
      fanPersonaFirewall: true,
      liveOpsAnnouncement,
      hasPriorLostChildCard: hasPriorEmergencyCard(chatHistory, 'lost_child'),
      hasPriorMedicalCard: hasPriorEmergencyCard(chatHistory, 'medical')
    });
    const safeResponse = applyFanPersonaFirewall(response, userMessage, chatHistory);
    const widgetData = buildFanWidgetData(safeResponse, userMessage, gateCSurgeActive);

    return NextResponse.json(toChatPayload(safeResponse.answer || safeResponse.text || 'I can help with that.', widgetData));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function buildFanWidgetData(response: any, userMessage: string, gateCSurgeActive: boolean) {
  if (!response || typeof response !== 'object') return undefined;
  const widgetData = { ...response };

  if (response.intent === 'navigation' && !response.routeData) {
    const needsAccess =
      Boolean(response.accessibility) ||
      /accessible|wheelchair|mobility|step-free/i.test(userMessage || '');
    const routeResult = calculateBestRoute({ requiresAccessibility: needsAccess }, gateCSurgeActive);
    if (routeResult) {
      widgetData.routeData = {
        ...routeResult,
        explanation: response.answer || ''
      };
    }
  }

  return widgetData;
}

function hasPriorEmergencyCard(messages: FanChatMessage[], intent: 'lost_child' | 'medical') {
  return messages.some((message) => (
    message?.intent === intent &&
    (Boolean(message.capturedDetails && Object.keys(message.capturedDetails).length > 0) ||
      Boolean(message.incidentDraft) ||
      message.createIncidentSuggested === true)
  ));
}

function applyFanPersonaFirewall(response: any, userMessage: string, messages: FanChatMessage[]) {
  if (!response || typeof response !== 'object') return response;

  const safe = { ...response };
  const latestText = typeof userMessage === 'string' ? userMessage : '';
  const isShortAck = isAcknowledgementOnly(latestText);
  const priorLostChildCard = hasPriorEmergencyCard(messages, 'lost_child');
  const priorMedicalCard = hasPriorEmergencyCard(messages, 'medical');

  if (safe.intent === 'lost_child') {
    if (isShortAck) {
      safe.answer = "I'm here with you until help arrives. Stay exactly where you are, and tell me right away if you see your child or remember anything new.";
      safe.createIncidentSuggested = false;
      delete safe.capturedDetails;
      delete safe.incidentDraft;
      delete safe.requiredDetails;
    } else {
      safe.answer = buildFanLostChildAnswer(safe.capturedDetails, safe.requiredDetails);
      safe.recommendedContact = 'Nearest yellow-vest staff member';
      safe.actions = [
        'Stay exactly where you are',
        'Do not leave to search by yourself',
        'Tell the nearest yellow-vest staff member these details',
        'Share any new detail here'
      ];
      safe.checklist = [
        'Stay at the last-seen location',
        'Keep your phone available',
        'Show this chat to yellow-vest staff',
        'Tell me if anything changes'
      ];

      if (priorLostChildCard) {
        safe.createIncidentSuggested = false;
        delete safe.capturedDetails;
        delete safe.incidentDraft;
      }
    }
  }

  if (safe.intent === 'medical') {
    if (isShortAck) {
      safe.answer = "I'm here with you. Keep the area clear, do not move the person unless there is immediate danger, and tell me right away if their breathing or consciousness changes.";
      safe.createIncidentSuggested = false;
      delete safe.capturedDetails;
      delete safe.incidentDraft;
      delete safe.requiredDetails;
    } else {
      safe.answer = buildFanMedicalAnswer(safe.capturedDetails, safe.requiredDetails);
      safe.recommendedContact = 'Nearest first-aid team or yellow-vest staff member';
      safe.actions = [
        'Call for the nearest staff member now',
        'Keep space around the person',
        'Do not move the person unless unsafe',
        'Share breathing and consciousness status with staff'
      ];
      safe.checklist = [
        'Stay with the person if it is safe',
        'Keep the aisle clear',
        'Do not move them unless there is immediate danger',
        'Tell the nearest staff member the exact location'
      ];

      if (priorMedicalCard) {
        safe.createIncidentSuggested = false;
        delete safe.capturedDetails;
        delete safe.incidentDraft;
      }
    }
  }

  safe.answer = sanitizeFanText(safe.answer);
  safe.actions = sanitizeStringList(safe.actions);
  safe.checklist = sanitizeStringList(safe.checklist);
  safe.recommendedContact = sanitizeFanText(safe.recommendedContact);
  delete safe.incidentId;

  return safe;
}

function buildFanLostChildAnswer(details: Record<string, string> = {}, requiredDetails: string[] = []) {
  const locationText = details.lastSeenLocation || 'your current location';
  const childText = details.childName ? details.childName : 'your child';
  const missingText = requiredDetails.length > 0
    ? ' If you can, send only this missing detail next: ' + requiredDetails.join(', ') + '.'
    : '';

  return 'I know this is incredibly stressful, but please try to stay calm. Stay exactly where you are at ' + locationText + '. Do not leave to search by yourself. I have alerted our security team and they are on their way to help you find ' + childText + '. Look for the nearest yellow-vest staff member and show them this chat.' + missingText;
}

function buildFanMedicalAnswer(details: Record<string, string> = {}, requiredDetails: string[] = []) {
  const locationText = details.location || 'your exact location';
  const missingText = requiredDetails.length > 0
    ? ' If you can, tell me: ' + requiredDetails.join(', ') + '.'
    : '';

  return 'Listen to me carefully: stay calm and stay right where you are at ' + locationText + '. I have alerted the stadium medical team and they are on their way. Do not move the person unless there is immediate danger. Keep the area clear, and if there is a yellow-vest steward nearby, wave them down now. If they stop breathing or lose consciousness, tell the nearest staff member immediately.' + missingText;
}

function sanitizeStringList(value: unknown) {
  if (!Array.isArray(value)) return value;
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map(item => sanitizeFanText(item));
}

function sanitizeFanText(value: unknown) {
  if (typeof value !== 'string') return value;

  return value
    .replace(/Code Amber/gi, 'urgent child-help alert')
    .replace(/Code Red/gi, 'urgent medical alert')
    .replace(/incident draft ready/gi, 'help request ready')
    .replace(/incident draft/gi, 'help request')
    .replace(/Ops Dashboard/gi, 'stadium support team')
    .replace(/dispatch(ed)?/gi, 'alert$1')
    .replace(/protocols?/gi, 'safety steps')
    .replace(/raw JSON/gi, 'technical data')
    .replace(/internal staff workflow/gi, 'staff process')
    .trim();
}

function isAcknowledgementOnly(message: string) {
  const normalized = message.trim().toLowerCase().replace(/[.!?]+$/g, '').replace(/\s+/g, ' ');
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
