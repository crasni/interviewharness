import type { CodingPhase } from '@interviewharness/core';
import type { Reply } from './floor-manager.ts';
import type { ModelMessage } from './model.ts';

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
  /** The problem as the candidate sees it. */
  problem: string;
  /** The example-lines file: how the interviewer sounds, and how long its lines are. */
  toneGuide: string;
  transcript: readonly TranscriptLine[];
}

/** How much of the conversation each prompt carries; older lines are left out to keep prompts small. */
const recentLines = 12;

const rules = `You are the interviewer in a live mock coding interview. The candidate is practising, and you play one good, human interviewer.

Rules:
- You decide only the words. When to speak and what kind of reply to give have already been decided; give exactly that kind of reply.
- Speak as a person talks: one to three short sentences, plain words, no markdown, no lists, no code.
- Never give a hint, an approach or any part of the solution. Answer only what was asked.
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

function instruction(reply: Reply): string {
  switch (reply.kind) {
    case 'intro':
      return 'Open the round: greet the candidate briefly, say this is a 45-minute coding round, and invite them to read the problem and ask any clarifying questions.';
    case 'answer':
      return "Answer the candidate's last question, briefly and correctly, from the problem as written. Answer only what they asked; suggest no approach.";
    case 'ack':
      return 'Acknowledge what the candidate just said in a few words, then hand the floor back. Add nothing and judge nothing.';
    case 'suggest-phase':
      return `Ask the candidate whether they're ready to ${nextPhaseOffers[reply.next]}. It's an offer; they may say not yet.`;
    case 'move-on':
      return reply.phase === 'wrap-up'
        ? "Time is nearly up. Say so, and ask whether they have any questions for you."
        : `The candidate agreed to ${nextPhaseOffers[reply.phase]}. Say a short line that hands it over to them.`;
  }
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
    `# The problem (the candidate sees this too)\n\n${input.problem.trim()}`,
    `# How you sound\n\nExamples of an interviewer's lines. Match their tone and length; don't repeat them word for word.\n\n${input.toneGuide.trim()}`,
  ].join('\n\n');

  const conversation = input.transcript
    .slice(-recentLines)
    .map((line) => `${line.who === 'candidate' ? 'Candidate' : 'You'} (${clock(line.atMs)}): ${line.text}`)
    .join('\n');

  const user = [
    `Phase: ${phaseNames[input.phase]}, ${Math.floor(input.phaseElapsedMs / 60_000)} min in.`,
    `Recent conversation:\n${conversation || '(nothing said yet)'}`,
    `What to say now: ${instruction(input.reply)}`,
    'Reply with only the words you say aloud.',
  ].join('\n\n');

  return { system, messages: [{ role: 'user', text: user }] };
}
