/**
 * The solution guard: before the interviewer says anything, code checks its words for runs of the
 * reference solution's code. Words are compared as normalised tokens (lower case, punctuation dropped),
 * in runs of `runLength`, so spoken English that merely shares a word or two with the code passes.
 */

/** How many tokens in a row count as quoting the code. */
const runLength = 4;
/** How many such runs it takes to call a reply a leak. */
const leakingRuns = 2;

/** Words, with the operators people say aloud as words, so "target - value" and "target minus value" match. */
const tokens = (text: string) =>
  text.toLowerCase().replace(/-/g, ' minus ').replace(/\+/g, ' plus ').match(/[a-z0-9_]+/g) ?? [];

/** The code without its string literals and comments: an error message that echoes the problem's wording isn't the solution. */
const codeOnly = (code: string) =>
  code
    .replace(/(["'`])(?:\\.|(?!\1)[^\\\n])*\1/g, ' ')
    .replace(/(#|\/\/).*$/gm, ' ');

function runs(words: string[]) {
  const found = new Set<string>();
  for (let i = 0; i + runLength <= words.length; i++) found.add(words.slice(i, i + runLength).join(' '));
  return found;
}

/** Whether `words` quote enough of `code` to give the solution away. */
export function quotesSolution(words: string, code: string): boolean {
  const solution = runs(tokens(codeOnly(code)));
  let shared = 0;
  for (const run of runs(tokens(words))) if (solution.has(run) && ++shared >= leakingRuns) return true;
  return false;
}
