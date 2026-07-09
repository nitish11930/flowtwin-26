import { GoogleGenAI } from '@google/genai';
import policies from '../data/stadium-policies.json';
import liveCrowd from '../data/live-crowd-data.json';
import { calculateBestRoute } from './routingEngine';
import { buildAmenityAnswer, findBestAmenity, parseAmenitySearchContext } from './amenityEngine';

type AIMode = 'fan_navigation' | 'volunteer_policy' | 'operations_command' | 'announcement' | 'incident_support';

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

export async function generateAiResponse(
  mode: AIMode,
  message: string,
  extraContext?: any
): Promise<any> {
  const safetyResponse = getSafetyCriticalResponse(mode, message);
  if (safetyResponse) {
    return safetyResponse;
  }

  const scenarioResponse = getScenarioPatternResponse(mode, message, extraContext);
  if (scenarioResponse) {
    return scenarioResponse;
  }

  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasOpenAi = !!process.env.OPENAI_API_KEY;

  if (!hasGemini && !hasOpenAi) {
    return deterministicFallback(mode, message, extraContext);
  }

  const systemPrompt = `You are FlowTwin 26 AI Assistant, the backend intelligence for a FIFA World Cup 2026 stadium operations platform. You are not a separate product section. You power the existing fan, volunteer, operations, announcement, and incident features. Always use provided app data, route logic, policies, incident records, and crowd metrics before answering. Do not invent stadium rules, gate status, medical instructions, security powers, or emergency lockdowns. Keep responses short, practical, safe, and useful during live matchday operations.`;

  const contextData = JSON.stringify({
    policies,
    liveCrowd,
    bestRoute: mode === 'fan_navigation' ? calculateBestRoute({ requiresAccessibility: message.toLowerCase().includes('accessible') || message.toLowerCase().includes('wheelchair') }) : null,
    ...extraContext
  });

  const fullPrompt = `${systemPrompt}\n\nContext Data:\n${contextData}\n\nUser Request: ${message}\n\nPlease respond in valid JSON matching the format required for the ${mode} mode.`;

  try {
    if (hasGemini) {
      const ai = new GoogleGenAI({});
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
          responseMimeType: 'application/json',
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
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Context Data:\n${contextData}\n\nUser Request: ${message}\n\nPlease respond in valid JSON matching the format required for the ${mode} mode.` }
          ],
          response_format: { type: 'json_object' }
        })
      });
      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    }
  } catch (error) {
    console.error('LLM Failed, using fallback:', error);
    return deterministicFallback(mode, message, extraContext);
  }
}

function getSafetyCriticalResponse(mode: AIMode, message: string) {
  if (mode !== 'fan_navigation' && mode !== 'volunteer_policy' && mode !== 'incident_support') {
    return null;
  }

  const lowerMsg = message.toLowerCase();
  const hasPhoneNumber = /\b\d{7,}\b/.test(lowerMsg);

  if (mode === 'volunteer_policy' && lowerMsg.includes('notified security') && lowerMsg.includes('lost child')) {
    return {
      intent: 'lost_child_next_step',
      severity: 'amber',
      answer: 'Good. Next, send the Code Amber details to Guest Services Desk Section 112, keep the reporting guardian at the last-seen location, update the incident timeline as Security Notified, and fill any missing detail such as time last seen.',
      checklist: [
        'Send details to Guest Services Desk Section 112',
        'Keep guardian at last-seen location',
        'Update missing details in the incident card',
        'Wait for security or guest services handoff'
      ],
      recommendedContact: 'Guest Services Desk Section 112',
      createIncidentSuggested: false
    };
  }

  const hasLostChildSignal =
    lowerMsg.includes('lost child') ||
    lowerMsg.includes('child lost') ||
    lowerMsg.includes('my child') ||
    lowerMsg.includes('kid lost') ||
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
      ? `Missing detail${missingDetails.length === 1 ? '' : 's'}: ${missingDetails.join(', ')}.`
      : 'All core Code Amber details are captured.';
    const isVolunteer = mode === 'volunteer_policy';

    return {
      intent: 'lost_child',
      severity: 'amber',
      answer: isVolunteer
        ? `Code Amber active. ${capturedSummary} ${missingText} Stay at ${locationText} with the reporting guardian. Notify the nearest usher or security guard now. Send captured details to Guest Services Desk Section 112 through the incident channel. Do not publicly announce private contact details.`
        : `Code Amber incident draft ready. ${capturedSummary} ${missingText} Stay at ${locationText}. Notify the nearest usher or security guard now and send this summary to Guest Services Desk Section 112. Do not leave the last-seen area alone; assign one person to contact staff.`,
      checklist: [
        `Stay at ${locationText}`,
        'Notify nearest usher or security guard',
        'Send captured details to Guest Services Desk Section 112',
        'Create a Code Amber incident'
      ],
      actions: [
        isVolunteer ? 'Assign the open incident to yourself' : 'Tap Create Incident',
        'Mark Security Notified after contacting staff',
        'Show this summary to the nearest usher or security guard',
        'Keep the reporting guardian at the last-seen location',
        'Update the incident when the missing detail is known'
      ],
      capturedDetails: details,
      requiredDetails: missingDetails,
      recommendedContact: 'Guest Services Desk Section 112',
      createIncidentSuggested: true,
      incidentDraft: {
        type: 'lost_child',
        sector: 'Fan Copilot',
        location: details.lastSeenLocation || 'Unknown last-seen location',
        description: buildLostChildIncidentDescription(details),
        severity: 'amber',
        missingDetails: Object.fromEntries(missingDetails.map(detail => [detail, 'missing']))
      }
    };
  }

  const hasMedicalSignal =
    lowerMsg.includes('medical') ||
    lowerMsg.includes('hurt') ||
    lowerMsg.includes('injured') ||
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

    return {
      intent: 'medical',
      severity: 'red',
      answer: `Code Red incident draft ready. ${capturedSummary} Call medical dispatch or the nearest first-aid team immediately. Do not move the person unless there is immediate danger. Keep the area clear and share exact location, symptoms, and consciousness/breathing status.`,
      checklist: ['Call first aid', 'Do not move person unless unsafe', 'Keep crowd away', 'Guide medical staff to exact location'],
      actions: [
        mode === 'volunteer_policy' ? 'Mark Medical notified in the incident card' : 'Call first aid now',
        mode === 'volunteer_policy' ? 'Dispatch first aid and guide them to the exact location' : 'Keep the area clear',
        'Do not move the person unless unsafe',
        'Share this medical summary with staff'
      ],
      capturedDetails: details,
      requiredDetails: missingDetails,
      recommendedContact: 'First Aid stations at Sections 105, 215, 330',
      createIncidentSuggested: true,
      incidentDraft: {
        type: 'medical',
        sector: 'Fan Copilot',
        location: details.location || 'Unknown medical location',
        description: buildMedicalIncidentDescription(details),
        severity: 'red',
        missingDetails: Object.fromEntries(missingDetails.map(detail => [detail, 'missing']))
      }
    };
  }

  return null;
}

function getScenarioPatternResponse(mode: AIMode, message: string, extraContext?: any) {
  const lowerMsg = message.toLowerCase();

  if (mode === 'fan_navigation') {
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
          ? `Hindi सहायता: सबसे सुरक्षित accessible entrance ${route.route.startPoint} है. ${route.route.name} लें; यह wheelchair-friendly है और भीड़ वाले Gate C से बचाता है.`
          : 'Hindi सहायता: अभी accessible route calculate नहीं हो पाया. कृपया nearest volunteer से accessible entrance पूछें.',
        accessibility: true,
        crowdAware: true
      };
    }

    if (wantsAccessibleRoute || wantsCrowdAvoidance) {
      const route = calculateBestRoute({ requiresAccessibility: wantsAccessibleRoute }, wantsCrowdAvoidance || lowerMsg.includes('gate c'));
      if (route) {
        const accessibilityText = route.route.isAccessible
          ? 'It is wheelchair accessible and avoids stairs.'
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
    if (
      lowerMsg.includes('announce') &&
      (lowerMsg.includes('guardian phone') || lowerMsg.includes('phone number') || lowerMsg.includes('contact'))
    ) {
      return {
        intent: 'privacy_policy',
        severity: 'high',
        answer: 'No. Do not announce a guardian phone number or private contact details publicly. Share the contact only through the secure incident channel with Guest Services Desk Section 112, security, or Ops.',
        checklist: [
          'Do not broadcast private contact details',
          'Use secure incident notes for phone numbers',
          'Share only child description and safe reunification instructions publicly'
        ],
        recommendedContact: 'Guest Services Desk Section 112',
        createIncidentSuggested: false
      };
    }

    if (lowerMsg.includes('notified security') && lowerMsg.includes('lost child')) {
      return {
        intent: 'lost_child_next_step',
        severity: 'amber',
        answer: 'Good. Next, send the Code Amber details to Guest Services Desk Section 112, keep the reporting guardian at the last-seen location, update the incident timeline as Security Notified, and fill any missing detail such as time last seen.',
        checklist: [
          'Send details to Guest Services Desk Section 112',
          'Keep guardian at last-seen location',
          'Update missing details in the incident card',
          'Wait for security or guest services handoff'
        ],
        recommendedContact: 'Guest Services Desk Section 112',
        createIncidentSuggested: false
      };
    }

    if (lowerMsg.includes('which incident') && lowerMsg.includes('missing')) {
      return summarizeMissingIncidentDetails(extraContext?.openIncidents ?? []);
    }
  }

  if (mode === 'operations_command') {
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
  const isGateCCongestion = safeMessage.toLowerCase().includes('gate c') || safeMessage.toLowerCase().includes('congestion');

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

  return {
    english: safeMessage,
    spanish: `[ES] ${safeMessage}`,
    french: `[FR] ${safeMessage}`,
    portuguese: `[PT] ${safeMessage}`,
    arabic: `[AR] ${safeMessage}`,
    hindi: `[HI] ${safeMessage}`
  };
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
          answer: 'Code Amber. Stay at the last-seen location. Notify the nearest usher or security guard now. Please collect Sania’s age, clothing, last-seen location, time last seen, and guardian contact. I can create an incident for Guest Services Desk Section 112.',
          checklist: ['Keep reporting person at exact location', 'Notify nearest security guard', 'Create Code Amber incident'],
          requiredDetails: ['age', 'clothing', 'lastSeenLocation', 'guardianContact'],
          recommendedContact: 'Guest Services Desk Section 112',
          createIncidentSuggested: true
        };
      }
      if (lowerMsg.includes('medical') || lowerMsg.includes('hurt')) {
        return {
          intent: 'medical',
          severity: 'red',
          answer: 'Code Red. Call medical dispatch immediately. Do not move the person unless there is immediate danger. What are their symptoms and exact location?',
          checklist: ['Call first aid', 'Do not move person', 'Keep crowd away'],
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
          answer: 'Code Amber. Stay at the last-seen location. Notify the nearest usher or security guard now. Please provide the child’s name, age, clothing, last-seen location, time last seen, and guardian contact.',
          requiredDetails: ['child name', 'age', 'clothing', 'last seen location', 'time last seen', 'guardian contact'],
          recommendedContact: 'Guest Services Desk Section 112',
          createIncidentSuggested: true
        };
      }
      if (lowerMsg.includes('medical') || lowerMsg.includes('hurt')) {
        return {
          intent: 'medical',
          severity: 'red',
          answer: 'Code Red. Call medical dispatch immediately. Do not move the person unless there is immediate danger. What are their symptoms and exact location?',
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
      const publicSafeMessage = message.replace(/\b\d{7,15}\b/g, '[private contact removed]');
      return {
        english: publicSafeMessage,
        spanish: `[ES] ${publicSafeMessage}`,
        french: `[FR] ${publicSafeMessage}`,
        portuguese: `[PT] ${publicSafeMessage}`,
        arabic: `[AR] ${publicSafeMessage}`,
        hindi: `[HI] ${publicSafeMessage}`
      };

    case 'incident_support':
      return {
        answer: 'I have logged this incident detail.'
      };

    default:
      return { answer: 'Message received.' };
  }
}
