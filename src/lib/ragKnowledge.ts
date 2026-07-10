import policies from '../data/stadium-policies.json';
import liveCrowd from '../data/live-crowd-data.json';
import stadiumMap from '../data/stadium-map.json';
import amenities from '../data/amenities.json';
import routes from '../data/routes.json';
import transportStatus from '../data/transport-status.json';

type KnowledgeChunk = {
  id: string;
  source: string;
  title: string;
  text: string;
  tags: string[];
};

function policyChunks(): KnowledgeChunk[] {
  const emergencyChunks = Object.entries(policies.emergency_protocols).map(([code, protocol]) => ({
    id: `policy-${code}`,
    source: 'stadium-policies.json',
    title: `${code.replace('_', ' ')} protocol`,
    text: [
      `Stadium: ${policies.stadium_name}`,
      `Triggers: ${protocol.trigger.join(', ')}`,
      `Fan action: ${protocol.action}`,
      'volunteer_task' in protocol ? `Volunteer task: ${protocol.volunteer_task}` : ''
    ].filter(Boolean).join(' '),
    tags: [code.toLowerCase(), ...protocol.trigger.map(trigger => trigger.toLowerCase())]
  }));

  return [
    ...emergencyChunks,
    {
      id: 'policy-accessibility-wheelchair',
      source: 'stadium-policies.json',
      title: 'Wheelchair accessibility routing',
      text: policies.accessibility_rules.wheelchair,
      tags: ['accessibility', 'wheelchair', 'elevator', 'ramp', 'stairs', 'escalator']
    },
    {
      id: 'policy-accessibility-sensory',
      source: 'stadium-policies.json',
      title: 'Sensory overload support',
      text: policies.accessibility_rules.sensory_overload,
      tags: ['sensory', 'anxiety', 'quiet', 'noise', 'gate b']
    },
    {
      id: 'policy-sustainability-water',
      source: 'stadium-policies.json',
      title: 'Water sustainability',
      text: policies.sustainability_initiatives.water,
      tags: ['water', 'refill', 'plastic', 'sustainability']
    },
    {
      id: 'policy-sustainability-transit',
      source: 'stadium-policies.json',
      title: 'Transit sustainability incentive',
      text: policies.sustainability_initiatives.transit,
      tags: ['transit', 'metro', 'shuttle', 'discount', 'merchandise']
    }
  ];
}

function liveCrowdChunks(): KnowledgeChunk[] {
  const congestion = Object.entries(liveCrowd.congestion).map(([location, data]) => ({
    id: `crowd-${location.toLowerCase().replace(/\s+/g, '-')}`,
    source: 'live-crowd-data.json',
    title: `${location} live crowd`,
    text: `${location} crowd level is ${data.level}. Estimated wait time is ${data.estimatedWaitTimeMins} minutes. Throughput is ${data.peoplePerMinute} people per minute.`,
    tags: ['crowd', 'wait', 'congestion', location.toLowerCase(), data.level.toLowerCase()]
  }));

  const alerts = liveCrowd.weatherAlerts.map(alert => ({
    id: `weather-${alert.type.toLowerCase()}`,
    source: 'live-crowd-data.json',
    title: `${alert.type} weather alert`,
    text: `${alert.type} ${alert.severity}. Active: ${alert.active}. ${alert.message}`,
    tags: ['weather', alert.type.toLowerCase(), alert.severity.toLowerCase(), alert.active ? 'active' : 'inactive']
  }));

  return [...congestion, ...alerts];
}

function mapChunks(): KnowledgeChunk[] {
  const gates = Object.entries(stadiumMap.gates).map(([gate, data]) => ({
    id: `map-${gate.toLowerCase().replace(/\s+/g, '-')}`,
    source: 'stadium-map.json',
    title: `${gate} map status`,
    text: `${gate} status is ${data.status}. Crowd penalty is ${data.crowdPenalty}. Coordinates are x:${data.coordinates.x}, y:${data.coordinates.y}.`,
    tags: ['gate', gate.toLowerCase(), data.status.toLowerCase()]
  }));

  const transit = Object.entries(stadiumMap.transit).map(([name, data]) => ({
    id: `map-transit-${name.toLowerCase()}`,
    source: 'stadium-map.json',
    title: `${name} map transit`,
    text: `${name} status is ${data.status}. Delay is ${data.delayMinutes} minutes. Transit penalty is ${data.transitPenalty}.`,
    tags: ['transit', name.toLowerCase(), data.status.toLowerCase()]
  }));

  const sections = stadiumMap.sections.map(section => ({
    id: `map-${section.id}`,
    source: 'stadium-map.json',
    title: `${section.name} location`,
    text: `${section.name} capacity is ${section.capacity}. Coordinates are x:${section.coordinates.x}, y:${section.coordinates.y}.`,
    tags: ['section', section.name.toLowerCase(), section.id.toLowerCase()]
  }));

  return [...gates, ...transit, ...sections];
}

