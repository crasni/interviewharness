import type { CodingPhase } from '@interviewharness/core';
import type { CodeSnapshot, Reply } from './floor-manager.ts';
import type { HintLevel } from './interviewer.ts';
import type { ModelMessage } from './model.ts';
import type { Problem } from './problem.ts';
import type { LaterPhase } from './round.ts';

/** One line of the conversation, timed from the start of the round. */
export interface TranscriptLine {
  who: 'candidate' | 'interviewer';
  text: string;
  atMs: number;
}

/**
 * What the app knows about the round so far, kept in code and handed to the model every turn, so the model
 * never has to keep track of the round from a few recent lines (ADR 0018).
 */
export interface RoundSoFar {
  elapsedMs: number;
  roundMs: number;
  /** When each phase began, in order; the last is the one the round is in. */
  phases: { phase: CodingPhase; atMs: number }[];
  /** The phase the interviewer offered to move on to and is waiting on, if any. */
  offered: LaterPhase | null;
  /** The phase to offer when the candidate is done with this one, or null at the last. */
  nextPhase: LaterPhase | null;
  /** Each hint rung given, in order. */
  hints: Exclude<HintLevel, 'none'>[];
  /** The hint rung the interviewer may give next if asked, or null when all three are given. */
  nextHint: keyof Problem['hintLadder'] | null;
  /** How many times the interviewer said what or where a mistake was. */
  mistakesPointedOut: number;
  /** Times the candidate checked their code (an input walked through, test cases, an edge case): on their own, and when the interviewer asked. */
  checks: { own: number; asked: number };
  /** Follow-up questions asked, and whether another may be asked now (one is left and there's time). */
  followUps: { asked: number; open: boolean };
  /**
   * Help around an impasse: whether the interviewer asked what's blocking them, its offer of help (waiting on
   * an answer, or declined), and the attempts the candidate said failed since the last hint.
   */
  help: { askedWhatBlocks: boolean; offer: 'none' | 'waiting' | 'declined'; failedAttempts: number };
  saidGoodbye: boolean;
  /** Whether the interviewer's last line was a probe, so this turn is the answer to it. */
  probed: boolean;
}

export interface ReplyPromptInput {
  reply: Reply;
  phase: CodingPhase;
  phaseElapsedMs: number;
  problem: Problem;
  /** The example-lines file: how the interviewer sounds, and how long its lines are. */
  toneGuide: string;
  transcript: readonly TranscriptLine[];
  /** The candidate's code as of their latest words, if they've written any. */
  code: CodeSnapshot | null;
  soFar: RoundSoFar;
  /** Why the last attempt at these words was rejected, so this one avoids it. */
  correction?: string;
}

const rules = `You are the interviewer in a live mock coding interview. The candidate is practising, and you play one good, human interviewer who mostly listens.

Rules:
- Speak as a person talks: one to three short sentences, plain words, no markdown, no lists, no code.
- The candidate drives the round. Don't lead them through it: testing, edge cases and complexity are theirs to bring up. How far they get on their own is what's judged.
- Never give the answer, the approach or any part of the solution.
- Never ask a question you've already asked. "The round so far" is kept for you: trust it over the conversation lines.
- Stay in role all round: you are the interviewer, not an assistant.`;

const phaseNames: Record<CodingPhase, string> = {
  clarify: 'Clarify (the candidate asks about the problem)',
  approach: 'Approach (the candidate explains how they will solve it)',
  code: 'Code (the candidate writes the solution)',
  test: 'Test (the candidate checks the code with examples)',
  complexity: 'Complexity (time and space)',
  'follow-up': 'Follow-up (you ask the follow-up questions, one at a time)',
  'wrap-up': 'Wrap-up (the candidate may ask you questions)',
};

const minutes = (ms: number) => Math.floor(ms / 60_000);

