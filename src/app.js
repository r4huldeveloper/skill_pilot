/**
 * Created by Rahul Sharma for Catalyst - Deccan AI Hackathon
 */
'use strict';

import { State } from './core/logic/state.js';
import { Agent } from './core/logic/agent.js';
import { San } from './utils/sanitize.js';
import { PDF } from './utils/pdf.js';
import { Storage } from './utils/storage.js';
import { CircuitBreaker } from './api/circuitBreaker.js';
import { ResourceGuard } from './utils/resources.js';
import { RunTests } from './tests.js';

const DOM = {
  get: id => document.getElementById(id),
  all: sel => document.querySelectorAll(sel),
};

const UI = {
  showSection(name) {
    DOM.all('[data-section]').forEach(s => s.classList.remove('active'));
    const t = document.querySelector(`[data-section="${name}"]`);
    if (t) { t.classList.add('active'); window.scrollTo(0,0); }
  },

  updateStepper(active) {
    for (let i = 1; i <= 4; i++) {
      const c = DOM.get(`sc${i}`), l = DOM.get(`sl${i}`), n = DOM.get(`sline${i}`);
      if (!c || !l) continue;
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
    }
  },

  showError(id, msg) {
    const el = DOM.get(id); if (!el) return;
    el.textContent = `⚠️ ${msg}`;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 8000);
  },

  show: id => DOM.get(id)?.classList.remove('hidden'),
  hide: id => DOM.get(id)?.classList.add('hidden'),

  appendMsg(role, text, { skillTag = '', probeTag = false } = {}) {
    const body = DOM.get('chatBody'); if (!body) return;
    const wrap = document.createElement('div'); wrap.className = `msg msg--${role === 'ai' ? 'ai' : 'user'}`;
    const bbl = document.createElement('div'); bbl.className = 'msg__bubble';
    
    if (skillTag || probeTag) { 
      const t = document.createElement('div'); 
      t.className = probeTag ? 'msg__probe-tag' : 'msg__skill-tag'; 
      t.textContent = probeTag ? '⚠️ ADAPTIVE PROBE' : `● ${skillTag.toUpperCase()}`; 
      bbl.appendChild(t); 
    }

    const p = document.createElement('p'); p.textContent = text; bbl.appendChild(p);
    wrap.innerHTML = `<div class="msg__avatar msg__avatar--${role === 'ai' ? 'ai' : 'human'}">${role === 'ai' ? '🤖' : '👤'}</div>`;
    wrap.appendChild(bbl); body.appendChild(wrap); body.scrollTop = body.scrollHeight;
  },

  showTyping() {
    const body = DOM.get('chatBody'); if (!body) return;
    const w = document.createElement('div'); w.className = 'msg msg--ai'; w.id = 'typingIndicator';
    w.innerHTML = `<div class="msg__avatar msg__avatar--ai">🤖</div><div class="msg__bubble"><div class="typing-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
    body.appendChild(w); body.scrollTop = body.scrollHeight;
  },

  hideTyping() { DOM.get('typingIndicator')?.remove(); },

  renderChips(skills, idx) {
    const c = DOM.get('skillChips'); if (!c) return;
    c.innerHTML = '';
    skills.forEach((s, i) => {
      const ch = document.createElement('span');
      ch.className = 'chip' + (i < idx ? ' chip--done' : i === idx ? ' chip--active' : '');
      ch.textContent = s.name;
      c.appendChild(ch);
    });
    const done = Math.min(idx, skills.length), pct = skills.length > 0 ? Math.round((done / skills.length) * 100) : 0;
    const label = DOM.get('skillProgressLabel');
    if (label) label.textContent = `${done} / ${skills.length}`;
    const fill = DOM.get('progressFill');
    if (fill) fill.style.width = pct + '%';
  },

  switchTab(tab) {
    if (tab === 'upload') {
      this.show('pdfUploadPanel'); this.hide('pastePanel');
      DOM.get('tabUpload')?.setAttribute('aria-selected', 'true');
      DOM.get('tabPaste')?.setAttribute('aria-selected', 'false');
    } else {
      this.show('pastePanel'); this.hide('pdfUploadPanel');
      DOM.get('tabPaste')?.setAttribute('aria-selected', 'true');
      DOM.get('tabUpload')?.setAttribute('aria-selected', 'false');
    }
  }
};

const App = {
  async init() {
    UI.updateStepper(1);
    const savedKey = Storage.getKey();
    if (savedKey) {
      DOM.get('apiKey').value = savedKey;
      State.set('apiKey', savedKey);
      this.checkKey();
    }
    setInterval(() => {
      const { state, remainingMs } = CircuitBreaker.getState();
      const b = DOM.get('breakerBanner');
      if (state === 'OPEN') {
        b?.classList.remove('hidden');
        const c = DOM.get('breakerCount'); if (c) c.textContent = Math.ceil(remainingMs / 1000);
      } else { b?.classList.add('hidden'); }
    }, 1000);

    // Sync Offline Banner with real browser state
    window.addEventListener('online', () => UI.hide('offlineBanner'));
    window.addEventListener('offline', () => UI.show('offlineBanner'));
  },

  checkKey() {
    const v = DOM.get('apiKey').value.trim(), ok = v.startsWith('gsk_') && v.length > 20;
    const el = DOM.get('keyStatus');
    if (el) {
      el.textContent = ok ? 'READY' : 'MISSING';
      el.className = ok ? 'api-status api-status--ok' : 'api-status api-status--missing';
    }
    State.set('apiKey', v);
    if (ok) Storage.saveKey(v);
  },

  async startAnalysis() {
    if (State.get('isBusy')) return;
    const jd = San.text(DOM.get('jdInput').value);
    const resume = !DOM.get('pastePanel').classList.contains('hidden') ? San.text(DOM.get('resumeInput').value) : State.get('pdfText') || '';

    if (!State.get('apiKey').startsWith('gsk_')) { UI.showError('setupError', 'Key required.'); return; }
    if (jd.length < 80 || resume.length < 80) { UI.showError('setupError', 'JD/Resume too short.'); return; }

    State.set('jd', jd); State.set('resume', resume); State.set('isBusy', true);
    const btn = DOM.get('startBtn'); btn.disabled = true; btn.innerHTML = 'Extracting Skills...';

    try {
      const skills = await Agent.extractSkills(jd, resume);
      UI.showSection('assess'); UI.updateStepper(2); UI.renderChips(skills, 0);
      await this.askNext();
    } catch (e) {
      UI.showError('setupError', e.message);
      btn.disabled = false; btn.innerHTML = 'Analyse & Begin Assessment →';
    } finally { State.set('isBusy', false); }
  },

  async askNext() {
    try {
      const { done, question, skillName, isProbe } = await Agent.getNextQuestion();
      if (done) { await this.finishAssessment(); return; }

      UI.renderChips(State.get('skills'), State.get('currentIdx'));
      UI.hide('chatFooter');
      UI.showTyping();
      DOM.get('agentStatus').textContent = `● Assessing: ${skillName}`;

      setTimeout(() => {
        UI.hideTyping();
        UI.appendMsg('ai', question, { skillTag: !isProbe ? skillName : '', probeTag: isProbe });
        UI.show('chatFooter');
        DOM.get('userInput').focus();
      }, 600);
    } catch (e) {
      UI.hideTyping();
      UI.appendMsg('ai', `⚠️ Error: ${e.message}`);
      UI.show('chatFooter');
    }
  },

  async sendAnswer() {
    if (State.get('isBusy')) return;
    const input = DOM.get('userInput'), answer = San.text(input.value);
    if (!answer) return;

    State.set('isBusy', true);
    UI.hide('chatFooter');
    UI.appendMsg('user', answer);
    input.value = '';

    try {
      await Agent.processAnswer(answer);
      State.set('isBusy', false);
      await this.askNext();
    } catch (e) {
      State.set('isBusy', false);
      UI.appendMsg('ai', `⚠️ Error: ${e.message}`);
      UI.show('chatFooter');
    }
  },

  async finishAssessment() {
    UI.hide('chatFooter');
    DOM.get('agentStatus').textContent = '● Finishing...';
    UI.showTyping();
    const scores = await Agent.finalizeAssessment();
    UI.hideTyping();
    UI.appendMsg('ai', `✅ Assessment complete.`);
    setTimeout(() => this.showResults(scores), 800);
  },

  showResults(scores) {
    UI.showSection('results'); UI.updateStepper(3);
    const strong = scores.filter(s => s.verdict === 'Strong').length;
    const match = scores.length ? Math.round((strong / scores.length) * 100) : 0;

    DOM.get('summaryBanner').innerHTML = `<div class="summary-stat"><div class="summary-num">${match}%</div><div class="summary-label">JD MATCH</div></div>`;

    const grid = DOM.get('resultsGrid'); grid.innerHTML = '';
    scores.forEach(s => {
      const cls = s.verdict.toLowerCase();
      const card = document.createElement('div'); card.className = `skill-card skill-card--${cls}`;
      card.innerHTML = `<div class="skill-card__name">${San.esc(s.skill)}</div><span class="verdict-badge verdict-badge--${cls}">${s.verdict} · ${s.score}/5</span><div class="skill-card__note" style="font-size:12px;margin-top:8px">${San.esc(s.note)}</div>`;
      grid.appendChild(card);
    });
  },

  async generatePlan() {
    const btn = DOM.get('planBtn'); btn.disabled = true; btn.innerHTML = 'Generating...';
    try {
      const plan = await Agent.generateLearningPlan();
      UI.showSection('plan'); UI.updateStepper(4);
      this.renderPlan(plan);
    } catch (e) {
      btn.disabled = false; btn.innerHTML = 'Generate Plan →';
    }
  },

  renderPlan(plan) {
    const c = DOM.get('planContainer'); c.innerHTML = '';
    plan.forEach(item => {
      const div = document.createElement('div'); div.className = 'plan-item';
      
      const focusHtml = item.focus_areas.length ? 
        `<div class="plan-focus"><strong>Focus:</strong> ${item.focus_areas.map(f => `<span>${San.esc(f)}</span>`).join(', ')}</div>` : '';
      
      const roadmapHtml = `<div class="plan-roadmap">${item.roadmap.map(r => `
        <div class="roadmap-step">
          <div class="roadmap-phase">${San.esc(r.phase)}</div>
          <div class="roadmap-task">${San.esc(r.task)}</div>
        </div>`).join('')}</div>`;

      let rHtml = '<div class="resource-list">' + item.resources.map(r => {
        const platform = ResourceGuard.normalizePlatform(r.platform);
        return `<a href="${ResourceGuard.getLink(r.name, platform)}" target="_blank" class="resource-link"><span class="resource-type-badge rtype--free">${platform}</span><span>${San.esc(r.name)}</span></a>`;
      }).join('') + '</div>';

      div.innerHTML = `
        <div class="plan-item__header">
          <div class="plan-item__skill">${San.esc(item.skill)}</div>
          <div class="plan-item__time">⏱️ ${San.esc(item.time_estimate)}</div>
        </div>
        ${focusHtml}
        ${roadmapHtml}
        <div style="font-size:12px;color:var(--text-dim);margin:12px 0 8px">Top Learning Resources:</div>
        ${rHtml}
      `;
      c.appendChild(div);
    });
  },

  async handleFileUpload(file) {
    try {
      const { text, fileName } = await PDF.extractText(file);
      State.set('pdfText', text);
      DOM.get('pdfStatus').textContent = `✅ Loaded ${fileName}`;
      DOM.get('pdfStatus').style.display = 'flex';
    } catch (e) {
      UI.showError('setupError', e.message);
    }
  }
};

window.App = App;
window.UI = UI;
window.RunTests = RunTests;
App.init();
