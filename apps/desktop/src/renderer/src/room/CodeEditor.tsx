import { autocompletion, closeBrackets, closeBracketsKeymap, completeAnyWord, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { cpp } from '@codemirror/lang-cpp';
import { go } from '@codemirror/lang-go';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { drawSelection, EditorView, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { type Ref, useEffect, useImperativeHandle, useRef } from 'react';
import type { CodeLanguage } from '../settings/settings.tsx';
import './code-editor.css';

/** Syntax shown with weight and slant only: the room stays black and white. */
const monoHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword], fontWeight: 'var(--weight-bold)' },
  { tag: [tags.function(tags.definition(tags.variableName)), tags.definition(tags.className)], fontWeight: 'var(--weight-medium)', textDecoration: 'underline' },
  { tag: [tags.comment, tags.string], fontStyle: 'italic' },
]);

// Java and C++ have no completions of their own in CodeMirror; there, words already in the code are offered.
const wordCompletion = EditorState.languageData.of(() => [{ autocomplete: completeAnyWord }]);

/** Each language with the indent its own style guide uses. */
const languages: Record<CodeLanguage, () => Extension> = {
  python: () => [python(), indentUnit.of('    ')],
  javascript: () => [javascript(), indentUnit.of('  ')],
  typescript: () => [javascript({ typescript: true }), indentUnit.of('  ')],
  java: () => [java(), indentUnit.of('    '), wordCompletion],
  cpp: () => [cpp(), indentUnit.of('    '), wordCompletion],
  go: () => [go(), indentUnit.of('\t')],
};

/** The editor's switchable help, each a switch in Settings → Editor, with what it adds when on (keys included). */
const features = {
  autocomplete: [autocompletion(), keymap.of(completionKeymap)],
  highlighting: syntaxHighlighting(monoHighlight),
  closeBrackets: [closeBrackets(), keymap.of(closeBracketsKeymap)],
  matchBrackets: bracketMatching(),
  // The search bar sits at the top of the editor; Ctrl/⌘+F opens it, Escape closes it.
  findReplace: [search({ top: true }), highlightSelectionMatches(), keymap.of(searchKeymap)],
  wrapLines: EditorView.lineWrapping,
} satisfies Record<string, Extension>;

/** CodeMirror's own words for its find bar, written the way the rest of the app writes them. */
const phrases = EditorState.phrases.of({
  Find: 'Find',
  Replace: 'Replace',
  next: 'Next',
  previous: 'Previous',
  all: 'All',
  'match case': 'Match case',
  regexp: 'Regular expression',
  'by word': 'Whole word',
  replace: 'Replace',
  'replace all': 'Replace all',
  close: 'Close',
});
type Feature = keyof typeof features;
const featureNames = Object.keys(features) as Feature[];

export type EditorOptions = { language: CodeLanguage } & Record<Feature, boolean>;

// The engine expects editor activity about once a second (see Signal 'editor-activity').
const activityEvery = 1_000;

/**
 * CodeMirror 6 in the mono theme. Reports typing as activity, at most once a second. No code runs yet.
 * The language and each feature follow Settings live; the code stays as it is.
 */
/** What the room can ask of the editor. */
export interface CodeEditorHandle {
  /** The code as it stands. */
  text(): string;
}

export function CodeEditor({
  options,
  onActivity,
  ref,
}: {
  options: EditorOptions;
  onActivity: () => void;
  ref?: Ref<CodeEditorHandle>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  const activity = useRef(onActivity);
  activity.current = onActivity;
  const language = useRef(new Compartment());
  // One compartment per feature, so each can be turned on and off on its own.
  const switches = useRef(Object.fromEntries(Object.keys(features).map((name) => [name, new Compartment()])) as Record<Feature, Compartment>);
  const initial = useRef(options);

  useImperativeHandle(ref, () => ({ text: () => view.current?.state.doc.toString() ?? '' }), []);

  useEffect(() => {
    let lastSent = 0;
    const { language: lang } = initial.current;
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: '',
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          indentOnInput(),
          phrases,
          language.current.of(languages[lang]()),
          ...featureNames.map((name) => switches.current[name].of(initial.current[name] ? features[name] : [])),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.contentAttributes.of({ 'aria-label': 'Code editor' }),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || Date.now() - lastSent < activityEvery) return;
            lastSent = Date.now();
            activity.current();
          }),
        ],
      }),
    });
    view.current = editor;
    return () => editor.destroy();
  }, []);

  const on = featureNames.map((name) => options[name]);
  useEffect(() => {
    view.current?.dispatch({
      effects: [
        language.current.reconfigure(languages[options.language]()),
        ...featureNames.map((name, i) => switches.current[name].reconfigure(on[i] ? features[name] : [])),
      ],
    });
  }, [options.language, ...on]);

  return <div className="code-editor" ref={host} />;
}