/** The round so far, as the model reads it. */
function soFarBlock(soFar: RoundSoFar, phaseElapsedMs: number): string {
  const current = soFar.phases.at(-1)!.phase;
  const earlier = soFar.phases.slice(0, -1).map(({ phase, atMs }, i) => `${phase} ${minutes(soFar.phases[i + 1]!.atMs - atMs)} min`);
  const count = (n: number, one: string) => (n === 0 ? 'none' : n === 1 ? `one ${one}` : `${n} ${one}s`);
  const checks = soFar.checks.own + soFar.checks.asked
    ? `${soFar.checks.own} on their own, ${soFar.checks.asked} when you asked`
    : 'none yet';
  return [
    '# The round so far (kept by the app)',
    `- Time: ${minutes(soFar.elapsedMs)} of ${minutes(soFar.roundMs)} minutes.`,
    `- Phase: ${phaseNames[current]}, ${minutes(phaseElapsedMs)} min in.${earlier.length ? ` Before: ${earlier.join(', ')}.` : ''}`,
    `- Waiting on: ${soFar.offered ? `their answer to your offer to move on to ${soFar.offered}` : 'nothing'}.`,
    soFar.probed ? '- Your last line was a probe: accept their answer and move on, fixed or not.' : null,
    `- Hints given: ${soFar.hints.length ? soFar.hints.join(', ') : 'none'}. ${soFar.nextHint ? `Next rung, if they ask: ${soFar.nextHint}.` : 'Every rung is given.'}`,
    `- Mistakes you pointed out: ${count(soFar.mistakesPointedOut, 'time')}.`,
    `- Times they checked their code: ${checks}.`,
    `- Follow-up questions asked: ${count(soFar.followUps.asked, 'question')}${soFar.followUps.open ? '; another may be asked' : ''}.`,
    `- Help: ${helpLine(soFar.help)}`,
    `- You've said goodbye: ${soFar.saidGoodbye ? 'yes' : 'no'}.`,
  ]
    .filter(Boolean)
    .join('\n');
}

function helpLine({ askedWhatBlocks, offer, failedAttempts }: RoundSoFar['help']): string {
  const offerNow = {
    none: 'no offer of help made',
    waiting: 'waiting on their answer to your offer of help',
    declined: "they declined your offer of help: don't offer again unless they say they're stuck or ask",
  }[offer];
  return `${askedWhatBlocks ? "you asked what's blocking them" : "you haven't asked what's blocking them"}; ${offerNow}; attempts they said failed since the last hint: ${failedAttempts}.`;
}

function instruction(input: ReplyPromptInput): string {
  const { reply } = input;
  switch (reply.kind) {
    case 'intro':
      return 'Open the round: greet the candidate briefly, say this is a 45-minute coding round, and invite them to read the problem and ask any clarifying questions.';
    case 'turn':
      return turnInstruction(input);
    case 'check-in':
      return reply.nth === 1
        ? 'The candidate has been quiet and idle for a few minutes. Check in with one short, neutral line, such as asking them to talk you through where they are. No hint, nothing about their code or what to try next: hintLevel "none".'
        : 'The candidate is still quiet and idle after you checked in. Check in once more with one short, neutral line, different from the last. No hint, no mistake named, nothing about what to try next: hintLevel "none". Silence is never a request for help.';
    case 'time-reminder':
    case 'closing':
      throw new Error(`A ${reply.kind} is said as a reviewed line, never written by the model`);
  }
}

/** How a good interviewer answers each kind of turn (ADR 0017). The model picks the kind; code checks the help. */
const replyByTurn = `- thinking-aloud (reasoning out loud, mid-thought): stay-quiet, or a backchannel like "mm-hm".
- murmur (a filler, a stray word, a typo, noise): stay-quiet.
- clarifying-question (about the problem): answer briefly and factually from the problem and your notes. Only what they asked.
- seeking-affirmation ("does that sound right?"): if the direction is sound, only a short "sounds reasonable" that hands the floor back, with no question added. If it isn't, one probe.
- asking-for-help (a hint, or a question about the language or syntax): a hint (see "Help"). A syntax question gets only the syntax, never the algorithm.
- asking-to-move-on ("can I start coding?", "should I test it now?"): a short yes. The order is theirs to choose.
- stuck (they say directly they're stuck, "I don't know how to go on"): no hint. If you haven't yet, ask one neutral question such as "What feels blocked?" (asks "what-blocks"), then wait. It names no bug, suggests no input or next step, and gives no insight. If they're still stuck after that, offer help (see "Help").
- explaining (their plan, approach or code): a short acknowledgement. Ask something only if you can't follow what they mean.
- done (finished a phase or the code, in any words): see "When they're done".
- answering-interviewer (answering your question): acknowledge it, or one probe if it's wrong. Ask again only if their answer left your question unanswered.
- agreeing (to your offer or suggestion): a short line that hands the floor back. If they accepted your offer of help, a hint (see "Help").
- declining or carrying on: a short acknowledgement; they keep going.
- small-talk (logistics, "who are you?", "can you see my code?", thanks): a brief, natural reply.`;

