# Technical Write-up: SkillPilot

## 1. Approach
Our approach centers on **Technical Rigor vs. UX Friction**. We believe that assessment shouldn't feel like an exam; it should feel like a conversation. We implemented a **"Sovereign Intelligence"** model where the AI is not just a chatbot, but an orchestrator. It makes real-time decisions on whether a candidate is "Strong" or needs "Probing," significantly reducing the number of questions for high-performing candidates while ensuring gaps are accurately identified for others.

## 2. Architecture
We chose a **Decoupled Monolithic Frontend** architecture.
-   **Layer 1 (UI Shell):** `index.html` and `app.js` handle the "visual state."
-   **Layer 2 (Logic Core):** `agent.js` and `scoring.js` handle the "intelligence."
-   **Layer 3 (Adapters):** `aiProvider.js` ensures that if we want to switch from Groq to OpenAI or a local Llama instance, we only change *one* file.
-   **Safety Layer:** A `Circuit Breaker` prevents the app from hanging during API outages, and `Sanitization Gates` prevent XSS from AI-generated content.

## 3. Trade-offs
-   **Vanilla JS vs. React:** We chose Vanilla JS to ensure **zero dependencies** and maximum portability. While React would handle state updates more easily, Vanilla JS ensures the project can be embedded anywhere without a heavy build step.
-   **Client-side PDF Parsing:** We parse resumes in the browser. This ensures **privacy** (data never leaves the device) but limits us to text-based PDFs. We handle this trade-off by providing a "Paste Text" fallback.
-   **Strictness vs. Engagement:** We opted for a "Strict" scoring engine. It’s better to identify a gap and provide a learning resource than to falsely confirm proficiency.

## 4. Production Readiness
To move this to a production-grade product:
1.  **Authentication:** Implement secure user accounts with encrypted key storage.
2.  **Database Layer:** A backend (e.g., Supabase or Firebase) to store assessment history and learning progress.
3.  **Multi-Modal Assessment:** Incorporate voice-to-text for a more natural interview feel.
4.  **SOC2 Compliance:** Ensure PII handling meets enterprise security standards.

## 5. Future Roadmap
-   **Verifiable Badges:** Issue blockchain-based "Skill Badges" upon successful completion of an assessment.
-   **Enterprise Integration:** Integration with HRIS platforms like Workday or Greenhouse to automate the "Technical Screening" phase of hiring.
-   **Community Learning Paths:** Allow users to share successful learning resources, creating a crowdsourced educational ecosystem.
-   **Real-time Coding Sandbox:** For technical roles, integrate a Monaco Editor to assess live coding alongside conversational probing.

---
*SkillPilot: Transforming how the world validates proficiency.*
