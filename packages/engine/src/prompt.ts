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
- Never give a hint, an approach or any part of the solution unless the candidate asks for help. Answer only what was asked.
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

/** Every reply to the candidate also says where the conversation really is; the round follows it forward. */
const phaseCheck = [
  "Also report the phase the conversation is in now, by what the candidate is actually doing, even if it's ahead of the round's phase.",
  'If they asked to move on (e.g. "should I start coding?") and you agree, report that phase.',
  'If they moved ahead by themselves, judge it as a real interviewer would: usually go along with it, but if they skipped something that matters (say, coding with no approach discussed), briefly ask them to cover it first, and report that earlier phase.',
].join(' ');

function instruction(reply: Reply, nextHint: ReplyPromptInput['nextHint']): string {
  switch (reply.kind) {
    case 'intro':
      return 'Open the round: greet the candidate briefly, say this is a 45-minute coding round, and invite them to read the problem and ask any clarifying questions.';
    case 'answer': {
      const help = nextHint
        ? `If they asked for help, give only the next rung of the hint ladder, ${nextHint}, in your own words, and set hintLevel to "${nextHint}".`
        : 'If they asked for help, every rung is given already: say so kindly and repeat the concrete rung in other words, with hintLevel "concrete".';
      return [
        "Answer the candidate's last question, briefly and correctly, from the problem as written and your notes. Answer only what they asked.",
        "If they asked about their code, read it against the reference solution: point them to a case to try, or ask them to walk an example through it, but never name the fix.",
        help,
        'Otherwise give no hint at all: hintLevel "none". Set askedForHelp only if they asked for help, a hint or what to do next.',
        phaseCheck,
      ].join(' ');
    }
    case 'ack':
      return `Acknowledge what the candidate just said in a few words, then hand the floor back. Add nothing and judge nothing. ${phaseCheck}`;
    case 'suggest-phase': {
      const offer = `Ask the candidate whether they're ready to ${nextPhaseOffers[reply.next]}. It's an offer; they may say not yet.`;
      if (!reply.afterDone) return offer;
      return `The candidate says they're done. First read their code against the reference solution: if it looks wrong, ask them to walk a small example through it (your notes suggest one) instead of pointing at the bug, and make no offer yet. If it looks right, say so in a few words, then: ${offer}`;
    }
    case 'check-in':
      return "The candidate has been quiet and idle for a few minutes. Check in with one short, neutral line, such as asking them to talk you through where they are. No hint, no suggestion, nothing about the approach.";
    case 'move-on':
      return reply.phase === 'wrap-up'
        ? "Time is nearly up. Say so, and ask whether they have any questions for you."
        : `The candidate agreed to ${nextPhaseOffers[reply.phase]}. Say a short line that hands it over to them.`;
  }
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
    `What to say now: ${instruction(input.reply, input.nextHint)}`,
    input.correction ? `Your last attempt was rejected: ${input.correction} Write it again.` : null,
    'Reply with only the words you say aloud.',
  ]
    .filter(Boolean)
    .join('\n\n');

  return { system, messages: [{ role: 'user', text: user }] };
}
