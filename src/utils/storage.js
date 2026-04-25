/**
 * Created by Rahul Sharma for Catalyst - Deccan AI Hackathon
 */
'use strict';

/**
 * Storage utility following the Sovereign Intelligence Protocol (Rule 1).
 * Abstracts direct localStorage/sessionStorage calls.
 */
const STORAGE_KEY = 'ss_groq_v3';

export const Storage = {
  saveKey(key) {
    if (key && key.startsWith('gsk_')) {
      sessionStorage.setItem(STORAGE_KEY, key);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  },

  getKey() {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  },

  clear() {
    sessionStorage.removeItem(STORAGE_KEY);
  }
};