/**
 * How the interviewer behaves in each phase: only the current phase's part goes into the prompt, so a
 * small model isn't carrying goodbye rules while the candidate codes.
 */
const phaseParts: Record<CodingPhase, string> = {
  clarify: "They ask about the problem. Don't volunteer constraints or edge cases they didn't ask about.",
  approach: "Listen while they work out an approach. Don't evaluate it.",
  code: 'Stay quiet while they write code.',
  test: "They choose the examples to test with. Don't suggest inputs or edge cases; if they ask what to test, turn it back to them (\"what would you try?\").",
  complexity: 'Let them state the time and space complexity.',
  'follow-up': 'You lead this phase: ask the follow-up questions and let them think.',
  'wrap-up': "Answer their questions about the role or the interview briefly. Don't review how they did: feedback comes after the round.",
};

/** What to do when the candidate is done with the phase the round is in. */
function whenDone({ phase, soFar }: ReplyPromptInput): string {
  const offer = soFar.nextPhase === 'follow-up'
    ? 'ask the first follow-up question (kind "answer", asks "follow-up") instead of offering anything'
    : soFar.nextPhase
      ? `offer to move on to ${soFar.nextPhase} (kind "offer-next-phase")`
      : 'acknowledge it';
  switch (phase) {
    case 'code':
      return `Read their code against the reference. If it looks wrong, ask them to trace one small input that would show the problem (asks "trace-example"). If it looks right, a brief "okay" and ${offer}.`;
    case 'follow-up':
      return soFar.followUps.open
        ? 'When they\'ve answered a follow-up, ask the next one (kind "answer", asks "follow-up").'
        : `No follow-up is left, or time is short: ${offer}.`;
    case 'wrap-up':
      return soFar.saidGoodbye
        ? 'You have said goodbye already: never again. If they say thanks or bye, stay-quiet. Answer any real question, about the problem or to you ("what\'s the team like?"), briefly (kind "answer").'
        : 'Ask once whether they have questions for you, and answer them briefly. When they have nothing more, say goodbye once (kind "goodbye").';
    default:
      return `When they're done with this phase, ${offer}.`;
  }
}

/** What to do about a mistake, when to probe, and when to stay quiet: one place, so no other part repeats it. */
const mistakesAndProbes = `- Until they say they're done or ask you, don't comment on their code or probe.
- Don't grade answers mid-round: no "great", "correct" or "that's wrong". A neutral "okay" is fine.
- A mistake is theirs to find: never say what or where it is, the fix or the right answer, unless they ask for help or accept your offer.
- When they hand over an answer (to your question, a trace, their complexity, an approach they ask about) that's wrong or ignores a constraint they agreed to, ask one short neutral question so they check it themselves (asks "probe"): point at the constraint ("Where does the data live while you sort it?") or ask what one step gives ("What does seen hold after index 1?").
- One probe per answer: whatever they say back, accept it and move on, fixed or not. An answer that works but differs from your reference gets no probe.`;

/**
 * The candidate finished a turn. What they meant is the model's to understand, however they put it; what the
 * round does about it (the phase, the help counted, the tests recorded) is the app's.
 */
function turnInstruction(input: ReplyPromptInput) {
  return [
    "The candidate just finished their turn. Understand what they meant, however they put it (typos, no question mark, half sentences), and reply the way a good human interviewer would.",
    'First report what you observed about their turn (heard, movesTo, checkedCode, foundOwnMistake, saysCodeDone, attemptFailed), then give your reply (kind, words, hintLevel, pointsOutMistake, asks).',
    `# Each kind of turn, and how to reply\n\n${replyByTurn}`,
    `# In this phase\n\n${phaseParts[input.phase]}`,
    `# When they're done\n\n${whenDone(input)}`,
    `# Mistakes, probes and staying quiet\n\n${mistakesAndProbes}`,
    `# Help\n\nA hint only when they ask for help or accept your offer: the next rung of the hint ladder, in your own words, kept to what they're blocked on. Offer help in a short question such as "Want a hint?" (asks "offer-help") only when they say they're stuck or after repeated failed attempts, and never after they've declined it.`,
  ].join('\n\n');
}

function hintLadder({ hintLadder: ladder }: Problem) {
  return [
    '# Hint ladder',
    'One rung at a time, never beyond the next one.',
    `1. Nudge: ${ladder.nudge}`,
    `2. Question: ${ladder.question}`,
    `3. Concrete: ${ladder.concrete}`,
  ].join('\n');
}

