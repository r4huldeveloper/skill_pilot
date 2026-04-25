/**
 * Created by Rahul Sharma for Catalyst - Deccan AI Hackathon
 */
'use strict';

/**
 * Sanitization utility (Input/Output gates) following Rule 4.
 */
export const San = {
  /**
   * Input Gate: Strips control characters and normalizes line endings.
   */
  text: s => !s ? '' : String(s).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim(),

  /**
   * Clamps text length for API efficiency.
   */
  clamp: (s, n) => s.length > n ? s.slice(0, n) + '…' : s,

  /**
   * Output Gate: HTML-escapes text before DOM injection (XSS guard).
   */
  esc: s => !s ? '' : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
};
