/**
 * Created by Rahul Sharma for Catalyst - Deccan AI Hackathon
 */
'use strict';

import { San } from './utils/sanitize.js';
import { Prompts } from './prompts/groqPrompts.js';
import { CircuitBreaker } from './api/circuitBreaker.js';

/**
 * Rule 6: Test Mandate.
 * Coverage for parsers, sanitizers, and circuit breaker.
 */
const Tests = {
  run() {
    console.group('🚀 Running Sovereign Protocol Tests...');
    this.testSanitize();
    this.testParsers();
    this.testCircuitBreaker();
    console.groupEnd();
    console.log('✅ All tests passed.');
  },

  assert(condition, message) {
    if (!condition) {
      console.error('❌ Assertion Failed: ' + message);
      throw new Error(message);
    }
    console.log('✔ ' + message);
  },

  testSanitize() {
    console.group('Testing Sanitization Gate');
    this.assert(San.text('  hello \n world  ') === 'hello \n world', 'San.text trims and normalizes');
    this.assert(San.esc('<div>') === '&lt;div&gt;', 'San.esc handles HTML tags');
    this.assert(San.clamp('12345', 3) === '123…', 'San.clamp truncates correctly');
    console.groupEnd();
  },

  testParsers() {
    console.group('Testing AI Response Parsers');
    
    // Skill Parser
    const skillRaw = '{"skills":[{"name":"JS","required_level":"advanced"}]}';
    const skills = Prompts.parseSkills(skillRaw);
    this.assert(skills[0].name === 'JS' && skills[0].required_level === 'advanced', 'Prompts.parseSkills works');

    // Score Parser
    const scoreRaw = '{"scores":[{"skill":"JS","score":4,"verdict":"Strong","note":"Good","questions_asked":2}]}';
    const scores = Prompts.parseFinal(scoreRaw);
    this.assert(scores[0].verdict === 'Strong' && scores[0].score === 4, 'Prompts.parseFinal works');

    // Prelim Parser fallback
    this.assert(Prompts.parsePrelim('Your score is 4') === 4, 'Prompts.parsePrelim handles unstructured text');
    console.groupEnd();
  },

  testCircuitBreaker() {
    console.group('Testing Circuit Breaker');
    CircuitBreaker.manualReset();
    this.assert(CircuitBreaker.canCall() === true, 'Breaker starts closed');
    
    CircuitBreaker.record(false);
    CircuitBreaker.record(false);
    CircuitBreaker.record(false);
    
    this.assert(CircuitBreaker.canCall() === false, 'Breaker trips after 3 failures');
    CircuitBreaker.manualReset();
    this.assert(CircuitBreaker.canCall() === true, 'Manual reset works');
    console.groupEnd();
  }
};

// Export for console access
window.RunTests = () => Tests.run();
console.log('🛠️ Sovereign Test Suite loaded. Run `RunTests()` to verify.');
