# ⚖️ How SkillPilot Scores You

This document explains the "Human-in-the-loop" logic behind how SkillPilot determines if a candidate is **Strong**, **Partial**, or has a **Gap**. 

SkillPilot does not blindly trust the AI. It uses a **Hybrid Model**: the AI evaluates the *content*, but a mathematical formula evaluates the *behavior*.

---

## 1. The Two-Step Process

### Step A: The AI's "Opinion" (Nuance)
The AI looks at your answer and gives a **Preliminary Score (1-5)**.
*   **Why?** Because a regular computer can't tell the difference between a genius answer and a "copy-pasted" one. The AI looks for technical depth, keywords, and real-world logic.

### Step B: The Engine's "Verdict" (Behavior)
This is a deterministic formula in `scoring.js`. It looks at **how** you got to the answer.
*   **The Sniff Test:** Did you answer perfectly on the first try? (Fast-Track)
*   **The Probe:** Did the agent have to ask a "tougher" follow-up because your first answer was vague?

---

## 2. The Final Scoring Table

The final verdict is calculated by combining the AI's score with the "Probe" history:

| AI Score | Had a Probe? | Final Verdict | Reasoning |
| :--- | :--- | :--- | :--- |
| **4 - 5** | No | **Strong** | You gave a deep, technical answer immediately. |
| **4 - 5** | Yes | **Strong** | You were initially vague, but you proved yourself on the tough follow-up. |
| **3** | No/Yes | **Partial** | You have the foundation, but struggled with specific application. |
| **1 - 2** | Yes | **Gap** | You were given a second chance (Probe) and still couldn't provide depth. |
| **1 - 2** | No | **Gap** | The initial answer was significantly below the required level. |

---

## 3. Dealing with Bias (Fairness Rules)

To ensure the AI doesn't just "guess" or show bias, we enforce **four Sovereign Rules**:

1.  **Evidence Requirement:** The AI is forbidden from giving a score without a "Note." This note must quote or reference something specific you actually said.
2.  **The "Probe" Penalty:** If you are vague, you *must* pass a harder question to get a "Strong" score. You cannot "fluff" your way to a 5/5.
3.  **Strict Mode:** The AI's "creativity" (temperature) is set to 0.35. This means if two people give the same answer, they get the same score. It removes "AI mood swings."
4.  **Blind Assessment:** The scoring engine only sees your technical answers. It has no access to PII (Name, Age, Gender), ensuring 100% objective technical evaluation.

---

## 4. Summary for Candidates
*   **Be Specific:** Mention tools, libraries, and "why" you made certain technical choices.
*   **Don't Panic on Probes:** If the AI asks a follow-up, it's a second chance! Nailing a probe is a high-signal of proficiency.
*   **Quality over Quantity:** One deep sentence is better than three paragraphs of "buzzwords."

---
*SkillPilot: Engineering with Integrity.*
