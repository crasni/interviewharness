import { checkProblemNames, type Problem, readProblem } from '@interviewharness/engine';

// Every file of every problem folder, bundled into the app as text.
const files = import.meta.glob('../../../../content/problems/*/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const root = '../../../../content/problems/';

/** Every problem in content/problems, by folder name. Throws if a folder is incomplete or badly named. */
export function loadProblems(): Map<string, Problem> {
  const folders = new Map<string, Record<string, string>>();
  for (const [path, text] of Object.entries(files)) {
    const [name, ...rest] = path.slice(root.length).split('/');
    if (!folders.has(name!)) folders.set(name!, {});
    folders.get(name!)![rest.join('/')] = text;
  }
  const badNames = checkProblemNames([...folders.keys()]);
  if (badNames.length) throw new Error(`Problem folder names won't work on every OS:\n${badNames.join('\n')}`);
  return new Map([...folders].map(([name, folder]) => [name, readProblem(name, folder)]));
}
