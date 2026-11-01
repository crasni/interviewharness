import { parse as parseYaml } from 'yaml';

/**
 * A coding problem, read from its folder in content/problems/<name>/:
 * - statement.md: what the candidate sees
 * - problem.yaml: its details (title, pattern, difficulty, license, credits)
 * - interviewer.md: notes, a three-rung hint ladder and follow-ups, never shown to the candidate
 * - reference/solution.py: a solution, never revealed
 * - tests.json: test cases with ids
 */
export interface Problem {
  name: string;
  details: ProblemDetails;
  statement: string;
  notes: string;
  hintLadder: HintLadder;
  followUps: string[];
  reference: { language: 'python'; code: string };
  tests: ProblemTests;
}

export interface ProblemDetails {
  title: string;
  pattern: string;
  difficulty: 'easy' | 'medium' | 'hard';
  license: string;
  credits: string[];
  source: string;
}

/** Help toward the next step, one rung at a time, from a nudge to something concrete. Never the answer. */
export interface HintLadder {
  nudge: string;
  question: string;
  concrete: string;
}

export interface ProblemTests {
  /** The function the candidate writes, called with each case's input as named arguments. */
  function: string;
  /** The answer is a list whose order doesn't matter ("in any order"); checks compare it sorted. */
  unordered?: boolean;
  cases: { id: string; description: string; input: Record<string, unknown>; expected: unknown }[];
}

const difficulties = ['easy', 'medium', 'hard'] as const;

/** Reads a problem folder, given as file path (relative to the folder) → text. Throws on anything missing or wrong. */
export function readProblem(name: string, files: Record<string, string>): Problem {
  const fail = (message: string): never => {
    throw new Error(`${name}: ${message}`);
  };
  // Content may be checked out or edited on Windows: read every file with LF line endings.
  const file = (path: string) => {
    const text = files[path];
    if (text === undefined) return fail(`${path} is missing`);
    return text.replace(/\r\n?/g, '\n');
  };

  const sections = markdownSections(file('interviewer.md'));
  const ladder = listItems(sections.get('hint ladder') ?? '');
  const rung = (key: keyof HintLadder) => {
    const label = key[0]!.toUpperCase() + key.slice(1);
    const item = ladder.find((line) => line.toLowerCase().startsWith(`${key}:`));
    return item?.slice(key.length + 1).trim() || fail(`interviewer.md needs a ${label} rung in its hint ladder`);
  };

  return {
    name,
    details: readDetails(file('problem.yaml'), fail),
    statement: file('statement.md'),
    notes: sections.get('notes') || fail('interviewer.md needs a Notes section'),
    hintLadder: { nudge: rung('nudge'), question: rung('question'), concrete: rung('concrete') },
    followUps: listItems(sections.get('follow-ups') ?? ''),
    reference: { language: 'python', code: file('reference/solution.py') },
    tests: readTests(file('tests.json'), fail),
  };
}

function readDetails(text: string, fail: (message: string) => never): ProblemDetails {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (error) {
    return fail(`problem.yaml isn't valid YAML: ${String(error)}`);
  }
  const details = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const field = (key: string) =>
    typeof details[key] === 'string' && details[key] ? (details[key] as string) : fail(`problem.yaml needs ${key}`);
  const title = field('title');
  const pattern = field('pattern');
  const difficulty = field('difficulty');
  if (!(difficulties as readonly string[]).includes(difficulty)) {
    fail(`problem.yaml's difficulty must be one of ${difficulties.join(', ')}`);
  }
  const license = field('license');
  const credits = details.credits;
  if (!Array.isArray(credits) || !credits.length || !credits.every((c) => typeof c === 'string')) {
    fail('problem.yaml needs credits, a list of names');
  }
  return {
    title,
    pattern,
    difficulty: difficulty as ProblemDetails['difficulty'],
    license,
    credits: credits as string[],
    source: field('source'),
  };
}

function readTests(text: string, fail: (message: string) => never): ProblemTests {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return fail(`tests.json isn't valid JSON: ${String(error)}`);
  }
  const tests = raw as Partial<ProblemTests>;
  if (typeof tests.function !== 'string' || !Array.isArray(tests.cases) || !tests.cases.length) {
    return fail('tests.json needs a function name and a list of cases');
  }
  const ids = new Set<string>();
  for (const c of tests.cases) {
    if (typeof c?.id !== 'string' || typeof c.description !== 'string' || typeof c.input !== 'object' || !('expected' in c)) {
      return fail(`tests.json: every case needs an id, a description, an input and what's expected`);
    }
    if (ids.has(c.id)) fail(`tests.json has two cases with the id "${c.id}"`);
    ids.add(c.id);
  }
  return tests as ProblemTests;
}

/** A markdown file's `## ` sections, by lower-case heading, each trimmed. Text before the first is dropped. */
function markdownSections(markdown: string) {
  const sections = new Map<string, string>();
  let heading: string | null = null;
  let lines: string[] = [];
  const close = () => {
    if (heading !== null) sections.set(heading, lines.join('\n').trim());
  };
  for (const line of markdown.split('\n')) {
    if (line.startsWith('## ')) {
      close();
      heading = line.slice(3).trim().toLowerCase();
      lines = [];
    } else {
      lines.push(line);
    }
  }
  close();
  return sections;
}

function listItems(section: string) {
  return section
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

/** Names Windows won't allow as a file or folder name, with or without an extension. */
const reservedOnWindows = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i;
// eslint-disable-next-line no-control-regex -- control characters are exactly what Windows forbids
const forbiddenOnWindows = /[<>:"/\\|?*\x00-\x1f]/;

/**
 * Problems in plain folders must check out on every OS. Returns what's wrong with these names:
 * names Windows reserves or can't hold, and names that clash on case-insensitive file systems.
 */
export function checkProblemNames(names: readonly string[]): string[] {
  const problems: string[] = [];
  const byLowerCase = new Map<string, string>();
  for (const name of names) {
    if (reservedOnWindows.test(name)) problems.push(`"${name}" is a name Windows reserves`);
    else if (forbiddenOnWindows.test(name)) problems.push(`"${name}" has a character Windows forbids in file names`);
    else if (/[. ]$/.test(name)) problems.push(`"${name}" ends in a dot or space, which Windows drops`);
    const clash = byLowerCase.get(name.toLowerCase());
    if (clash) problems.push(`"${clash}" and "${name}" differ only in case, so they clash on macOS and Windows`);
    else byLowerCase.set(name.toLowerCase(), name);
  }
  return problems;
}
