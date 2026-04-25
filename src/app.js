'use strict';

import { State } from './core/logic/state.js';
import { Agent } from './core/logic/agent.js';
import { San } from './utils/sanitize.js';
import { PDF } from './utils/pdf.js';
import { Storage } from './utils/storage.js';
import { CircuitBreaker } from './api/circuitBreaker.js';

/**
 * UI Shell (Rule 1).
 * Handles DOM events, input reading, and rendering logic.
 */
const DOM = {
  get: id => document.getElementById(id),
  all: sel => document.querySelectorAll(sel),
  show: id => { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); },
  hide: id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); },
};

const UI = {
  showSection(name) {
    DOM.all('[data-section]').forEach(s => s.classList.remove('active'));
    const t = document.querySelector(`[data-section="${name}"]`);
    if (t) { t.classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  },

  updateStepper(active) {
    const LABELS = ['Setup', 'Assess', 'Results', 'Plan'];
    for (let i = 1; i <= 4; i++) {
      const c = DOM.get(`sc${i}`), l = DOM.get(`sl${i}`), n = DOM.get(`sline${i}`);
      [c, l].forEach(el => { el.removeAttribute('aria-current'); el.removeAttribute('data-done'); });
      if (n) n.removeAttribute('data-done');
      if (i < active) {
        c.setAttribute('data-done', 'true'); c.textContent = '✓';
        l.setAttribute('data-done', 'true'); if (n) n.setAttribute('data-done', 'true');
      } else if (i === active) {
        c.setAttribute('aria-current', 'step'); c.textContent = String(i);
        l.setAttribute('aria-current', 'step');
      } else {
        c.textContent = String(i);
      }
      l.textContent = LABELS[i - 1];
    }
  },

  showError(id, msg) {
    const el = DOM.get(id); if (!el) return;
    el.innerHTML = `<span aria-hidden="true">⚠️</span> ${San.esc(msg)}`;
    el.classList.add('visible');
    UI.show(id);
    setTimeout(() => { el.classList.remove('visible'); UI.hide(id); }, 8000);
  },

  show: id => DOM.get(id).style.display = 'flex', // Fallback for simple elements
  hide: id => DOM.get(id).style.display = 'none',

  toast(msg, ms = 2800) {
    const el = DOM.get('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), ms);
  },

  appendMsg(role, text, { skillTag = '', probeTag = false, fallbackTag = false } = {}) {
    const body = DOM.get('chatBody');
    const wrap = document.createElement('div'); wrap.className = `msg msg--${role === 'ai' ? 'ai' : 'user'}`;
    const av = document.createElement('div'); av.className = `msg__avatar msg__avatar--${role === 'ai' ? 'ai' : 'human'}`;
    av.setAttribute('aria-hidden', 'true'); av.textContent = role === 'ai' ? '🤖' : '👤';
    const bbl = document.createElement('div'); bbl.className = 'msg__bubble';
    if (skillTag) { const t = document.createElement('div'); t.className = 'msg__skill-tag'; t.textContent = `● ${skillTag.toUpperCase()}`; bbl.appendChild(t); }
    if (probeTag) { const t = document.createElement('div'); t.className = 'msg__probe-tag'; t.textContent = '↳ ADAPTIVE PROBE'; bbl.appendChild(t); }
    if (fallbackTag) { const t = document.createElement('div'); t.className = 'msg__fallback-tag'; t.textContent = '⚡ FALLBACK QUESTION'; bbl.appendChild(t); }
    const p = document.createElement('p'); p.textContent = text; bbl.appendChild(p);
    wrap.appendChild(av); wrap.appendChild(bbl); body.appendChild(wrap); body.scrollTop = body.scrollHeight;
  },

  showTyping() {
    const body = DOM.get('chatBody');
    const w = document.createElement('div'); w.className = 'msg msg--ai'; w.id = 'typingIndicator';
    w.innerHTML = `<div class="msg__avatar msg__avatar--ai" aria-hidden="true">🤖</div><div class="msg__bubble"><div class="typing-bubble" aria-hidden="true"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
    body.appendChild(w); body.scrollTop = body.scrollHeight;
  },

  hideTyping() { const el = DOM.get('typingIndicator'); if (el) el.remove(); },

  renderChips(skills, idx) {
    const c = DOM.get('skillChips'); c.innerHTML = '';
    skills.forEach((s, i) => {
      const ch = document.createElement('span');
      ch.className = 'chip' + (i < idx ? ' chip--done' : i === idx ? ' chip--active' : '');
      ch.textContent = s.name;
      c.appendChild(ch);
    });
    const done = Math.min(idx, skills.length), pct = skills.length > 0 ? Math.round((done / skills.length) * 100) : 0;
    DOM.get('skillProgressLabel').textContent = `${done} / ${skills.length}`;
    DOM.get('progressFill').style.width = pct + '%';
    DOM.get('progressTrack').setAttribute('aria-valuenow', pct);
  },

  updateCircuitBreaker() {
    const { state, remainingMs } = CircuitBreaker.getState();
    const banner = DOM.get('breakerBanner');
    if (state === 'OPEN') {
      banner.classList.add('visible');
      DOM.get('breakerCount').textContent = Math.ceil(remainingMs / 1000);
    } else {
      banner.classList.remove('visible');
    }
  }
};

// Event Handlers
const App = {
  async init() {
    UI.updateStepper(1);
    const savedKey = Storage.getKey();
    if (savedKey) {
      DOM.get('apiKey').value = savedKey;
      State.set('apiKey', savedKey);
      this.checkKey();
    }

    // Connect Circuit Breaker interval
    setInterval(() => UI.updateCircuitBreaker(), 1000);
  },

  checkKey() {
    const v = DOM.get('apiKey').value.trim(), ok = v.startsWith('gsk_') && v.length > 20;
    const el = DOM.get('keyStatus');
    el.textContent = ok ? 'READY' : 'MISSING';
    el.className = ok ? 'api-status api-status--ok' : 'api-status api-status--missing';
    State.set('apiKey', v);
    if (ok) Storage.saveKey(v);
  },

  async startAnalysis() {
    if (State.get('isBusy')) return;
    const jd = San.text(DOM.get('jdInput').value);
    const resume = !DOM.get('pastePanel').hasAttribute('hidden') ? San.text(DOM.get('resumeInput').value) : State.get('pdfText') || '';

    if (!State.get('apiKey').startsWith('gsk_')) { UI.showError('setupError', 'Valid Groq key required.'); return; }
    if (jd.length < 80) { UI.showError('setupError', 'JD too short.'); return; }
    if (resume.length < 80) { UI.showError('setupError', 'Resume too short or not uploaded.'); return; }

    State.set('jd', jd); State.set('resume', resume); State.set('isBusy', true);
    const btn = DOM.get('startBtn'); btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Extracting Skills…';

    try {
      const skills = await Agent.extractSkills(jd, resume);
      UI.showSection('assess'); UI.updateStepper(2); UI.renderChips(skills, 0);
      DOM.get('agentStatus').textContent = '● Preparing first question…';
      await this.askNext();
    } catch (e) {
      UI.showError('setupError', e.message);
      btn.disabled = false; btn.innerHTML = 'Analyse & Begin Assessment →';
    } finally { State.set('isBusy', false); }
  },

  async askNext() {
    const { done, question, skillName, isProbe, qNum } = await Agent.getNextQuestion();
    if (done) { await this.finishAssessment(); return; }

    DOM.get('chatFooter').style.display = 'none';
    UI.showTyping();
    DOM.get('agentStatus').textContent = `● Assessing: ${skillName}`;

    UI.hideTyping();
    UI.appendMsg('ai', question, { skillTag: qNum === 1 && !isProbe ? skillName : '', probeTag: isProbe });

    DOM.get('chatFooter').style.display = 'flex';
    DOM.get('userInput').value = '';
    DOM.get('userInput').focus();
  },

  async sendAnswer() {
    if (State.get('isBusy')) return;
    const input = DOM.get('userInput'), answer = San.text(input.value);
    if (!answer) return;

    State.set('isBusy', true);
    DOM.get('chatFooter').style.display = 'none';
    UI.appendMsg('user', answer);
    input.value = '';

    await Agent.processAnswer(answer);
    State.set('isBusy', false);
    await this.askNext();
  },

  async finishAssessment() {
    DOM.get('chatFooter').style.display = 'none';
    DOM.get('agentStatus').textContent = '● Analysing responses…';
    UI.showTyping();

    const scores = await Agent.finalizeAssessment();
    UI.hideTyping();
    UI.appendMsg('ai', `✅ Assessment complete.`);
    setTimeout(() => this.showResults(scores), 900);
  },

  showResults(scores) {
    UI.showSection('results'); UI.updateStepper(3);
    const strong = scores.filter(s => s.verdict === 'Strong').length;
    const partial = scores.filter(s => s.verdict === 'Partial').length;
    const gaps = scores.filter(s => s.verdict === 'Gap').length;
    const match = scores.length ? Math.round(((strong + partial * 0.5) / scores.length) * 100) : 0;

    DOM.get('summaryBanner').innerHTML =
      `<div class="summary-stat"><div class="summary-num">${match}%</div><div class="summary-label">JD MATCH</div></div><div class="summary-divider"></div><div class="summary-stat"><div class="summary-num" style="color:var(--accent2)">${strong}</div><div class="summary-label">STRONG</div></div><div class="summary-divider"></div><div class="summary-stat"><div class="summary-num" style="color:var(--accent3)">${partial}</div><div class="summary-label">DEVELOPING</div></div><div class="summary-divider"></div><div class="summary-stat"><div class="summary-num" style="color:var(--danger)">${gaps}</div><div class="summary-label">GAPS</div></div>`;

    const grid = DOM.get('resultsGrid'); grid.innerHTML = '';
    scores.forEach((s, i) => {
      const cls = s.verdict === 'Strong' ? 'strong' : s.verdict === 'Partial' ? 'partial' : 'gap';
      const dt = s.score >= 4 ? 'strong' : s.score === 3 ? 'partial' : 'gap';
      const dots = [1, 2, 3, 4, 5].map(d => `<div class="level-dot ${d <= s.score ? `level-dot--${dt}` : ''}"></div>`).join('');
      const card = document.createElement('div'); card.className = `skill-card skill-card--${cls}`;
      card.innerHTML = `<div class="skill-card__name">${San.esc(s.skill)}</div><div class="level-bar">${dots}</div><span class="verdict-badge verdict-badge--${cls}">${San.esc(s.verdict)} · ${s.score}/5</span><div class="skill-card__note">${San.esc(s.note)}</div>`;
      grid.appendChild(card);
    });
  },

  async generatePlan() {
    const btn = DOM.get('planBtn'); btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Generating…';
    try {
      const plan = await Agent.generateLearningPlan();
      UI.showSection('plan'); UI.updateStepper(4);
      this.renderPlan(plan);
    } catch (e) {
      UI.showError('planError', 'AI plan generation failed.');
      btn.disabled = false; btn.innerHTML = 'Generate Plan →';
    }
  },

  renderPlan(plan) {
    const c = DOM.get('planContainer'); c.innerHTML = '';
    if (!plan.length) {
      c.innerHTML = '<div class="card">All skills are Strong! No plan needed.</div>';
      return;
    }
    plan.forEach(item => {
      const div = document.createElement('div'); div.className = 'plan-item';
      div.innerHTML = `<div class="plan-item__header"><div class="plan-item__skill">${San.esc(item.skill)}</div><div class="plan-item__time">${San.esc(item.time_estimate)}</div></div><div class="plan-item__why">${San.esc(item.why_it_matters)}</div>`;
      c.appendChild(div);
    });
  },

  async handleFileUpload(file) {
    try {
      const { text, fileName, pageCount } = await PDF.extractText(file);
      State.set('pdfText', text);
      DOM.get('pdfStatus').textContent = `✅ Loaded ${fileName} (${pageCount} pages)`;
      DOM.get('pdfStatus').style.display = 'flex';
    } catch (e) {
      UI.showError('setupError', e.message);
    }
  }
};

// Bind to window for HTML access
window.App = App;
window.UI = UI;
window.CircuitBreaker = CircuitBreaker;

App.init();
