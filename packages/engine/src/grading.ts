import { AREAS, type Area, type AreaScore, type AreaScores, type CodingPhase, type Verdict, verdictFor } from '@interviewharness/core';
import type { CodeSnapshot } from './floor-manager.ts';
import type { HintLevel, InterviewerAsk } from './interviewer.ts';
import type { Model, ModelIdentity, ObjectSchema } from './model.ts';
import type { Problem } from './problem.ts';

/** One line of the round's conversation, with an id the grader can cite as evidence. */
export interface RecordLine {
  id: string;
  who: 'candidate' | 'interviewer';
  text: string;
  atMs: number;
}

/** What a finished round leaves for grading: the conversation, when each phase began, the hints given and the final code. */
export interface RoundRecord {
  elapsedMs: number;
  transcript: RecordLine[];
  phases: { phase: CodingPhase; atMs: number }[];
  /** Each hint rung given, in order. */
  hints: Exclude<HintLevel, 'none'>[];
  /** Each time the candidate checked their code (an input walked through, test cases, an edge case), and who started it. */
  checks: { lineId: string; by: 'candidate' | 'interviewer' }[];
  /**
   * Each mistake in the candidate's code or approach that was found, and how: by the candidate on their own, by the
   * candidate on a check the interviewer asked for, by the candidate right after the interviewer's probe, or pointed
   * out by the interviewer.
   */
  mistakes: { lineId: string; foundBy: 'candidate' | 'candidate-when-asked' | 'candidate-after-probe' | 'interviewer' }[];
  /** The candidate's lines that said their code was done (not just an explanation or a step finished). */
  codeDone: string[];
  /** What the interviewer's lines asked the candidate to do, when they asked anything. */
  asked: { lineId: string; asks: Exclude<InterviewerAsk, 'nothing'> }[];
  code: CodeSnapshot | null;
}

/** Facts about a round, worked out in code so the grader never has to guess them. */
export interface RoundFacts {
  phasesReached: CodingPhase[];
  timeInPhaseMs: Partial<Record<CodingPhase, number>>;
  hints: Exclude<HintLevel, 'none'>[];
  deepestHint: HintLevel;
  /** Checked their code at all, on their own or when asked. */
  tested: boolean;
  /** Checked their code on their own initiative, not because the interviewer asked. */
  testedOnOwn: boolean;
  /**
   * Said their code was done with a mistake still in it, which only the interviewer's check or words brought out
   * afterwards. Help with a bug asked for before any "done" is help, not finished work with a missed bug, and a
   * mistake they found right after a probe is one they caught, not a missed bug.
   */
  doneWithMissedBug: boolean;
}

export interface FeedbackPoint {
  text: string;
  /** When in the round its evidence happened. */
  atMs: number;
}

/** The written assessment of a round. Area scores are kept for the record; the candidate sees only words. */
export interface GradedFeedback {
  verdict: Verdict;
  why: string;
  wentWell: FeedbackPoint[];
  toFix: FeedbackPoint[];
  areas: Record<Area, { score: AreaScore; evidence: string[] }>;
  /** Each grading sample as the grader gave it, and after unknown evidence was dropped and caps applied. For replay. */
  samples: { given: Graded; checked: Graded }[];
  /** Written by a small model, so to be taken roughly. */
  rough: boolean;
  model: ModelIdentity;
}

const hintOrder: HintLevel[] = ['none', 'nudge', 'question', 'concrete'];

/** The highest problem-solving score left after each hint rung: every rung asked for costs more. */
const problemSolvingCap: Record<HintLevel, AreaScore> = { none: 4, nudge: 3, question: 2, concrete: 1 };
/**
 * The highest testing scores when the candidate never checked their code on their own. Interviewers expect the
 * candidate to start the checking (docs/research/11-testing-expectations.md): code never checked is mixed at
 * best, and saying "done" with a bug they never caught is weak.
 */
const notSelfTestedCap: AreaScore = 2;
const missedBugCap: AreaScore = 1;
/** How many times the round is graded; the median per area stands in for a low temperature, which some plans reject. */
const gradingSamples = 3;

