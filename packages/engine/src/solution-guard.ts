/**
 * The solution guard: before the interviewer says anything, code checks its words for runs of the
 * reference solution's code. Words are compared as normalised tokens (lower case, punctuation dropped),
 * in runs of `runLength`, so spoken English that merely shares a word or two with the code passes.
 */

/** How many tokens in a row count as quoting the code. */
const runLength = 4;
/** How many such runs it takes to call a reply a leak. */
const leakingRuns = 2;

const tokens = (text: string) => text.toLowerCase().match(/[a-z0-9_]+/g) ?? [];

function runs(words: string[]) {
  const found = new Set<string>();
  for (let i = 0; i + runLength <= words.length; i++) found.add(words.slice(i, i + runLength).join(' '));
  return found;
}

/** Whether `words` quote enough of `code` to give the solution away. */
export function quotesSolution(words: string, code: string): boolean {
  const solution = runs(tokens(code));
  let shared = 0;
  for (const run of runs(tokens(words))) if (solution.has(run) && ++shared >= leakingRuns) return true;
  return false;
}
