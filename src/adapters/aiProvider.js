/**
 * Created by Rahul Sharma for Catalyst - Deccan AI Hackathon
 */
'use strict';

import { GroqClient } from '../api/groq.js';

/**
 * AI Provider Adapter (Rule 1).
 * Switching providers only requires rewriting this file.
 */
export const AIProvider = {
  async getCompletion(apiKey, messages, systemPrompt, useJson = false, maxTokens = 700) {
    return await GroqClient.call(apiKey, messages, systemPrompt, useJson, maxTokens);
  },

  parseResponse(raw) {
    return GroqClient.parseJson(raw);
  }
};
