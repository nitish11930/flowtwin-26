import { expect, test, describe } from 'vitest';
import { generateAiResponse } from './flowtwinAI';
import { retrieveStadiumKnowledge } from './ragKnowledge';
import { classifyUniversalIntent } from './globalIntent';

describe('Shared FlowTwin AI Service', () => {
  const withNoKey = async (fn: () => Promise<void>) => {
    const origGemini = process.env.GEMINI_API_KEY;
    const origOpenai = process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    
    await fn();
    
    if (origGemini) process.env.GEMINI_API_KEY = origGemini;
    if (origOpenai) process.env.OPENAI_API_KEY = origOpenai;
  };

  test('RAG retrieves Code Amber policy as source of truth', () => {
    const chunks = retrieveStadiumKnowledge("I can't find my son", 'fan_navigation', 'lost_child');
    expect(chunks[0].source).toBe('stadium-policies.json');
    expect(chunks[0].text).toContain('STAY EXACTLY WHERE THEY ARE');
    expect(chunks[0].text).toContain('Do not offer walking directions');
  });

  test('global intent classifier treats greetings as conversational across personas', async () => {
    await withNoKey(async () => {
      await expect(classifyUniversalIntent('hi', 'fan')).resolves.toBe('CONVERSATIONAL');
      await expect(classifyUniversalIntent('hi', 'volunteer')).resolves.toBe('CONVERSATIONAL');
      await expect(classifyUniversalIntent('hi', 'ops')).resolves.toBe('CONVERSATIONAL');
      await expect(classifyUniversalIntent('lost child protocol', 'volunteer')).resolves.toBe('ACTIONABLE');
    });
  });

  test('lost child does not mention fake lockdown (volunteer policy)', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('volunteer_policy', 'sania has been lost');
      expect(res.intent).toBe('lost_child');
      expect(res.severity).toBe('amber');
      expect(res.answer.toLowerCase()).not.toContain('lockdown');
      expect(res.createIncidentSuggested).toBe(true);
    });
  });

  test('medical response escalates safely', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('volunteer_policy', 'someone is hurt, medical emergency');
      expect(res.intent).toBe('medical');
      expect(res.severity).toBe('red');
      expect(res.createIncidentSuggested).toBe(true);
    });
  });

  test('fan route answer uses route scoring', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('fan_navigation', 'how do I get to Gate B?');
      expect(res.intent).toBe('navigation');
      expect(res.answer).toContain('routing engine');
    });
  });

  test('operations recommendation uses crowd metrics', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('operations_command', 'Analyze gates');
      expect(res.recommendations[0].description).toContain('congestion');
    });
  });

  test('fallback works without API key', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('announcement', 'Welcome to the stadium');
      expect(res.spanish).toContain('Aviso del estadio');
      expect(res.spanish).not.toContain('[ES]');
    });
  });

  test('private contact is not included in public announcement text', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('announcement', 'Lost child Sania contact 9911446670');
      expect(res.english).not.toContain('9911446670');
      expect(res.english).toContain('[private contact removed]');
    });
  });

  test('"my child has lost" must return lost_child, not navigation', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('fan_navigation', 'my child has lost');
      expect(res.intent).toBe('lost_child');
      expect(res.createIncidentSuggested).toBe(true);
      expect(res.answer).not.toContain('Code Amber');
      expect(res.answer.toLowerCase()).toContain('stay exactly where you are');
    });
  });

  test('cannot find son phrasing triggers Code Amber, not navigation', async () => {
    await withNoKey(async () => {
      const fanRes = await generateAiResponse('fan_navigation', 'I can not find my son near Gate C');
      const volunteerRes = await generateAiResponse('volunteer_policy', 'A fan says they cannot find their son near Gate C. What should I do?');

      expect(fanRes.intent).toBe('lost_child');
      expect(fanRes.answer.toLowerCase()).toContain('stay exactly where you are');
      expect(fanRes.answer).not.toContain('Code Amber');
      expect(fanRes.answer.toLowerCase()).not.toContain('route');
      expect(volunteerRes.intent).toBe('lost_child');
      expect(volunteerRes.answer).toContain('radio Command Center');
    });
  });

  test('lost child detail follow-up stays emergency-safe and not navigation', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse(
        'fan_navigation',
        'sania age is 12 years clothing dark blue shirt last seen location was gate no c contact is 9911446670'
      );

      expect(res.intent).toBe('lost_child');
      expect(res.createIncidentSuggested).toBe(true);
      expect(res.answer).not.toContain('Code Amber');
      expect(res.answer).toContain('security team');
      expect(res.capturedDetails.childName).toBe('Sania');
      expect(res.capturedDetails.age).toBe('12');
      expect(res.capturedDetails.clothing).toBe('dark blue shirt');
      expect(res.capturedDetails.lastSeenLocation).toBe('Gate C');
      expect(res.capturedDetails.guardianContact).toBe('9911446670');
      expect(res.requiredDetails).toEqual(['time last seen']);
      expect(res.incidentDraft.type).toBe('lost_child');
      expect(res.answer.toLowerCase()).not.toContain('route');
    });
  });

  test('full fan lost child report captures Sania details with fan-safe wording', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse(
        'fan_navigation',
        'My child Sania is missing. She is 12, wearing a dark blue shirt, last seen at Gate C, contact 9911446670.'
      );

      expect(res.intent).toBe('lost_child');
      expect(res.severity).toBe('amber');
      expect(res.answer).not.toContain('Code Amber');
      expect(res.answer).toContain('security team');
      expect(res.answer.toLowerCase()).not.toContain('route');
      expect(res.capturedDetails.childName).toBe('Sania');
      expect(res.capturedDetails.age).toBe('12');
      expect(res.capturedDetails.clothing).toBe('a dark blue shirt');
      expect(res.capturedDetails.lastSeenLocation).toBe('Gate C');
      expect(res.capturedDetails.guardianContact).toBe('9911446670');
      expect(res.requiredDetails).toEqual(['time last seen']);
      expect(res.incidentDraft.type).toBe('lost_child');
    });
  });

  test('wheelchair request returns accessible crowd-aware route', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse(
        'fan_navigation',
        'I am in a wheelchair at Gate A and need to reach Section 215. Gate C is crowded.'
      );

      expect(res.intent).toBe('navigation');
      expect(res.accessibility).toBe(true);
      expect(res.crowdAware).toBe(true);
      expect(res.answer).toContain('wheelchair accessible');
      expect(res.answer).toContain('Gate C');
    });
  });

  test('Hindi accessible entrance request returns Hindi accessibility support', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('fan_navigation', 'I only speak Hindi. Help me find the nearest accessible entrance.');

      expect(res.intent).toBe('navigation');
      expect(res.language).toBe('hi');
      expect(res.accessibility).toBe(true);
      expect(res.answer).toContain('Hindi');
      expect(res.answer).toContain('accessible');
    });
  });

  test('crowd avoidance request uses crowd-aware routing', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('fan_navigation', 'Which route avoids the most crowded concourse right now?');

      expect(res.intent).toBe('navigation');
      expect(res.crowdAware).toBe(true);
      expect(res.answer).toContain('Gate C');
      expect(res.answer).toContain('severe');
    });
  });

  test('fan can find vegetarian food near Section 215 with pickup option', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('fan_navigation', 'Where is the nearest vegetarian food stall near Section 215?');

      expect(res.intent).toBe('food_search');
      expect(res.amenityData.amenity.name).toBe('FIFA Fresh Veg Kitchen');
      expect(res.amenityData.bookingAvailable).toBe(true);
      expect(res.answer).toContain('vegetarian');
      expect(res.answer).toContain('reserve pickup');
    });
  });

  test('fan can find water near Section 215', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('fan_navigation', 'I need water near Section 215.');

      expect(res.intent).toBe('water_search');
      expect(res.amenityData.amenity.name).toBe('Water Refill Station W2');
      expect(res.amenityData.amenity.queueTimeMins).toBe(2);
    });
  });

  test('fan can find low-crowd restroom', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('fan_navigation', 'Where is the nearest bathroom with less crowd near Section 215?');

      expect(res.intent).toBe('restroom_search');
      expect(res.amenityData.amenity.name).toBe('Accessible Restroom R-215');
      expect(res.amenityData.amenity.crowdLevel).toBe('Low');
      expect(res.answer.toLowerCase()).toContain('low');
    });
  });

  test('fan can find halal food while avoiding Gate C', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('fan_navigation', 'Find halal food and route me there avoiding Gate C.');

      expect(res.intent).toBe('food_search');
      expect(res.amenityData.amenity.name).toBe('Halal Grill Express');
      expect(res.crowdAware).toBe(true);
      expect(res.answer).toContain('Halal');
    });
  });

  test('fan can find Coca-Cola sponsor stall', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('fan_navigation', 'I want Coca-Cola sponsor stall near Gate A.');

      expect(res.intent).toBe('sponsor_search');
      expect(res.amenityData.amenity.name).toBe('Coca-Cola Fan Zone');
      expect(res.amenityData.amenity.sponsor).toBe('Coca-Cola');
    });
  });

  test('fan acknowledgement does not trigger navigation', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('fan_navigation', 'great');

      expect(res.intent).toBe('acknowledgement');
      expect(res.createIncidentSuggested).toBe(false);
      expect(res.answer).toContain('Glad it helped');
      expect(res.answer.toLowerCase()).not.toContain('smart route');
      expect(res.answer.toLowerCase()).not.toContain('routing engine');
    });
  });

  test('fan topic switch to food bypasses stale unresolved lost child memory', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse(
        'fan_navigation',
        'Where is the nearest food stall?',
        {
          chatHistory: [
            {
              sender: 'bot',
              text: "Hi! I'm your FlowTwin Copilot. Where are you starting from, where are you heading, and do you need accessible routing?"
            },
            {
              sender: 'user',
              text: 'My child Sania is missing. She is 12, wearing a dark blue shirt, last seen at Gate C, contact 9911446670.'
            },
            {
              sender: 'bot',
              text: 'I have alerted our security team. Please stay exactly where you are at Gate C.',
              intent: 'lost_child'
            }
          ]
        }
      );

      expect(res.intent).toBe('food_search');
      expect(res.createIncidentSuggested).not.toBe(true);
      expect(res.amenityData.amenity.category).toBe('food');
      expect(res.answer.toLowerCase()).toContain('stall');
      expect(res.answer).not.toContain('Code Amber');
      expect(res.memoryState?.type).not.toBe('lost_child');
    });
  });

  test('fan emergency acknowledgement does not repeat detail card', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse(
        'fan_navigation',
        'great',
        {
          chatHistory: [
            {
              sender: 'user',
              text: 'My child Sania is missing. She is 12, wearing a dark blue shirt, last seen at Gate C, contact 9911446670.'
            },
            {
              sender: 'bot',
              text: 'I have alerted our security team and they are on their way to help you find Sania.',
              intent: 'lost_child'
            }
          ],
          hasPriorLostChildCard: true
        }
      );

      expect(res.intent).toBe('lost_child');
      expect(res.createIncidentSuggested).toBe(false);
      expect(res.answer).toContain("I'm here with you");
      expect(res.answer).not.toContain('Code Amber');
      expect(res.capturedDetails).toBeUndefined();
      expect(res.incidentDraft).toBeUndefined();
    });
  });

  test('Policy Assistant uses lost child incident context for next-step actions', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse(
        'volunteer_policy',
        'Lost child incident for Sania, age 12, dark blue shirt, last seen Gate C, guardian contact 9911446670. What should I do next as Sector 102 volunteer?'
      );

      expect(res.intent).toBe('lost_child');
      expect(res.answer).toContain('Code Amber active');
      expect(res.answer).toContain('radio Command Center');
      expect(res.answer).toContain('do not publicly announce private contact details');
      expect(res.actions).toContain('Radio Command Center');
      expect(res.capturedDetails.childName).toBe('Sania');
      expect(res.capturedDetails.clothing).toBe('dark blue shirt');
      expect(res.requiredDetails).toEqual(['time last seen']);
    });
  });

  test('Medical emergency must not return route card', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('fan_navigation', 'I am hurt');
      expect(res.intent).toBe('medical');
      expect(res.createIncidentSuggested).toBe(true);
    });
  });

  test('breathing trouble at a gate stays Code Red and never becomes navigation', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('fan_navigation', 'gate a headech serious problem in breathing');

      expect(res.intent).toBe('medical');
      expect(res.severity).toBe('red');
      expect(res.answer).not.toContain('Code Red');
      expect(res.answer).toContain('stadium medical team');
      expect(res.answer.toLowerCase()).not.toContain('route');
      expect(res.capturedDetails.location).toBe('Gate A');
      expect(res.capturedDetails.symptoms).toBe('headache');
      expect(res.capturedDetails.breathingStatus).toBe('breathing difficulty');
      expect(res.requiredDetails).toEqual(['consciousness status']);
      expect(res.incidentDraft.type).toBe('medical');
      expect(res.incidentDraft.location).toBe('Gate A');
    });
  });

  test('medical chest pain and cannot breathe triggers Code Red with incident draft', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('fan_navigation', 'Someone near Section 105 has chest pain and cannot breathe. What should I do?');

      expect(res.intent).toBe('medical');
      expect(res.severity).toBe('red');
      expect(res.answer).not.toContain('Code Red');
      expect(res.answer).toContain('stadium medical team');
      expect(res.capturedDetails.location).toBe('Section 105');
      expect(res.capturedDetails.symptoms).toBe('chest pain');
      expect(res.capturedDetails.breathingStatus).toBe('cannot breathe');
      expect(res.incidentDraft.type).toBe('medical');
      expect(res.answer.toLowerCase()).not.toContain('route');
    });
  });

  test('volunteer open lost child asks for first Code Amber action', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse(
        'volunteer_policy',
        'There is a lost child incident open. What should I do first as a Sector 102 volunteer?'
      );

      expect(res.intent).toBe('lost_child');
      expect(res.answer).toContain('Code Amber');
      expect(res.checklist).toContain("Gather the child's physical description");
      expect(res.recommendedContact).toContain('Command Center');
    });
  });

  test('volunteer medical emergency gives notify and dispatch guidance', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('volunteer_policy', 'Medical emergency at Section 105. Person fainted but is breathing.');

      expect(res.intent).toBe('medical');
      expect(res.severity).toBe('red');
      expect(res.actions).toContain('Mark EMS notified in the incident card');
      expect(res.actions).toContain('Dispatch EMS and guide them to the exact location');
      expect(res.answer.toLowerCase()).toContain('do not move');
      expect(res.capturedDetails.location).toBe('Section 105');
      expect(res.capturedDetails.breathingStatus).toBe('breathing');
    });
  });

  test('volunteer can audit missing incident details', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse(
        'volunteer_policy',
        'Which incident is missing important details?',
        {
          openIncidents: [
            {
              type: 'lost_child',
              location: 'Gate C',
              status: 'assigned',
              description: 'Child: Sania | Time last seen missing',
              missingDetails: { 'time last seen': 'missing' }
            },
            {
              type: 'medical',
              location: 'Section 105',
              status: 'open',
              description: 'Symptoms missing | Exact location missing',
              missingDetails: { symptoms: 'missing' }
            }
          ]
        }
      );

      expect(res.intent).toBe('incident_audit');
      expect(res.answer).toContain('lost child');
      expect(res.answer).toContain('time last seen');
      expect(res.answer).toContain('medical');
      expect(res.answer).toContain('symptoms');
    });
  });

  test('volunteer notified security gets Command Center next step', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('volunteer_policy', 'I have notified security for the lost child. What is next?');

      expect(res.intent).toBe('lost_child_next_step');
      expect(res.answer).toContain('Command Center');
      expect(res.answer).toContain('timeline');
      expect(res.createIncidentSuggested).toBe(false);
    });
  });

  test('volunteer privacy policy blocks public guardian phone announcement', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('volunteer_policy', 'Can I announce the guardian phone number publicly?');

      expect(res.intent).toBe('privacy_policy');
      expect(res.answer).toContain('No');
      expect(res.answer).toContain('Do not announce');
      expect(res.answer).toContain('secure incident channel');
    });
  });

  test('volunteer crowd quick action gives operational guidance', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('volunteer_policy', 'Crowd');

      expect(res.intent).toBe('crowd_policy');
      expect(res.severity).toBe('high');
      expect(res.answer).toContain('Gate C');
      expect(res.checklist).toContain('Keep accessible and emergency lanes clear');
      expect(res.recommendedContact).toContain('Crowd Lead');
    });
  });

  test('volunteer welcome text does not falsely activate emergency memory', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse(
        'volunteer_policy',
        'Crowd',
        {
          chatHistory: [
            {
              sender: 'bot',
              text: "Hi! I'm the Volunteer Policy Assistant. Ask me any protocol questions (e.g. Lost Child, Medical)."
            },
            {
              sender: 'user',
              text: 'Crowd'
            }
          ]
        }
      );

      expect(res.intent).toBe('crowd_policy');
      expect(res.answer).toContain('Crowd support mode');
      expect(res.answer).not.toContain('Code Red');
      expect(res.answer).not.toContain('Code Amber');
    });
  });

  test('volunteer persistent history keeps unresolved lost child protocol active', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse(
        'volunteer_policy',
        'What should I do next?',
        {
          chatHistory: [
            {
              sender: 'user',
              text: 'Lost child incident for Sania, age 12, dark blue shirt, last seen Gate C, guardian contact 9911446670.'
            },
            {
              sender: 'bot',
              text: 'Code Amber active. Notify security and Guest Services.',
              intent: 'lost_child'
            },
            {
              sender: 'user',
              text: 'What should I do next?'
            }
          ]
        }
      );

      expect(res.intent).toBe('lost_child');
      expect(res.answer).toContain('Code Amber active');
      expect(res.answer).toContain('radio Command Center');
      expect(res.memoryState.type).toBe('lost_child');
    });
  });

  test('volunteer topic switch to food stall bypasses stale lost child memory', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse(
        'volunteer_policy',
        'food stall',
        {
          chatHistory: [
            {
              sender: 'user',
              text: 'Lost child incident for Sania, age 12, dark blue shirt, last seen Gate C, guardian contact 9911446670.'
            },
            {
              sender: 'bot',
              text: 'Code Amber active. Notify security and radio Command Center.',
              intent: 'lost_child'
            },
            {
              sender: 'user',
              text: 'food stall'
            }
          ]
        }
      );

      expect(res.intent).toBe('directions_policy');
      expect(res.answer).toContain('Directions support');
      expect(res.answer).toContain('food stalls');
      expect(res.answer).not.toContain('Code Amber');
      expect(res.memoryState?.type).not.toBe('lost_child');
    });
  });

  test('volunteer accessibility quick action bypasses stale emergency memory', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse(
        'volunteer_policy',
        'Accessibility',
        {
          chatHistory: [
            {
              sender: 'user',
              text: 'Lost child incident for Sania, age 12, dark blue shirt, last seen Gate C, guardian contact 9911446670.'
            },
            {
              sender: 'bot',
              text: 'Code Amber active. Notify security and radio Command Center.',
              intent: 'lost_child'
            },
            {
              sender: 'user',
              text: 'Accessibility'
            }
          ]
        }
      );

      expect(res.intent).toBe('accessibility_policy');
      expect(res.answer).toContain('Accessibility support');
      expect(res.answer).not.toContain('Code Amber');
    });
  });

  test('volunteer medical quick action bypasses stale lost child memory', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse(
        'volunteer_policy',
        'Medical',
        {
          isQuickAction: true,
          quickAction: 'Medical',
          chatHistory: [
            {
              sender: 'user',
              text: 'Lost child incident for Sania, age 12, dark blue shirt, last seen Gate C, guardian contact 9911446670.'
            },
            {
              sender: 'bot',
              text: 'Code Amber active. Notify security and radio Command Center.',
              intent: 'lost_child'
            },
            {
              sender: 'user',
              text: 'Medical'
            }
          ]
        }
      );

      expect(res.intent).toBe('medical');
      expect(res.answer).toContain('Code Red active');
      expect(res.answer).not.toContain('Code Amber active');
    });
  });

  test('volunteer lost child quick action bypasses stale medical memory', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse(
        'volunteer_policy',
        'Lost Child',
        {
          isQuickAction: true,
          quickAction: 'Lost Child',
          chatHistory: [
            {
              sender: 'user',
              text: 'Medical emergency at Section 105. Person fainted but is breathing.'
            },
            {
              sender: 'bot',
              text: 'Code Red active. Dispatch EMS and clear the aisle.',
              intent: 'medical'
            },
            {
              sender: 'user',
              text: 'Lost Child'
            }
          ]
        }
      );

      expect(res.intent).toBe('lost_child');
      expect(res.answer).toContain('Code Amber active');
      expect(res.answer).not.toContain('Code Red active');
      expect(res.memoryState.type).toBe('lost_child');
    });
  });

  test('volunteer crowd quick action bypasses stale lost child memory', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse(
        'volunteer_policy',
        'Crowd',
        {
          isQuickAction: true,
          quickAction: 'Crowd',
          chatHistory: [
            {
              sender: 'user',
              text: 'Lost child incident for Sania, age 12, dark blue shirt, last seen Gate C, guardian contact 9911446670.'
            },
            {
              sender: 'bot',
              text: 'Code Amber active. Notify security and radio Command Center.',
              intent: 'lost_child'
            },
            {
              sender: 'user',
              text: 'Crowd'
            }
          ]
        }
      );

      expect(res.intent).toBe('crowd_policy');
      expect(res.answer).toContain('Crowd support mode');
      expect(res.answer).not.toContain('Code Amber');
    });
  });

  test('volunteer accessibility quick action gives ADA guidance', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('volunteer_policy', 'Accessibility');

      expect(res.intent).toBe('accessibility_policy');
      expect(res.answer).toContain('step-free');
      expect(res.answer).toContain('ADA Assistance');
      expect(res.recommendedContact).toContain('Gate A');
    });
  });

  test('volunteer directions and translate quick actions are useful', async () => {
    await withNoKey(async () => {
      const directions = await generateAiResponse('volunteer_policy', 'Directions');
      const translate = await generateAiResponse('volunteer_policy', 'Translate');

      expect(directions.intent).toBe('directions_policy');
      expect(directions.answer).toContain('current location');
      expect(translate.intent).toBe('translation_policy');
      expect(translate.answer).toContain('never repeat private');
    });
  });

  test('ops crowd topic switch bypasses stale lost child memory', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse(
        'operations_command',
        'Gate C crowd status?',
        {
          chatHistory: [
            {
              sender: 'user',
              text: 'Lost child incident for Sania, age 12, dark blue shirt, last seen Gate C, guardian contact 9911446670.'
            },
            {
              sender: 'bot',
              text: 'Code Amber active. Notify security and radio Command Center.',
              intent: 'lost_child'
            }
          ]
        }
      );

      expect(res.recommendations[0].description).toContain('Gate C');
      expect(res.recommendations[0].description).toContain('redirect');
      expect(res.recommendations[0].title).toContain('Gate C Crowd Status');
      expect(res.recommendations[0].description).not.toContain('Code Amber');
    });
  });

  test('ops Gate C surge recommends dispatch reroute and announcements', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('operations_command', 'Gate C is surging and Section 102 has two incidents. What should Ops do now?');

      expect(res.recommendations[0].title).toContain('Gate C');
      expect(res.recommendations[0].description).toContain('redirect');
      expect(res.recommendations[1].description).toContain('Code Red');
    });
  });

  test('ops priority ranks Code Red medical above amber', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('operations_command', 'Which incident is highest priority right now and why?');

      expect(res.recommendations[0].title).toContain('Code Red Medical');
      expect(res.recommendations[0].description).toContain('before amber');
    });
  });

  test('ops crowd reduction without closure gives practical controls', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('operations_command', 'How can we reduce crowd pressure without closing the gate?');

      expect(res.recommendations[0].description).toContain('Gate A');
      expect(res.recommendations[0].description).toContain('volunteers');
      expect(res.recommendations[0].description).toContain('announcements');
    });
  });

  test('ops manager summary includes incidents risks and decisions', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('operations_command', 'Give me a 2-minute operational summary for the stadium manager.');

      expect(res.recommendations[0].title).toContain('Manager Briefing');
      expect(res.recommendations[0].description).toContain('Gate C');
      expect(res.recommendations[0].description).toContain('Code Red');
      expect(res.recommendations[0].description).toContain('Code Amber');
    });
  });

  test('announcement creates safe multilingual Gate C congestion message', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('announcement', 'Create a public announcement for Gate C congestion in English, Spanish, Hindi.');

      expect(res.english).toContain('Gate C');
      expect(res.spanish).toContain('Puerta C');
      expect(res.hindi).toContain('गेट C');
      expect(res.english).not.toContain('private');
    });
  });

  test('announcement creates real transit delay translations', async () => {
    await withNoKey(async () => {
      const res = await generateAiResponse('announcement', 'train delayed by 15 minutes');

      expect(res.english).toContain('15 minutes');
      expect(res.spanish).toContain('15 minutos');
      expect(res.french).toContain('15 minutes');
      expect(res.portuguese).toContain('15 minutos');
      expect(res.hindi).toContain('15');
      expect(res.spanish).not.toContain('[ES]');
      expect(res.hindi).not.toContain('[HI]');
    });
  });
});
