/**
 * Created by Rahul Sharma for Catalyst - Deccan AI Hackathon
 */
'use strict';

import { San } from '../utils/sanitize.js';
import { AIProvider } from '../adapters/aiProvider.js';

/**
 * Coupled Prompts & Parsers (Rule 5).
 * Zero DOM access.
 */
export const Prompts = {
  skillExtract: n =>
    `You are a senior technical recruiter. Extract the ${n} most critical assessable skills from the JD.\n` +
    `Return ONLY valid JSON:\n{"skills":[{"name":"Skill Name","required_level":"basic|intermediate|advanced"}]}\n` +
    `Max ${n} skills. Focus on skills verifiable through conversation. No preamble.`,

  question: type =>
    `You are a sharp technical interviewer assessing one skill at a time.\n` +
    `Question type: ${type}\nRules: ONE question only. Max 2 sentences. Conversational. No numbering. Return ONLY the question.`,

  prelimScore:
    `Score the candidate's answer. Return ONLY valid JSON: {"score":3}\n` +
    `Score 1-5: 1=does not know/refuses to answer/non-responsive, 2=wrong, 3=borderline, 4-5=competent.\n` +
    `STRICT RULE: If the answer is "I don't know", "no", or any variation of admitting lack of knowledge, score MUST be 1.`,

  finalScore:
    `You are a senior hiring manager. Score each skill based ONLY on interview evidence.\n` +
    `Return ONLY valid JSON:\n{"scores":[{"skill":"name","score":3,"verdict":"Gap","note":"specific observation","questions_asked":2}]}\n` +
    `STRICT EVIDENCE RULE: If there is zero evidence of proficiency (e.g. they said "I don't know"), the score MUST be 1.\n` +
    `Note must reference specific technical concepts mentioned. No generic praise.`,

  plan:
    `You are an elite career coach specialising in the Indian job market.\n` +
    `Return ONLY valid JSON:\n` +
    `{"plan":[{"skill":"name","priority":"High","time_estimate":"14 Days / 25 Hours","focus_areas":["Topic 1","Topic 2"],"roadmap":[{"phase":"Phase 1","task":"Goal"}],"resources":[{"name":"Search Topic","type":"Video|Course|Practice","platform":"YouTube|MDN|freeCodeCamp|Coursera"}]}]}\n` +
    `Timeline: Be precise (e.g., '12 Days', '4 Weeks'). Breakdown the roadmap into clear phases.\n` +
    `Focus Areas: List 2-3 specific technical sub-topics to master.\n` +
    `Indian context: Reference Swiggy/Zomato/Razorpay use-cases.`,

  parseSkills(raw) {
    const p = AIProvider.parseResponse(raw);
    const arr = p.skills || (Array.isArray(p) ? p : null);
    if (!arr || !arr.length) throw new Error('No skills extracted.');
    return arr.slice(0, 6).map(s => ({
      name: San.text(String(s.name || 'Unknown')),
      required_level: ['basic', 'intermediate', 'advanced'].includes(s.required_level) ? s.required_level : 'intermediate',
    }));
  },

  parsePrelim(raw) {
    try {
      const p = AIProvider.parseResponse(raw);
      const sc = Number(p.score);
      if (sc >= 1 && sc <= 5) return sc;
    } catch (_) { }
    const m = raw.match(/score["\s:]+(\d)/i);
    return m ? Math.min(5, Math.max(1, Number(m[1]))) : 3;
  },

  parseFinal(raw) {
    const p = AIProvider.parseResponse(raw);
    const arr = p.scores || (Array.isArray(p) ? p : null);
    if (!arr) throw new Error('Invalid scores from model.');
    const vmap = sc => sc >= 4 ? 'Strong' : sc === 3 ? 'Partial' : 'Gap';
    return arr.map(s => ({
      skill: San.text(String(s.skill || '')),
      score: Math.min(5, Math.max(1, Number(s.score) || 3)),
      verdict: ['Gap', 'Partial', 'Strong'].includes(s.verdict) ? s.verdict : vmap(Number(s.score) || 3),
      note: San.text(String(s.note || 'Assessment completed.')),
      questions_asked: Number(s.questions_asked) || 0,
    }));
  },

  parsePlan(raw) {
    const p = AIProvider.parseResponse(raw);
    const arr = p.plan || (Array.isArray(p) ? p : null);
    if (!arr) throw new Error('Invalid plan from model.');
    return arr.map(item => ({
      skill: San.text(String(item.skill || '')),
      priority: ['High', 'Medium'].includes(item.priority) ? item.priority : 'Medium',
      time_estimate: San.text(String(item.time_estimate || '14 Days')),
      focus_areas: (item.focus_areas || []).map(f => San.text(f)),
      roadmap: (item.roadmap || []).map(r => ({
        phase: San.text(r.phase),
        task: San.text(r.task)
      })),
      resources: (item.resources || []).slice(0, 3).map(r => ({
        name: San.text(String(r.name || '')),
        type: San.text(String(r.type || 'Course')),
        platform: San.text(String(r.platform || 'YouTube')),
      }))
    }));
  },
};
