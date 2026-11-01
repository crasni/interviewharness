// Pure domain types. No I/O, no imports from other packages.

export const ROUND_KINDS = ['coding', 'system-design', 'ai-assisted'] as const;
export type RoundKind = (typeof ROUND_KINDS)[number];

export const CODING_PHASES = ['clarify', 'approach', 'code', 'test', 'complexity', 'follow-up', 'wrap-up'] as const;
export type CodingPhase = (typeof CODING_PHASES)[number];

/** The interviewer's overall call at the end of a round, strongest first (GLOSSARY: Verdict). */
export const VERDICTS = ['Strong hire', 'Hire', 'Lean hire', 'Lean no hire', 'No hire', 'Strong no hire'] as const;
export type Verdict = (typeof VERDICTS)[number];

/** The four areas a coding round is scored on. Scores stay inside the app; the candidate sees words, not numbers. */
export const AREAS = ['problemSolving', 'coding', 'testing', 'communication'] as const;
export type Area = (typeof AREAS)[number];

/** A four-step scale: 1 weak, 2 mixed, 3 solid, 4 strong. */
export type AreaScore = 1 | 2 | 3 | 4;
export type AreaScores = Record<Area, AreaScore>;

/**
 * The fixed table from area scores to the verdict, so the same performance always gets the same call.
 * It reads the total (4 to 16) and the weakest area: a hire needs every area at least solid, and one
 * very weak area rules a hire out however strong the rest is.
 */
export function verdictFor(scores: AreaScores): Verdict {
  const values = AREAS.map((area) => scores[area]);
  const total = values.reduce((sum, score) => sum + score, 0);
  const weakest = Math.min(...values);
  if (total >= 15 && weakest >= 3) return 'Strong hire';
  if (total >= 12 && weakest >= 3) return 'Hire';
  if (total >= 10 && weakest >= 2) return 'Lean hire';
  if (total >= 8) return 'Lean no hire';
  if (total >= 6) return 'No hire';
  return 'Strong no hire';
}
