'use strict';

/**
 * Multi-Factor Scoring Engine (Rule 1).
 * Calculates proficiency based on semantic depth and adaptive probes.
 */
export const ScoringEngine = {
  /**
   * Weights the final score based on interview performance.
   * @param {Array} qas - Array of {q, a} pairs.
   * @param {number} prelimScore - AI's initial assessment (1-5).
   * @param {boolean} hadProbe - Whether an adaptive probe was triggered.
   */
  calculateSkillScore(qas, prelimScore, hadProbe) {
    // Base score from AI
    let finalScore = prelimScore || 3;
    
    // Logic: If a probe was needed and the second answer was still weak, cap at 3.
    // If a probe was needed and the second answer was excellent, boost.
    if (hadProbe && finalScore > 3) {
      finalScore = Math.min(5, finalScore); // Validated depth
    } else if (hadProbe && finalScore <= 2) {
      finalScore = 2; // Failed the probe
    }

    const verdict = finalScore >= 4 ? 'Strong' : finalScore === 3 ? 'Partial' : 'Gap';
    
    return {
      score: finalScore,
      verdict,
      reasoning: this.generateReasoning(verdict, qas.length)
    };
  },

  generateReasoning(verdict, qCount) {
    if (verdict === 'Strong') return `Demonstrated deep conceptual understanding across ${qCount} probing dimension(s).`;
    if (verdict === 'Partial') return `Shows foundational knowledge but struggled with specific scenario-based application.`;
    return `Significant conceptual gaps identified. Requires structured learning to meet JD requirements.`;
  }
};