/**
 * Words that check the code against concrete values: "let me trace [5, 1, 5]", "walking through with target 10",
 * "test case: [3, 3] gives [0, 1]", "for an empty list it returns []". A backstop for what the model's books missed.
 */
const checksTheCode = (text: string) =>
  /\b(trac(e|ing)|walk(ing)? (it |this |that )?through|dry.?run|step(ping)? through|test(ing)? (it |this )?(case|with|on)|edge case|for (an? )?(empty|input|example))\b/i.test(text) &&
  /\d|\[/.test(text);

export function roundFacts(record: RoundRecord): RoundFacts {
  const timeInPhaseMs: RoundFacts['timeInPhaseMs'] = {};
  record.phases.forEach(({ phase, atMs }, i) => {
    const end = record.phases[i + 1]?.atMs ?? record.elapsedMs;
    timeInPhaseMs[phase] = (timeInPhaseMs[phase] ?? 0) + (end - atMs);
  });
  // A phase gone back to (Code again, to fix a bug) counts once; its time adds up.
  const phasesReached = [...new Set(record.phases.map((p) => p.phase))];
  const askedFor = new Set(record.checks.filter((t) => t.by === 'interviewer').map((t) => t.lineId));
  const candidateChecks = record.transcript.filter((line) => line.who === 'candidate' && checksTheCode(line.text));
  const order = new Map(record.transcript.map((line, i) => [line.id, i]));
  const firstDone = Math.min(...record.codeDone.map((id) => order.get(id) ?? Infinity));
  return {
    phasesReached,
    timeInPhaseMs,
    hints: record.hints,
    deepestHint: record.hints.reduce<HintLevel>((deepest, hint) => (hintOrder.indexOf(hint) > hintOrder.indexOf(deepest) ? hint : deepest), 'none'),
    tested: record.checks.length > 0 || candidateChecks.length > 0,
    // The interviewer's book says who started each trace; a trace in words it missed counts as their own.
    testedOnOwn: record.checks.some((t) => t.by === 'candidate') || candidateChecks.some((line) => !askedFor.has(line.id)),
    doneWithMissedBug: record.mistakes.some(
      (m) => (m.foundBy === 'candidate-when-asked' || m.foundBy === 'interviewer') && (order.get(m.lineId) ?? -Infinity) > firstDone,
    ),
  };
}

export type Graded = Record<Area, { score: AreaScore; evidence: string[] }>;

/** A grading, as events.jsonl records it: how the verdict was reached, or why it wasn't. Never a credential. */
export interface GradingEntry {
  at: number;
  grading: {
    model: ModelIdentity;
    ms: number;
    outcome: 'written' | 'failed';
    error?: string;
    verdict?: Verdict;
    samples?: GradedFeedback['samples'];
  };
}

const scoreSchema = {
  type: 'object',
  properties: {
    score: { type: 'integer', minimum: 1, maximum: 4 },
    evidence: { type: 'array', items: { type: 'string' }, description: 'Ids of the transcript lines that show it.' },
  },
  required: ['score', 'evidence'],
  additionalProperties: false,
};

const gradingSchema: ObjectSchema<Graded> = {
  name: 'grade',
  jsonSchema: {
    type: 'object',
    properties: Object.fromEntries(AREAS.map((area) => [area, scoreSchema])),
    required: [...AREAS],
    additionalProperties: false,
  },
  parse(value) {
    const graded = (value ?? {}) as Record<string, { score?: unknown; evidence?: unknown }>;
    return Object.fromEntries(
      AREAS.map((area) => {
        const { score, evidence } = graded[area] ?? {};
        if (![1, 2, 3, 4].includes(score as number) || !Array.isArray(evidence) || !evidence.every((id) => typeof id === 'string')) {
          throw new Error(`${area} needs a score from 1 to 4 and a list of evidence ids`);
        }
        return [area, { score: score as AreaScore, evidence: evidence as string[] }];
      }),
    ) as Graded;
  },
};

interface Prose {
  why: string;
  wentWell: { text: string; evidence: string }[];
  toFix: { text: string; evidence: string }[];
}

const pointsSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: { text: { type: 'string' }, evidence: { type: 'string', description: 'The id of the transcript line it rests on.' } },
    required: ['text', 'evidence'],
    additionalProperties: false,
  },
};

