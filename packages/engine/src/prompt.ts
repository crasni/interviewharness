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
  saidGoodbye: boolean;
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
- Never give the answer, the approach or any part of the solution. Never say what or where a mistake is unless they ask you for help.
- Comment on their code only when they say they're done, or ask you about it directly.
- Don't grade ideas while the round is going on: no "great", "correct" or "that's wrong". A neutral "okay" or "sounds reasonable" is fine.
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
    `- Hints given: ${soFar.hints.length ? soFar.hints.join(', ') : 'none'}. ${soFar.nextHint ? `Next rung, if they ask: ${soFar.nextHint}.` : 'Every rung is given.'}`,
    `- Mistakes you pointed out: ${count(soFar.mistakesPointedOut, 'time')}.`,
    `- Times they checked their code: ${checks}.`,
    `- Follow-up questions asked: ${count(soFar.followUps.asked, 'question')}${soFar.followUps.open ? '; another may be asked' : ''}.`,
    `- You've said goodbye: ${soFar.saidGoodbye ? 'yes' : 'no'}.`,
  ].join('\n');
}

function instruction(input: ReplyPromptInput): string {
  const { reply, soFar } = input;
  switch (reply.kind) {
    case 'intro':
      return 'Open the round: greet the candidate briefly, say this is a 45-minute coding round, and invite them to read the problem and ask any clarifying questions.';
    case 'turn':
      return turnInstruction(input);
    case 'check-in':
      return reply.nth === 1
        ? 'The candidate has been quiet and idle for a few minutes. Check in with one short, neutral line, such as asking them to talk you through where they are. No hint. hintLevel "none".'
        : `The candidate is still quiet and idle after you checked in. If the conversation shows they're stuck, you may offer the smallest next insight from the hint ladder (${soFar.nextHint && soFar.nextHint !== 'concrete' ? `rung ${soFar.nextHint}, in your own words, with hintLevel "${soFar.nextHint}"` : 'none is left that small: just check in'}); never the concrete rung, never the answer. If they seem to be working, just check in gently with hintLevel "none".`;
  }
}

/** How a good interviewer answers each kind of turn (ADR 0017). The model picks the kind; code checks the help. */
const replyByTurn = `- thinking-aloud (reasoning out loud, mid-thought): stay-quiet, or a backchannel like "mm-hm". Never interrupt their thinking.
- murmur (a filler, a stray word, a typo, noise): stay-quiet.
- clarifying-question (about the problem): answer briefly and factually from the problem and your notes. Only what they asked.
- seeking-affirmation ("does that sound right?"): if the direction is sound, only a short "sounds reasonable" that hands the floor back, with no question added. If it isn't, ask one probing question (say, an input to try), never the fix.
- asking-for-help (a hint; they don't know how to go on): the next rung of the hint ladder, in your own words.
- asking-to-move-on ("can I start coding?", "should I test it now?"): a short yes. If they'd skip something that matters (coding with no approach discussed), ask them to cover it first.
- stuck (unsure how to go on, circling, "I don't know"): the smallest insight that might help, the next rung at most and never the concrete one, or a question that helps them think. Never the answer.
- explaining (their plan, approach or code): a short acknowledgement. Ask something only if you can't follow what they mean.
- done (finished a phase or the code, in any words): see "When they're done" below.
- answering-interviewer (answering your question): acknowledge it. Ask again only if their answer left your question unanswered.
- agreeing (to your offer or suggestion): a short line that hands the floor back.
- declining or carrying on: a short acknowledgement; they keep going.
- small-talk (logistics, "who are you?", "can you see my code?", thanks): a brief, natural reply.`;

/**
 * How the interviewer behaves in each phase: only the current phase's part goes into the prompt, so a
 * small model isn't carrying goodbye rules while the candidate codes.
 */
const phaseParts: Record<CodingPhase, string> = {
  clarify: "Answer their questions about the problem briefly and factually, from the problem and your notes. Don't volunteer constraints or edge cases they didn't ask about.",
  approach: "Listen while they work out an approach. Don't evaluate it, and don't ask about complexity or edge cases: those are theirs to bring up.",
  code: 'Stay quiet while they write code. Comment on it only when they say they are done or ask you about it.',
  test: "They choose the examples to test with. Don't suggest inputs or edge cases; if they ask what to test, turn it back to them (\"what would you try?\").",
  complexity: "Let them state the time and space complexity. If it's wrong, ask how they got it; don't correct it.",
  'follow-up': 'You lead this phase: ask the follow-up questions one at a time and let them think. No hints toward a follow-up unless they ask for help.',
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
      return `Read their code against the reference. If it looks wrong, ask them to trace one small input that would show the problem (asks "trace-example"); never say what or where the mistake is. If it looks right, a brief "okay" and ${offer}.`;
    case 'follow-up':
      return soFar.followUps.open
        ? 'When they\'ve answered a follow-up, ask the next one (kind "answer", asks "follow-up").'
        : `No follow-up is left, or time is short: ${offer}.`;
    case 'wrap-up':
      return soFar.saidGoodbye
        ? 'You have said goodbye already: never again. If they say thanks or bye, stay-quiet. Answer only a real question.'
        : 'Ask once whether they have questions for you, and answer them briefly. When they have nothing more, say goodbye once (kind "goodbye").';
    default:
      return `When they're done with this phase, ${offer}.`;
  }
}

/**
 * The candidate finished a turn. What they meant is the model's to understand, however they put it; what the
 * round does about it (the phase, the help counted, the tests recorded) is the app's.
 */
function turnInstruction(input: ReplyPromptInput) {
  return [
    "The candidate just finished their turn. Understand what they meant, however they put it (typos, no question mark, half sentences), and reply the way a good human interviewer would.",
    'First report what you observed about their turn (heard, movesTo, checkedCode, foundOwnMistake), then give your reply (kind, words, hintLevel, pointsOutMistake, asks).',
    `# Each kind of turn, and how to reply\n\n${replyByTurn}`,
    `# In this phase\n\n${phaseParts[input.phase]}`,
    `# When they're done\n\n${whenDone(input)}`,
    'movesTo is the phase their own words moved to, ahead or back: going back to Code to fix a bug after testing counts.',
    `# Hints\n\nOnly when they ask for help, or a small insight when they're stuck. Set hintLevel to the rung your words give, or "none".`,
  ].join('\n\n');
}

function hintLadder({ hintLadder: ladder }: Problem) {
  return [
    '# Hint ladder',
    'Only when the candidate asks for help, give one rung at a time, never beyond the next one, in your own words.',
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

const checkRules = `You check one line that the interviewer in a mock coding interview is about to say, before it is said. The candidate must find their own mistakes and their own solution; help comes only in small steps, and only when they ask.

Judge only what the words give the candidate, not what the interviewer meant:
- namesMistake: the words say what or where a mistake in the candidate's code or approach is ("you return the value, not the index", "look at your return line"). Asking them to trace an input, without saying what will go wrong, is not naming it.
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
