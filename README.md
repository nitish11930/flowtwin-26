# FlowTwin 26: GenAI Stadium Operations Copilot

FlowTwin 26 is a full-stack GenAI-enabled stadium assistant for the FIFA World Cup 2026. It connects fans, volunteers, and operations staff through one shared live intelligence layer so stadium updates, emergency guidance, accessibility support, announcements, and operational decisions stay synchronized.

Live demo: https://flowtwin-26.vercel.app

## Challenge Alignment

Challenge 4 asks for a GenAI solution that improves stadium operations and the tournament experience. FlowTwin 26 focuses on three connected personas:

1. Fan Copilot: mobile-first help for navigation, crowd-safe routing, accessibility, food/water discovery, transport delays, multilingual support, and emergency escalation.
2. Volunteer Policy Assistant: step-by-step guidance for lost child, medical, accessibility, crowd, security, and direction questions.
3. Ops Dashboard: live operational intelligence for crowd status, announcements, incident awareness, stadium knowledge entry, and multilingual broadcast generation.

The specialized depth is in real-time stadium operations and crowd-aware assistance, while still covering the fan and volunteer workflows needed for a complete tournament experience.

## Core Idea

The app uses a "Single Brain" pattern:

- One shared live state for Ops, Fan, and Volunteer views
- Persistent chat memory in the browser for each persona
- Dynamic backend context injection before every Gemini response
- RAG-style stadium knowledge from JSON fixtures and staff-entered live data
- Deterministic safety/routing logic before GenAI explanation
- Persona firewalls so fan-facing answers do not leak staff-only jargon

This means the AI is not just a generic chatbot. It answers using current stadium facts, live crowd conditions, user role, previous chat context, and emergency state.

## Key Features

### Fan Copilot

- Crowd-aware route recommendations
- Accessibility-safe routing that avoids stairs/escalators
- Lost-child and medical emergency detection
- Food, drink, restroom, water, and transit assistance
- Multilingual support through GenAI responses
- Live Ops announcements shown inside the fan experience
- Persona-safe emergency wording for fans

### Volunteer Assistant

- Lost child, medical, accessibility, crowd, directions, and translation quick actions
- Step-by-step checklist responses
- Missing-detail detection for incidents
- Privacy reminders for sensitive data
- Live policy and stadium knowledge lookup

### Operations Dashboard

- Live crowd metrics with Gate A/B/C status
- Gate C surge toggle for simulated crowd pressure
- Announcement composer with multilingual translations
- Stadium Knowledge Store for staff-entered live facts
- AI recommendations for operations decisions
- Shared backend state powered by Upstash Redis on Vercel

## Stadium Knowledge Store

Ops staff can add live stadium facts without changing code. Example entries:

- Metro Line 1 delayed by 15 minutes
- Accessible shuttle pickup is currently at Gate C
- Large backpacks are not allowed at entry gates
- Quiet sensory room is near Gate B
- Refill stations are available near Sections 105, 215, and 330

These entries are saved in the shared backend state and injected into Fan, Volunteer, and Ops AI requests. If a fan asks, "Where is the accessible shuttle?", the assistant answers from the live store instead of guessing.

## Architecture

```text
Next.js App Router
  |
  |-- /fan
  |     Fan Copilot UI + persistent chat memory
  |
  |-- /volunteer
  |     Volunteer Policy Assistant + incident workflow support
  |
  |-- /ops
        Ops Dashboard + metrics + announcements + knowledge store

API Layer
  |
  |-- /api/fan-assistant
  |-- /api/volunteer/assistant
  |-- /api/volunteer-help
  |-- /api/ops-recommendation
  |-- /api/announcement
  |-- /api/shared-state

AI + Logic Layer
  |
  |-- Gemini via @google/genai
  |-- Dynamic system context
  |-- Intent classification
  |-- RAG knowledge retrieval
  |-- Deterministic route scoring
  |-- Persona firewall

Data Layer
  |
  |-- /data JSON fixtures
  |-- Upstash Redis / Vercel KV for shared live state
  |-- Browser localStorage fallback for offline/demo continuity
```

## GenAI Implementation

Gemini is used for:

- Natural language reasoning and response generation
- Fan-safe explanation of operational decisions
- Multilingual announcements
- Volunteer policy guidance
- Ops summaries and recommendations
- Conversational fallback when the user is only greeting or acknowledging

Before calling Gemini, the backend builds dynamic context with:

- User role: Fan, Volunteer, or Ops
- Current live state: surge status, announcements, knowledge entries
- Retrieved stadium policies and map data
- Persistent chat history
- Active emergency memory
- Strict persona instructions

## Deterministic Routing Logic

FlowTwin does not let the LLM invent routes. The route engine scores paths with operational constraints:

```text
Score = Distance + CrowdPenalty + AccessibilityPenalty + WeatherPenalty + TransitDelay - SustainabilityBonus
```

The best route is selected by code, then Gemini explains the result in human-friendly language.

## Persistence And Real-Time Sync

The app now uses `/api/shared-state` for shared live state. It supports:

- `GET /api/shared-state` to read current stadium state
- `PATCH /api/shared-state` to update announcements, surge status, or knowledge entries
- `POST /api/shared-state` to replace state when needed

Production is connected to Upstash Redis through Vercel environment variables:

```bash
KV_REST_API_URL
KV_REST_API_TOKEN
```

The deployed API should report:

```json
"persistence": "vercel_kv"
```

If Redis variables are missing, the app falls back to memory for demo safety.

## Security And Privacy

- API keys remain server-side only
- Sensitive env files are ignored by Git
- Fan persona blocks internal staff terms like incident IDs and raw protocols
- Fan responses avoid publicly exposing private contact numbers
- Redis tokens are stored in Vercel encrypted environment variables
- Staff-only workflows stay in Volunteer/Ops modes

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- Google Gemini API via `@google/genai`
- Upstash Redis / Vercel KV-compatible REST persistence
- Vitest for tests
- Vercel for deployment

## Local Setup

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Required for AI responses:

```bash
GEMINI_API_KEY=your_key_here
```

Optional for persistent shared state:

```bash
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

## Testing

Run the full build and test suite:

```bash
npm run deploy:check
```

This runs:

```bash
npm run build
npm run test
```

Current test coverage includes:

- Routing engine behavior
- Amenity/food logic
- Incident workflow actions
- AI response patterns
- Persona safety cases
- Knowledge store lookup
- Shared-state normalization

## Judge Demo Script

1. Open `/ops` and add a Stadium Knowledge Store entry:
   - Category: Transport
   - Title: Metro delay
   - Location: Metro Line 1
   - Status: Delayed 15 min
   - Information: Metro Line 1 is delayed by 15 minutes. Fans should use shuttle backup if they are in a hurry.

2. Open `/fan` and ask:

```text
Is the train delayed right now?
```

Expected: the Fan Copilot answers from the live Ops knowledge entry.

3. In `/ops`, click Announce on Gate B.

4. In `/fan`, ask:

```text
Which gate is best right now?
```

Expected: the Fan Copilot uses the live Gate B announcement.

5. In `/fan`, ask:

```text
My child Sania is missing. She is 12, wearing a dark blue shirt, last seen at Gate C, contact 9911446670.
```

Expected: the assistant triggers emergency behavior with calm fan-safe wording, not raw staff jargon.

6. In `/volunteer`, ask:

```text
There is a lost child incident open. What should I do first as a Sector 102 volunteer?
```

Expected: the volunteer assistant gives staff-facing Code Amber actions and checklist guidance.

## Repository Notes

- The repository is intentionally lightweight for hackathon submission.
- Generated build folders, env files, and local Vercel metadata are ignored.
- Mock stadium data lives in `/data`.
- Core AI orchestration lives in `src/lib/flowtwinAI.ts`.
- Shared-state persistence lives in `src/lib/sharedStateServer.ts` and `/api/shared-state`.

## Assumptions

- Live CCTV, IoT, ticketing, and radio systems are simulated through JSON fixtures and staff-entered dashboard updates.
- In a real stadium deployment, these data sources would connect to the same shared-state and AI context layer.
- Fans are assumed to have basic mobile connectivity inside the stadium.