const proseSchema: ObjectSchema<Prose> = {
  name: 'write_feedback',
  jsonSchema: {
    type: 'object',
    properties: { why: { type: 'string' }, wentWell: pointsSchema, toFix: pointsSchema },
    required: ['why', 'wentWell', 'toFix'],
    additionalProperties: false,
  },
  parse(value) {
    const { why, wentWell, toFix } = (value ?? {}) as Record<string, unknown>;
    const points = (list: unknown) =>
      Array.isArray(list) && list.every((p) => typeof p?.text === 'string' && typeof p?.evidence === 'string');
    if (typeof why !== 'string' || !points(wentWell) || !points(toFix)) {
      throw new Error('Expected { why: string, wentWell: [{ text, evidence }], toFix: [{ text, evidence }] }');
    }
    return { why, wentWell: wentWell as Prose['wentWell'], toFix: toFix as Prose['toFix'] };
  },
};

const foundBy: Record<RoundRecord['mistakes'][number]['foundBy'], string> = {
  candidate: 'by the candidate on their own',
  'candidate-when-asked': 'by the candidate, on a check the interviewer asked for',
  'candidate-after-probe': "by the candidate, right after the interviewer's probe",
  interviewer: 'pointed out by the interviewer',
};

/** Lines from the round's books, grouped by what they were: "on their own t15; when the interviewer asked t13". */
function lineList<T extends { lineId: string }>(entries: T[], group: (entry: T) => string) {
  if (!entries.length) return 'none';
  const groups = new Map<string, string[]>();
  for (const entry of entries) groups.set(group(entry), [...(groups.get(group(entry)) ?? []), entry.lineId]);
  return [...groups].map(([name, ids]) => `${name} ${ids.join(', ')}`).join('; ');
}

const clock = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