function amenityChunks(): KnowledgeChunk[] {
  return amenities.map(amenity => ({
    id: `amenity-${amenity.id}`,
    source: 'amenities.json',
    title: amenity.name,
    text: `${amenity.name} is a ${amenity.category} at ${amenity.location} near ${amenity.nearestSection} and ${amenity.nearestGate}. Crowd level: ${amenity.crowdLevel}. Queue: ${amenity.queueTimeMins} minutes. Accessible: ${amenity.accessible}. Items: ${amenity.items.join(', ')}.`,
    tags: [
      amenity.category,
      amenity.location.toLowerCase(),
      amenity.nearestSection.toLowerCase(),
      amenity.nearestGate.toLowerCase(),
      amenity.crowdLevel.toLowerCase(),
      ...amenity.items.map(item => item.toLowerCase())
    ]
  }));
}

function routeChunks(): KnowledgeChunk[] {
  return routes.map(route => ({
    id: `route-${route.id}`,
    source: 'routes.json',
    title: route.name,
    text: `${route.name}: ${route.startPoint} to ${route.endPoint}. Accessible: ${route.isAccessible}. Stairs: ${route.hasStairs}. Distance: ${route.distanceMeters} meters. Average time: ${route.averageTimeMins} minutes. Transit: ${route.transitId}.`,
    tags: ['route', route.startPoint.toLowerCase(), route.endPoint.toLowerCase(), route.isAccessible ? 'accessible' : 'not accessible']
  }));
}

function transportChunks(): KnowledgeChunk[] {
  return transportStatus.services.map(service => ({
    id: `transport-${service.id}`,
    source: 'transport-status.json',
    title: service.name,
    text: `${service.name} status: ${service.status}. Delay: ${service.delayMinutes} minutes. ${service.message}`,
    tags: ['transport', service.name.toLowerCase(), service.status.toLowerCase(), service.id]
  }));
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1);
}

function scoreChunk(chunk: KnowledgeChunk, queryTokens: string[], mode: string, emergencyType?: string) {
  const haystack = tokenize(`${chunk.title} ${chunk.text} ${chunk.tags.join(' ')} ${chunk.source}`);
  const uniqueHaystack = new Set(haystack);
  let score = queryTokens.reduce((total, token) => total + (uniqueHaystack.has(token) ? 2 : 0), 0);

  if (emergencyType === 'lost_child' && chunk.id.includes('Code_Amber')) score += 20;
  if (emergencyType === 'medical' && chunk.id.includes('Code_Red')) score += 20;
  if (mode === 'fan_navigation' && chunk.tags.includes('crowd')) score += 2;
  if (mode === 'volunteer_policy' && chunk.source === 'stadium-policies.json') score += 3;
  if (mode === 'announcement' && chunk.source === 'live-crowd-data.json') score += 2;

  return score;
}

export function retrieveStadiumKnowledge(query: string, mode: string, emergencyType?: string) {
  const allChunks = [
    ...policyChunks(),
    ...liveCrowdChunks(),
    ...mapChunks(),
    ...amenityChunks(),
    ...routeChunks(),
    ...transportChunks()
  ];

  const queryTokens = tokenize(`${query} ${mode} ${emergencyType ?? ''}`);
  const ranked = allChunks
    .map(chunk => ({ ...chunk, score: scoreChunk(chunk, queryTokens, mode, emergencyType) }))
    .filter(chunk => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return ranked.length > 0 ? ranked : allChunks.slice(0, 6).map(chunk => ({ ...chunk, score: 0 }));
}

export function buildRagContext(query: string, mode: string, emergencyType?: string) {
  const retrieved = retrieveStadiumKnowledge(query, mode, emergencyType);
  return {
    retrieved,
    contextText: retrieved
      .map((chunk, index) => `[${index + 1}] ${chunk.title} (${chunk.source}): ${chunk.text}`)
      .join('\n')
  };
}
