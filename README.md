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
3. **The Synchronization:** When mock live data changes (e.g., a simulated crowd surge at Gate C), the routing algorithm recalculates. The Operations Dashboard instantly flags the bottleneck, and the AI Copilot immediately reroutes the fan to a safer gate with an updated wait time.

## 📌 Assumptions Made
* **Mock Data:** Due to hackathon constraints, live CCTV and IoT sensor data are simulated using a local, lightweight JSON state machine (`stadium-map.json`).
* **Environment:** The MVP assumes deployment in a Next.js edge environment where API routes can securely access the Google Gemini LLM.
* **Connectivity:** Assumes fans have basic mobile internet access inside the stadium to receive GenAI text payloads.
