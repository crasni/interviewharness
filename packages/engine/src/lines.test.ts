import { describe, expect, it } from 'vitest';
import { createLineBook } from './index.ts';

const file = `# Interviewer lines

Examples of what the interviewer says, grouped by situation.

## Backchannel

- Mm-hm.
- Okay.
- Right.

## Acknowledgement

- Okay, that makes sense.
`;

describe('the example-lines file', () => {
  it('gives the lines for a situation in turn, never repeating one immediately', () => {
    const lines = createLineBook(file);

    expect([1, 2, 3, 4].map(() => lines.next('backchannel'))).toEqual(['Mm-hm.', 'Okay.', 'Right.', 'Mm-hm.']);
  });

  it('keeps each situation separate', () => {
    const lines = createLineBook(file);

    expect(lines.next('acknowledgement')).toBe('Okay, that makes sense.');
    expect(lines.next('backchannel')).toBe('Mm-hm.');
  });

  it('rejects a heading that is not a known situation, so a typo fails at load', () => {
    expect(() => createLineBook('## Backchanel\n- Mm-hm.')).toThrow('Unknown situation "Backchanel"');
  });
});