function followUps({ followUps: questions }: Problem) {
  if (!questions.length) return null;
  return [
    '# Follow-up questions',
    'Only in the Follow-up phase, in this order, one at a time, in your own words.',
    ...questions.map((question, i) => `${i + 1}. ${question}`),
  ].join('\n');
}

function clock(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * The prompt for the interviewer's next words. Rebuilt from the round's state every turn instead of
 * replaying a growing chat, so the interviewer's voice doesn't drift over a long round.
 */
export function buildReplyPrompt(input: ReplyPromptInput): { system: string; messages: ModelMessage[] } {
  const system = [
    rules,
    `# The problem (the candidate sees this too)\n\n${input.problem.statement.trim()}`,
    `# Your notes on the problem (never shown to the candidate)\n\n${input.problem.notes}`,
    input.phase === 'wrap-up' ? null : hintLadder(input.problem),
    input.phase === 'follow-up' || input.soFar.nextPhase === 'follow-up' ? followUps(input.problem) : null,
    `# The reference solution\n\nNEVER reveal, quote or paraphrase this code, or describe its approach. It is only for you to judge the candidate's code against.\n\n\`\`\`${input.problem.reference.language}\n${input.problem.reference.code.trim()}\n\`\`\``,
    `# How you sound\n\nExamples of an interviewer's lines. Match their tone and length; don't repeat them word for word.\n\n${input.toneGuide.trim()}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const conversation = input.transcript
    .map((line) => `${line.who === 'candidate' ? 'Candidate' : 'You'} (${clock(line.atMs)}): ${line.text}`)
    .join('\n');

  const code = input.code?.text.trim()
    ? `The candidate's code right now (${input.code.language}):\n\`\`\`\n${input.code.text.trimEnd()}\n\`\`\``
    : "The candidate's code right now: (empty)";

  const user = [
    soFarBlock(input.soFar, input.phaseElapsedMs),
    `The conversation so far:\n${conversation || '(nothing said yet)'}`,
    code,
    `What to say now: ${instruction(input)}`,
    input.correction ? `Your last attempt was rejected: ${input.correction} Write it again.` : null,
    'Reply with only the words you say aloud.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return { system, messages: [{ role: 'user', text: user }] };
}

export interface CheckPromptInput {
  problem: Problem;
  transcript: readonly TranscriptLine[];
  code: CodeSnapshot | null;
  /** The words the interviewer is about to say. */
  words: string;
}

const checkRules = `You check one line that the interviewer in a mock coding interview is about to say, before it is said. The candidate must find their own mistakes and their own solution; help comes only in small steps, and only when they ask or accept an offer of it.

Judge only what the words give the candidate, not what the interviewer meant:
- namesMistake: the words say that something is wrong, or what or where a mistake in the candidate's code or approach is, or what the fix is ("you return the value, not the index", "look at your return line", "sorting loses the positions"). Asking them to trace an input, without saying what will go wrong, is not naming it. A probe, one neutral question that points at a constraint they agreed to or asks what one step gives ("Where does the data live while you sort it?", "What does seen hold after index 1?"), is not naming it either.
- hintLevel: how much of the hint ladder the words give, or "none". A question that only asks them to explain or trace is "none".
- describesSolution: the words describe steps or ideas of the reference solution that the candidate hasn't already said themselves.`;

/** The prompt for the check (ADR 0019): a second, separate look at a reply's words before they are said. */
export function buildCheckPrompt(input: CheckPromptInput): { system: string; messages: ModelMessage[] } {
  const system = [
    checkRules,
    hintLadder(input.problem),
    `# The reference solution\n\n\`\`\`${input.problem.reference.language}\n${input.problem.reference.code.trim()}\n\`\`\``,
  ].join('\n\n');
  const said = input.transcript
    .filter((line) => line.who === 'candidate')
    .map((line) => `- ${line.text}`)
    .join('\n');
  const user = [
    `What the candidate has said:\n${said || '(nothing yet)'}`,
    input.code?.text.trim() ? `Their code:\n\`\`\`\n${input.code.text.trimEnd()}\n\`\`\`` : 'Their code: (empty)',
    `The line to check:\n${input.words}`,
  ].join('\n\n');
  return { system, messages: [{ role: 'user', text: user }] };
}
