'use strict';

import { State } from './state.js';
import { Prompts } from '../../prompts/groqPrompts.js';
import { AIProvider } from '../../adapters/aiProvider.js';
import { San } from '../../utils/sanitize.js';
import { ScoringEngine } from './scoring.js';

/**
 * Agent Orchestration Logic (Rule 1).
 * Zero DOM access.
 */
const CFG = {
  MAX_SKILLS: 6,
  BASE_Q: 1, // UX Optimization: Start with 1 question per skill
  MAX_PROBES: 1, // UX Optimization: Max 1 follow-up if answer is weak
  PROBE_THRESH: 3,
  MAX_JD: 5500,
  MAX_RESUME: 4800
};

export const Agent = {
  async extractSkills(jd, resume) {
    const raw = await AIProvider.getCompletion(
      State.get('apiKey'),
      [{ role: 'user', content: `JD:\n${San.clamp(jd, CFG.MAX_JD)}\n\nRESUME:\n${San.clamp(resume, CFG.MAX_RESUME)}` }],
      Prompts.skillExtract(CFG.MAX_SKILLS),
      true,
      450
    );
    const skills = Prompts.parseSkills(raw);
    State.set('skills', skills);
    State.set('log', skills.map(s => ({
      skill: s.name,
      required_level: s.required_level,
      qas: [],
      extraProbes: 0,
      prelimScore: null
    })));
    return skills;
  },

  async getNextQuestion() {
    const skills = State.get('skills');
    const idx = State.get('currentIdx');
    if (idx >= skills.length) return { done: true };

    const log = State.get('log')[idx];
    const skill = skills[idx];
    const qc = log.qas.length;

    // UX Optimization: If first answer was strong (score > 3), skip probe and move to next skill
    const isStrong = log.prelimScore !== null && log.prelimScore > CFG.PROBE_THRESH;
    const shouldProbe = log.prelimScore !== null && log.prelimScore <= CFG.PROBE_THRESH && log.extraProbes < CFG.MAX_PROBES;
    
    if (isStrong || (qc >= CFG.BASE_Q && !shouldProbe)) {
      State.set('currentIdx', idx + 1);
      return this.getNextQuestion();
    }

    const isProbe = qc >= CFG.BASE_Q && shouldProbe;
    const qNum = qc + 1;
    const prevQAs = log.qas.map(qa => `Q: ${qa.q}\nA: ${qa.a}`).join('\n\n');
    const qType = isProbe ? 'PROBE' : qNum === 1 ? 'OPENER' : 'DEPTH';

    const q = await AIProvider.getCompletion(
      State.get('apiKey'),
      [{
        role: 'user', content: `Skill: "${skill.name}" (required: ${skill.required_level})\nResume:\n${San.clamp(State.get('resume'), 600)}\n\n${prevQAs ? `Previous Q&A:\n${prevQAs}\n\n` : ''}Generate question ${qNum}.${isProbe ? ' Previous answer was weak — probe deeper.' : ''}`
      }],
      Prompts.question(qType),
      false,
      220
    );

    log.qas.push({ q: q.trim(), a: '' });
    if (isProbe) log.extraProbes++;

    return { done: false, question: q.trim(), skillName: skill.name, isProbe, qNum };
  },

  async processAnswer(answer) {
    const idx = State.get('currentIdx');
    const log = State.get('log')[idx];
    if (log && log.qas.length > 0) {
      log.qas[log.qas.length - 1].a = San.text(answer);
    }

    // Prelim score for adaptive probing - always score after an answer
    try {
      const raw = await AIProvider.getCompletion(
        State.get('apiKey'),
        [{ role: 'user', content: `Skill: "${log.skill}" (required: ${log.required_level})\nInterview:\n${log.qas.map(qa => `Q: ${qa.q}\nA: ${qa.a}`).join('\n\n')}` }],
        Prompts.prelimScore,
        true,
        80
      );
      log.prelimScore = Prompts.parsePrelim(raw);
    } catch (e) {
      log.prelimScore = 3; // Neutral fallback
    }
  },

  async finalizeAssessment() {
    const log = State.get('log');
    const payload = log.map(e => ({
      skill: e.skill,
      required_level: e.required_level,
      questions_asked: e.qas.length,
      interview: e.qas.map(qa => `Q: ${qa.q}\nA: ${qa.a}`).join('\n\n')
    }));

    try {
      const raw = await AIProvider.getCompletion(
        State.get('apiKey'),
        [{ role: 'user', content: `JD:\n${San.clamp(State.get('jd'), 700)}\n\nAssessment data:\n${JSON.stringify(payload, null, 2)}` }],
        Prompts.finalScore,
        true,
        1400
      );
      const aiScores = Prompts.parseFinal(raw);
      
      // Secondary logic layer: Merge AI scores with our robust ScoringEngine
      const finalScores = log.map((entry, i) => {
        const aiMatch = aiScores.find(s => s.skill === entry.skill) || aiScores[i];
        const engineResult = ScoringEngine.calculateSkillScore(entry.qas, aiMatch?.score, entry.extraProbes > 0);
        
        return {
          skill: entry.skill,
          score: engineResult.score,
          verdict: engineResult.verdict,
          note: aiMatch?.note || engineResult.reasoning,
          questions_asked: entry.qas.length
        };
      });

      State.set('skillScores', finalScores);
      return finalScores;
    } catch (e) {
      // Emergency fallback using only the engine
      const scores = log.map(e => {
        const result = ScoringEngine.calculateSkillScore(e.qas, e.prelimScore, e.extraProbes > 0);
        return {
          skill: e.skill,
          score: result.score,
          verdict: result.verdict,
          note: result.reasoning,
          questions_asked: e.qas.length
        };
      });
      State.set('skillScores', scores);
      State.set('usedFallback', true);
      return scores;
    }
  },

  async generateLearningPlan() {
    const sc = State.get('skillScores');
    const gaps = sc.filter(s => s.verdict !== 'Strong');
    if (!gaps.length) return [];

    try {
      const raw = await AIProvider.getCompletion(
        State.get('apiKey'),
        [{ role: 'user', content: `JD:\n${San.clamp(State.get('jd'), 600)}\n\nSkills to develop:\n${JSON.stringify(gaps, null, 2)}\n\nBackground:\n${San.clamp(State.get('resume'), 700)}` }],
        Prompts.plan,
        true,
        2300
      );
      const plan = Prompts.parsePlan(raw);
      State.set('plan', plan);
      return plan;
    } catch (e) {
      throw e; // Let UI handle fallback
    }
  }
};
