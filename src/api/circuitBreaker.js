'use strict';

/**
 * Circuit Breaker for API calls (Rule 4).
 * Prevents UI crashes during AI failure/rate-limiting.
 */
const CB_FAILS_THRESHOLD = 3;
const CB_WINDOW_MS = 60000;
const CB_RESET_MS = 30000;

let fails = [];
let cbState = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
let openedAt = 0;

export const CircuitBreaker = {
  record(ok) {
    if (ok) {
      fails = [];
      if (cbState !== 'CLOSED') {
        cbState = 'CLOSED';
        return { reset: true };
      }
      return { reset: false };
    }

    const now = Date.now();
    fails = fails.filter(t => now - t < CB_WINDOW_MS);
    fails.push(now);

    if (fails.length >= CB_FAILS_THRESHOLD && cbState === 'CLOSED') {
      cbState = 'OPEN';
      openedAt = now;
      return { tripped: true, waitMs: CB_RESET_MS };
    }
    return { tripped: false };
  },

  canCall() {
    if (cbState === 'CLOSED') return true;
    if (cbState === 'OPEN') {
      if (Date.now() - openedAt >= CB_RESET_MS) {
        cbState = 'HALF_OPEN';
        return true;
      }
      return false;
    }
    return true; // HALF_OPEN allows one call
  },

  manualReset() {
    fails = [];
    cbState = 'CLOSED';
  },

  getState() {
    return {
      state: cbState,
      remainingMs: cbState === 'OPEN' ? Math.max(0, CB_RESET_MS - (Date.now() - openedAt)) : 0
    };
  }
};
