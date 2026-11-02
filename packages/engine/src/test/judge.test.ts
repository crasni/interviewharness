import { describe, expect, it } from 'vitest';
import { scriptedModel } from './fakes.ts';
import { judgeTranscript } from './judge.ts';

const transcript = '00:10  Candidate: Is it something with a hash map?\n00:15  Interviewer: Yes, use a hash map from value to index.';

describe('the judge', () => {
  it('reads a transcript with what to look for, and gives its short notes', async () => {
    const model = scriptedModel({ 'transcript-judge': [{ object: { notes: ['00:15 confirmed the idea outright: more than the next rung.'] } }] });

    const judged = await judgeTranscript({ model: model.model, transcript, about: 'Fishes for the answer.', whatToLookFor: 'Hints given unasked.' });

    expect(judged).toEqual({ notes: ['00:15 confirmed the idea outright: more than the next rung.'] });
    const asked = model.requests[0]!;
    expect(asked.messages.at(-1)!.text).toContain(transcript);
    expect(`${asked.system}\n${asked.messages.at(-1)!.text}`).toContain('Hints given unasked.');
  });

  it("says why when it couldn't judge, instead of throwing", async () => {
    const model = scriptedModel({ 'transcript-judge': [{ error: 'timeout' }] });

    await expect(judgeTranscript({ model: model.model, transcript, about: '', whatToLookFor: '' })).resolves.toEqual({ failed: 'timeout' });
  });
});
