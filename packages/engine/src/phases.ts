import type { CodingPhase } from '@interviewharness/core';
import { codingPhaseShares, type LaterPhase, nextPhase, type Round } from './round.ts';

/** Timing rules for moving between phases, in milliseconds. Fixed defaults (ADR 0014). */
export const phaseRules = {
  /** After "not yet", the wait before suggesting again; it doubles with each "not yet" in the same phase. */
  suggestAgainAfter: 2 * 60_000,
  /** A suggestion nobody answers is withdrawn after this long, and counts as "not yet". */
  suggestionExpiresAfter: 60_000,
};

/** Why the interviewer might offer to move on. */
export type MoveOnCue = 'none' | 'quiet-after-turn' | 'candidate-said-done';

export interface PhaseState {
  phase: CodingPhase;
  phaseElapsedMs: number;
  /** The phase the interviewer has offered to move to and is waiting on, if any. */
  suggestedPhase: LaterPhase | null;
  /** How many times the candidate has said "not yet" in this phase. */
  notYets: number;
  /** How long until the interviewer may suggest again (0 if it may now). */
  suggestAgainInMs: number;
}

/**
 * Leads the round through its phases: offers to move on when a phase runs long or the candidate
 * seems done, waits for their answer, and backs off after "not yet". Never moves on by itself.
 */
export function createPhaseGuide(round: Round) {
  let suggested: LaterPhase | null = null;
  let suggestedAt = 0;
  let notYets = 0;
  let suggestAllowedAt = -Infinity;

  return {
    get suggested() {
      return suggested;
    },

    /** The phase to offer now, or null. Saying "I'm done" outright skips the back-off wait. */
    toOffer(now: number, cue: MoveOnCue): LaterPhase | null {
      const { phase, phaseElapsedMs } = round.snapshot();
      const next = nextPhase(phase);
      if (!next || suggested) return null;
      if (cue === 'candidate-said-done') return next;
      if (now < suggestAllowedAt) return null;
      const ranLong = phaseElapsedMs >= codingPhaseShares[phase];
      return ranLong || cue === 'quiet-after-turn' ? next : null;
    },

    offer(next: LaterPhase, now: number) {
      suggested = next;
      suggestedAt = now;
    },

    /** Whether a pending suggestion has gone unanswered for too long. */
    expired(now: number) {
      return suggested !== null && now - suggestedAt >= phaseRules.suggestionExpiresAfter;
    },

    notYet(now: number) {
      suggested = null;
      notYets += 1;
      suggestAllowedAt = now + phaseRules.suggestAgainAfter * 2 ** (notYets - 1);
    },

    /** Moves to the suggested phase. Returns it, or null if nothing was suggested. */
    accept(): LaterPhase | null {
      if (!suggested) return null;
      round.advancePhase();
      const phase = suggested;
      suggested = null;
      notYets = 0;
      suggestAllowedAt = -Infinity;
      return phase;
    },

    state(now: number): PhaseState {
      const { phase, phaseElapsedMs } = round.snapshot();
      return {
        phase,
        phaseElapsedMs,
        suggestedPhase: suggested,
        notYets,
        suggestAgainInMs: Math.max(0, suggestAllowedAt - now),
      };
    },
  };
}

export type PhaseGuide = ReturnType<typeof createPhaseGuide>;
