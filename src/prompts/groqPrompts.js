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
    `Score 1-5: 1-2=cannot do job, 3=borderline, 4-5=competent. Be strict.`,

  finalScore:
    `You are a senior hiring manager. Score each skill based ONLY on interview evidence.\n` +
    `Return ONLY valid JSON:\n{"scores":[{"skill":"name","score":3,"verdict":"Gap","note":"specific observation","questions_asked":2}]}\n` +
    `verdict must be exactly: Gap, Partial, or Strong. score 1-2=Gap, 3=Partial, 4-5=Strong.\n` +
    `Note must reference what was said (or not said). No generic comments.`,

  plan:
    `You are an elite career coach specialising in the Indian job market.\n` +
    `Return ONLY valid JSON:\n` +
    `{"plan":[{"skill":"name","priority":"High","time_estimate":"3-4 weeks","why_it_matters":"job-specific 1 sentence","resources":[{"name":"Search Topic","type":"Video|Course|Practice","platform":"YouTube|MDN|freeCodeCamp|Coursera"}],"weekly_goal":"specific measurable milestone"}]}\n` +
    `DO NOT generate direct URLs. Only provide high-quality Search Topics.\n` +
    `Use these platforms: YouTube, freeCodeCamp, Coursera, MDN, Kaggle, HackerRank, GeeksforGeeks.\n` +
    `Indian context: reference Swiggy/Zomato/Razorpay use-cases where relevant. Realistic timelines for working professionals.`,

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
      time_estimate: San.text(String(item.time_estimate || '2-3 weeks')),
      why_it_matters: San.text(String(item.why_it_matters || '')),
      resources: (item.resources || []).slice(0, 3).map(r => ({
        name: San.text(String(r.name || '')),
        type: San.text(String(r.type || 'Course')),
        platform: San.text(String(r.platform || 'YouTube')),
      })),
      weekly_goal: San.text(String(item.weekly_goal || '')),
    }));
  },
};
