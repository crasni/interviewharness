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
  'their-questions',
  'check-in',
  'time-reminder',
  'walk-through',
] as const;
export type Situation = (typeof SITUATIONS)[number];

export interface LineBook {
  /** The next line for a situation, rotating through its examples, with any `{minutes}` in it filled in. */
  next(situation: Situation, fill?: LineFill): string;
}

/** Values a line may have a place for, written `{name}` in the example-lines file. */
export interface LineFill {
  /** Minutes left in the round, for a time reminder. */
  minutes?: number;
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
    next(situation, fill = {}) {
      const lines = groups.get(situation);
      if (!lines?.length) throw new Error(`The example-lines file has no lines for "${situation}"`);
      const position = positions.get(situation) ?? 0;
      positions.set(situation, (position + 1) % lines.length);
      const line = lines[position]!;
      return fill.minutes === undefined ? line : line.replaceAll('{minutes}', String(fill.minutes));
    },
  };
}

function toSituation(heading: string): Situation {
  const key = heading.toLowerCase().replace(/\s+/g, '-');
  const situation = SITUATIONS.find((s) => s === key);
  if (!situation) throw new Error(`Unknown situation "${heading}" in the example-lines file`);
  return situation;
}
