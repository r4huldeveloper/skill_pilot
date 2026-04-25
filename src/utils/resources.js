/**
 * Created by Rahul Sharma for Catalyst - Deccan AI Hackathon
 */
'use strict';

/**
 * Resource Guard (Zero-Hallucination Logic).
 * Constructs verified search links for trusted educational platforms.
 */
export const ResourceGuard = {
  PLATFORMS: {
    'YouTube': 'https://www.youtube.com/results?search_query=',
    'freeCodeCamp': 'https://www.google.com/search?q=site:freecodecamp.org+',
    'MDN': 'https://developer.mozilla.org/en-US/search?q=',
    'Coursera': 'https://www.coursera.org/search?query=',
    'GeeksforGeeks': 'https://www.geeksforgeeks.org/search?q=',
    'HackerRank': 'https://www.google.com/search?q=site:hackerrank.com+',
    'Kaggle': 'https://www.kaggle.com/search?q='
  },

  /**
   * Generates a bulletproof search link.
   */
  getLink(topic, platform) {
    const baseUrl = this.PLATFORMS[platform] || 'https://www.google.com/search?q=';
    const query = encodeURIComponent(`${topic} ${platform === 'YouTube' ? 'tutorial' : 'course'}`);
    return baseUrl + query;
  },

  /**
   * Sanitizes platform names to match whitelist.
   */
  normalizePlatform(raw) {
    const p = String(raw).trim();
    for (const key in this.PLATFORMS) {
      if (p.toLowerCase().includes(key.toLowerCase())) return key;
    }
    return 'YouTube'; // Safe default
  }
};
