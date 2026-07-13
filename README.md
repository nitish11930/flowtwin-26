# FlowTwin 26: GenAI Matchday Movement Copilot ⚽️

## 🎯 Chosen Vertical
**Stadium Operations & Fan Assistance Copilot**
FlowTwin 26 is a dual-sided Generative AI assistant designed for the FIFA World Cup 2026. It simultaneously helps fans navigate stadium complexities (language barriers, accessibility, transit delays) while providing real-time, actionable intelligence to stadium operations staff.

## 🧠 Approach and Logic
The core philosophy is **"Deterministic Math + Probabilistic Translation."** 
Instead of relying solely on an LLM to guess routing, the app uses a deterministic edge-calculated algorithm to evaluate live stadium conditions. 

The routing logic uses this formula:
`Score = Distance + Crowd_Penalty + Accessibility_Penalty + Weather_Penalty + Transit_Delay - Sustainability_Bonus`

The route with the lowest penalty score is passed to the Google Gemini API (`@google/genai`), which acts as the "translation layer," explaining the route to the fan in a reassuring, accessible, and multilingual format.

## ⚙️ How the Solution Works
1. **Fan View (Mobile):** Fans input their destination, language, and mobility needs.
2. **Operations Dashboard (Desktop):** Staff monitor live crowd heat maps and transit statuses. 
3. **Shared Live Intelligence:** Ops can publish announcements, toggle crowd-surge status, and add live stadium knowledge such as train delays, accessible shuttle gates, bag rules, or security notes. Fan, Volunteer, and Ops assistants read this shared state before answering.
4. **Cloud-Ready Sync:** `/api/shared-state` keeps the dashboard and assistants aligned across browser tabs and devices. It uses Vercel KV / Upstash Redis when configured, and falls back to a safe in-memory demo store when KV variables are missing.

## 🔐 Production Shared-State Setup
For a true multi-device deployment, add these environment variables in Vercel from a Vercel KV or Upstash Redis database:

```bash
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
```

The app also accepts the equivalent Upstash names:

```bash
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Without these variables, the app still works for demos, but shared data resets when the server instance restarts.

## 📌 Assumptions Made
* **Mock Data:** Due to hackathon constraints, live CCTV and IoT sensor data are simulated using lightweight JSON fixtures and staff-entered shared-state updates.
* **Environment:** The MVP assumes deployment in a Next.js edge environment where API routes can securely access the Google Gemini LLM.
* **Connectivity:** Assumes fans have basic mobile internet access inside the stadium to receive GenAI text payloads.
