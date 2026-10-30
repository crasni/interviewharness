import type { CodingPhase } from '@interviewharness/core';
import type { CodeSnapshot, Reply } from './floor-manager.ts';
import type { ModelMessage } from './model.ts';
import type { Problem } from './problem.ts';

/** One line of the conversation, timed from the start of the round. */
export interface TranscriptLine {
  who: 'candidate' | 'interviewer';
  text: string;
  atMs: number;
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
  /** The hint rung the interviewer may give next if asked, or null when all three are given. */
  nextHint: keyof Problem['hintLadder'] | null;
  /** Why the last attempt at these words was rejected, so this one avoids it. */
  correction?: string;
}

/** How much of the conversation each prompt carries; older lines are left out to keep prompts small. */
const recentLines = 12;

const rules = `You are the interviewer in a live mock coding interview. The candidate is practising, and you play one good, human interviewer.

Rules:
- You decide only the words. When to speak and what kind of reply to give have already been decided; give exactly that kind of reply.
- Speak as a person talks: one to three short sentences, plain words, no markdown, no lists, no code.
- Never give the answer, the approach or any part of the solution. Help only when the candidate asks for it, or, a small insight at a time, when they're stuck.
- Comment on the candidate's code only when they say they're done, or ask you about it directly.
- Don't praise or judge the candidate's ideas while the round is going on.
- Stay in role all round: you are the interviewer, not an assistant.`;

const phaseNames: Record<CodingPhase, string> = {
  clarify: 'Clarify (the candidate asks about the problem)',
  approach: 'Approach (the candidate explains how they will solve it)',
  code: 'Code (the candidate writes the solution)',
  test: 'Test (the candidate checks the code with examples)',
  complexity: 'Complexity (time and space)',
  'wrap-up': 'Wrap-up (the candidate may ask you questions)',
};

const nextPhaseOffers: Record<Exclude<CodingPhase, 'clarify'>, string> = {
  approach: 'talk through their approach',
  code: 'start coding',
  test: 'test their code',
  complexity: 'talk about time and space complexity',
  'wrap-up': 'wrap up',
};

function instruction(reply: Reply, phase: CodingPhase, nextHint: ReplyPromptInput['nextHint']): string {
  switch (reply.kind) {
    case 'intro':
      return 'Open the round: greet the candidate briefly, say this is a 45-minute coding round, and invite them to read the problem and ask any clarifying questions.';
    case 'turn':
      return turnInstruction(phase, nextHint);
    case 'check-in':
      return reply.nth === 1
        ? 'The candidate has been quiet and idle for a few minutes. Check in with one short, neutral line, such as asking them to talk you through where they are. No hint. hintLevel "none".'
        : `The candidate is still quiet and idle after you checked in. If the conversation shows they're stuck, you may offer the smallest next insight from the hint ladder (${nextHint && nextHint !== 'concrete' ? `rung ${nextHint}, in your own words, with hintLevel "${nextHint}"` : 'none is left that small: just check in'}); never the concrete rung, never the answer. If they seem to be working, just check in gently with hintLevel "none".`;
  }
}

/** How a good interviewer answers each kind of turn (ADR 0017). The model picks the kind; code checks the help. */
const replyByTurn = `- thinking-aloud (reasoning out loud, mid-thought): stay-quiet, or a backchannel like "mm-hm". Never interrupt their thinking.
- murmur (a filler, a stray word, a typo, noise): stay-quiet.
- clarifying-question (about the problem): answer briefly and factually from the problem and your notes. Only what they asked.
- seeking-affirmation ("does that sound right?"): don't grade mid-round. If the direction is sound, a short "sounds reasonable, go ahead". If it isn't, ask one probing question (say, a case to try), never the fix.
- asking-for-help (a hint, what to do next): give only the next rung of the hint ladder, in your own words.
- stuck (unsure how to go on, circling, "I don't know"): offer the smallest insight that might help, the next rung at most and never the concrete one, or a question that helps them think. Never the answer.
- explaining (their plan, approach or code): a short acknowledgement, or one follow-up question if something important is missing (complexity, an edge case).
- done (finished a phase or the code, in any words): if it's their code, read it against the reference. If it looks wrong, ask them to walk a small example through it. If it looks right, say so briefly and offer the next phase.
- answering-interviewer (answering your question): acknowledge it, or one follow-up if it's incomplete.
- agreeing (to your offer or suggestion): a short line that hands the floor back, in the new phase.
- declining or carrying on: a short acknowledgement; they keep going.
- small-talk (logistics, "can you see my code?", thanks): a brief, natural reply.`;

/**
 * The candidate finished a turn. What they meant is the model's to understand, however they put it: the
 * kind of turn, the reply that fits, the help it gives and the phase the conversation is in all come back with the words.
 */
function turnInstruction(phase: CodingPhase, nextHint: ReplyPromptInput['nextHint']) {
  const next = nextHint ? `The next rung is ${nextHint}.` : 'Every rung is given already: if they ask again, repeat the concrete rung in other words.';
  const offers = Object.entries(nextPhaseOffers)
    .map(([later, offer]) => `${later}: ${offer}`)
    .join('; ');
  return [
    "The candidate just finished their turn. Understand what they meant, however they put it (typos, no question mark, half sentences), and reply the way a good human interviewer would.",
    "First decide what they're doing (heard), then reply in the kind that fits (kind: answer, acknowledgement, offer-next-phase, backchannel or stay-quiet):",
    replyByTurn,
    `You never push them through the round: they drive it, and how far they get in 45 minutes is part of what's judged. Offer the next phase only when they say they're done (the phase after the one the conversation is in: ${offers}).`,
    `Hints: only when they ask for help, or a small insight when they're stuck. ${next} Set hintLevel to the rung your words give, or "none".`,
    `Report the phase the conversation is in now (the round says ${phase}), by what they're actually doing. If they agreed to move on, or asked to and you agree, report that phase. If they moved ahead by themselves, usually go along; if they skipped something that matters (say, coding with no approach discussed), briefly ask them to cover it, and report that earlier phase.`,
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
    hintLadder(input.problem),
    `# The reference solution\n\nNEVER reveal, quote or paraphrase this code, or describe its approach. It is only for you to judge the candidate's code against.\n\n\`\`\`${input.problem.reference.language}\n${input.problem.reference.code.trim()}\n\`\`\``,
    `# How you sound\n\nExamples of an interviewer's lines. Match their tone and length; don't repeat them word for word.\n\n${input.toneGuide.trim()}`,
  ].join('\n\n');

  const conversation = input.transcript
    .slice(-recentLines)
    .map((line) => `${line.who === 'candidate' ? 'Candidate' : 'You'} (${clock(line.atMs)}): ${line.text}`)
    .join('\n');

  const code = input.code?.text.trim()
    ? `The candidate's code right now (${input.code.language}):\n\`\`\`\n${input.code.text.trimEnd()}\n\`\`\``
    : "The candidate's code right now: (empty)";

  const user = [
    `Phase: ${phaseNames[input.phase]}, ${Math.floor(input.phaseElapsedMs / 60_000)} min in.`,
    `Recent conversation:\n${conversation || '(nothing said yet)'}`,
    code,
    `What to say now: ${instruction(input.reply, input.phase, input.nextHint)}`,
    input.correction ? `Your last attempt was rejected: ${input.correction} Write it again.` : null,
    'Reply with only the words you say aloud.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return { system, messages: [{ role: 'user', text: user }] };
}
