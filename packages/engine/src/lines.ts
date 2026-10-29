/** The situations the example-lines file groups lines under, one `##` heading each. */
export const SITUATIONS = [
  'backchannel',
  'acknowledgement',
  'answer',
  'intro',
  'suggest-approach',
  'suggest-code',
  'suggest-test',
  'suggest-complexity',
  'suggest-wrap-up',
  'move-on',
  'wrap-up',
] as const;
export type Situation = (typeof SITUATIONS)[number];

export interface LineBook {
  /** The next line for a situation, rotating through its examples. */
  next(situation: Situation): string;
}

/**
 * Reads the example-lines file: plain markdown where each `## Heading` names a
 * situation and each `- item` under it is one example line.
 */
export function createLineBook(markdown: string): LineBook {
  const groups = new Map<Situation, string[]>();
  let current: string[] | null = null;

  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('## ')) {
      current = [];
      groups.set(toSituation(line.slice(3).trim()), current);
    } else if (line.startsWith('- ') && current) {
      current.push(line.slice(2).trim());
    }
  }

  const positions = new Map<Situation, number>();
  return {
    next(situation) {
      const lines = groups.get(situation);
      if (!lines?.length) throw new Error(`The example-lines file has no lines for "${situation}"`);
      const position = positions.get(situation) ?? 0;
      positions.set(situation, (position + 1) % lines.length);
      return lines[position]!;
    },
  };
}

function toSituation(heading: string): Situation {
  const key = heading.toLowerCase().replace(/\s+/g, '-');
  const situation = SITUATIONS.find((s) => s === key);
  if (!situation) throw new Error(`Unknown situation "${heading}" in the example-lines file`);
  return situation;
}
