/**
 * Created by Rahul Sharma for Catalyst - Deccan AI Hackathon
 */
'use strict';

/**
 * Central State Management (Rule 1).
 * Zero DOM access.
 */
const blankState = () => ({
  apiKey: '',
  jd: '',
  resume: '',
  skills: [],
  currentIdx: 0,
  log: [],
  skillScores: [],
  plan: null,
  pdfText: null,
  isBusy: false,
  usedFallback: false
});

let state = blankState();

export const State = {
  get(key) { return state[key]; },
  set(key, value) { state[key] = value; },
  reset() { state = blankState(); },
  getAll() { return { ...state }; }
};
