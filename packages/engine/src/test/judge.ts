import { type Model, ModelError, type ObjectSchema } from '../index.ts';

const judgeSchema: ObjectSchema<{ notes: string[] }> = {
  name: 'notes',
  jsonSchema: {
    type: 'object',
    properties: {
      notes: { type: 'array', items: { type: 'string' }, description: 'Short notes, each starting with the time of the line it is about. Empty when nothing stands out.' },
    },
    required: ['notes'],
    additionalProperties: false,
  },
  parse(value) {
    const { notes } = (value ?? {}) as Record<string, unknown>;
    if (!Array.isArray(notes) || !notes.every((note) => typeof note === 'string')) throw new Error('Expected notes, a list of strings');
    return { notes };
  },
};

const judgeRules = `You read the transcript of a mock coding interview played by a scripted candidate, whose lines are fixed and don't react to the interviewer. Judge only the interviewer.

Note each place where the interviewer did what the list below warns about, as one short line starting with its time ("03:12 named the bug before they asked"). Note nothing that was fine; an empty list is a good round. Don't grade the candidate.`;

/**
 * Has a model read one played round's transcript and note where the interviewer went wrong, for the owner to
 * read instead of every line. Its notes never fail a run: a judge can be wrong. A judge that fails says why.
 */
export async function judgeTranscript({ model, transcript, about, whatToLookFor }: { model: Model; transcript: string; about: string; whatToLookFor: string }): Promise<{ notes: string[] } | { failed: string }> {
  try {
    const { object } = await model.generateObject({
      purpose: 'transcript-judge',
      system: `${judgeRules}\n\n${whatToLookFor}`,
      messages: [{ role: 'user', text: `The scripted candidate: ${about}\n\nThe transcript:\n\n${transcript}` }],
      schema: judgeSchema,
    });
    return object;
  } catch (error) {
    return { failed: error instanceof ModelError ? error.kind : String(error) };
  }
}