/** What every grading prompt says about the round: the problem, the facts, the conversation and the final code. */
function roundForPrompt(problem: Problem, record: RoundRecord, facts: RoundFacts) {
  const minutes = (ms = 0) => `${Math.round(ms / 60_000)} min`;
  return [
    `# The problem\n\n${problem.statement.trim()}`,
    `# The reference solution (to judge the code by)\n\n\`\`\`${problem.reference.language}\n${problem.reference.code.trim()}\n\`\`\``,
    [
      '# Facts, worked out from the round',
      `Length: ${minutes(record.elapsedMs)}.`,
      `Phases reached: ${facts.phasesReached.map((p) => `${p} (${minutes(facts.timeInPhaseMs[p])})`).join(', ')}.`,
      `Hints the candidate asked for: ${facts.hints.length ? facts.hints.join(', ') : 'none'}.`,
      `Checked their code: ${facts.tested ? 'yes' : 'no'}. On their own: ${facts.testedOnOwn ? 'yes' : 'no'}.`,
      `Times they checked their code: ${lineList(record.checks, (t) => (t.by === 'candidate' ? 'on their own' : 'when the interviewer asked'))}.`,
      `Mistakes found in their code or approach: ${lineList(record.mistakes, (m) => foundBy[m.foundBy])}.`,
      `Said their code was done: ${record.codeDone.join(', ') || 'never'}.`,
      `The interviewer asked for: ${lineList(record.asked, (a) => a.asks)}.`,
    ].join('\n'),
    `# The conversation (id, time, who: words)\n\n${record.transcript.map((l) => `${l.id} ${clock(l.atMs)} ${l.who}: ${l.text}`).join('\n') || '(nothing was said)'}`,
    `# The candidate's final code\n\n${record.code?.text.trim() ? `\`\`\`${record.code.language}\n${record.code.text.trimEnd()}\n\`\`\`` : '(empty)'}`,
  ].join('\n\n');
}

const graderRules = `You grade a mock coding interview the way a fair, experienced interviewer would. Score each area on a four-step scale: 1 weak, 2 mixed, 3 solid, 4 strong.
- Problem solving: understanding the problem, finding and justifying an approach, and answering any follow-up questions.
- Coding: correct, clear code that matches the approach.
- Testing: checking the code themselves (walking an input through it, test cases with expected results, edge cases), and finding their own bugs. A check the interviewer asked for counts for little. Correct code never checked is mixed, not weak; saying "done" with a bug they never caught is weak.
- Communication: explaining their thinking, asking good questions, taking input.
The candidate types their words for now: ignore typos, spelling and terse phrasing. Lines about the mock itself ("who are you?", "can I start?") aren't graded.
The facts say who started each trace and who found each mistake: credit the candidate only for what they started.
Cite as evidence the ids of the conversation lines that show each score. Cite only ids that appear in the conversation.`;

const writerRules = `You write the feedback a candidate reads after a mock coding interview: honest, specific and kind, in plain words, addressed to them as "you".
- "why" is two or three sentences explaining the verdict.
- Two to four points of what went well and two to four of what to fix, each one sentence, each resting on one conversation line, cited by its id.
- Never mention scores, numbers or a scale.
- If they asked for hints, say so in words where it matters, without counting them.
- Never credit them for a test or a find the interviewer started; the facts say who started each.
- Typos, spelling and lines about the mock itself are not feedback.`;

/**
 * Grades a finished round: three structured grading samples, unknown evidence dropped, a score with no
 * evidence lowered, caps for hints and testing applied in code, the median per area, the verdict from the
 * fixed table, then one call that writes it up. Fails as a whole, so it can simply be tried again.
 */
export async function gradeRound({
  model,
  problem,
  record,
  rough,
  signal,
}: {
  model: Model;
  problem: Problem;
  record: RoundRecord;
  rough: boolean;
  signal?: AbortSignal;
}): Promise<GradedFeedback> {
  const facts = roundFacts(record);
  const round = roundForPrompt(problem, record, facts);
  const ids = new Set(record.transcript.map((line) => line.id));

  const samples = await Promise.all(
    Array.from({ length: gradingSamples }, () =>
      model
        .generateObject({ purpose: 'grading', system: graderRules, messages: [{ role: 'user', text: `${round}\n\nGrade the round.` }], schema: gradingSchema, signal })
        .then(({ object }) => ({ given: object, checked: checked(object, ids, facts) })),
    ),
  );
  const areas = Object.fromEntries(
    AREAS.map((area) => {
      const scores = samples.map((s) => s.checked[area]).sort((a, b) => a.score - b.score);
      return [area, scores[Math.floor(scores.length / 2)]!];
    }),
  ) as Graded;
  const verdict = verdictFor(Object.fromEntries(AREAS.map((area) => [area, areas[area].score])) as AreaScores);

  const scored = AREAS.map((area) => `${area}: ${areas[area].score} (evidence: ${areas[area].evidence.join(', ') || 'none'})`).join('\n');
  const { object: prose } = await model.generateObject({
    purpose: 'feedback-prose',
    system: writerRules,
    messages: [{ role: 'user', text: `${round}\n\n# The grade\n\nVerdict: ${verdict}\n${scored}\n\nWrite the feedback.` }],
    schema: proseSchema,
    signal,
  });
  const atMs = new Map(record.transcript.map((line) => [line.id, line.atMs]));
  const timed = (points: Prose['wentWell']) =>
    points.flatMap(({ text, evidence }) => (atMs.has(evidence) ? [{ text, atMs: atMs.get(evidence)! }] : []));

  return { verdict, why: prose.why, wentWell: timed(prose.wentWell), toFix: timed(prose.toFix), areas, samples, rough, model: model.identity };
}

/** One sample made trustworthy: evidence that names no line dropped, a score left without evidence lowered, caps applied. */
function checked(sample: Graded, ids: Set<string>, facts: RoundFacts): Graded {
  const caps: Partial<Record<Area, AreaScore>> = { problemSolving: problemSolvingCap[facts.deepestHint] };
  if (!facts.testedOnOwn) caps.testing = facts.doneWithMissedBug ? missedBugCap : notSelfTestedCap;
  return Object.fromEntries(
    AREAS.map((area) => {
      const evidence = sample[area].evidence.filter((id) => ids.has(id));
      let score = evidence.length ? sample[area].score : Math.max(1, sample[area].score - 1);
      score = Math.min(score, caps[area] ?? 4);
      return [area, { score: score as AreaScore, evidence }];
    }),
  ) as Graded;
}
