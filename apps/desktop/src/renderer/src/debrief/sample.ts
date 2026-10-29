import type { Verdict } from '@interviewharness/core';

export interface FeedbackPoint {
  /** When in the round it happened, as time since the round started. */
  atMs: number;
  text: string;
}

export interface Feedback {
  verdict: Verdict;
  why: string;
  wentWell: FeedbackPoint[];
  toFix: FeedbackPoint[];
}

/**
 * Sample feedback, so the debrief's layout can be judged before real grading exists.
 * From v0.1 the AI interviewer writes this from the round's transcript and code.
 */
export const sampleFeedback: Feedback = {
  verdict: 'Lean hire',
  why: 'Clear communication and a correct sliding-window idea, but the code was finished late and only tested on the happy path. With edge cases covered, this would be a hire.',
  wentWell: [
    { atMs: (2 * 60 + 10) * 1000, text: 'Asked whether readings can be negative and whether t can be 0 before designing anything.' },
    { atMs: (9 * 60 + 45) * 1000, text: 'Explained why a brute-force check of every stretch is O(n²) and moved to a sliding window unprompted.' },
    { atMs: (21 * 60 + 30) * 1000, text: 'Kept talking while coding, so the interviewer never had to guess what the code was meant to do.' },
  ],
  toFix: [
    { atMs: (18 * 60 + 5) * 1000, text: 'Spent several minutes recomputing the window maximum from scratch; keeping it in a deque gets it in O(1).' },
    { atMs: (31 * 60 + 20) * 1000, text: 'Tested only the first example. A one-reading list and t = 0 would have caught an off-by-one.' },
  ],
};
