import { autocompletion, completeAnyWord, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { cpp } from '@codemirror/lang-cpp';
import { go } from '@codemirror/lang-go';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { drawSelection, EditorView, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { useEffect, useRef } from 'react';
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

const completion = autocompletion();

export type EditorOptions = { language: CodeLanguage; autocomplete: boolean; highlighting: boolean };

// The engine expects editor activity about once a second (see Signal 'editor-activity').
const activityEvery = 1_000;

/**
 * CodeMirror 6 in the mono theme. Reports typing as activity, at most once a second. No code runs yet.
 * Language, autocomplete and highlighting follow Settings live; the code stays as it is.
 */
export function CodeEditor({ options, onActivity }: { options: EditorOptions; onActivity: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  const activity = useRef(onActivity);
  activity.current = onActivity;
  const language = useRef(new Compartment());
  const autocomplete = useRef(new Compartment());
  const highlighting = useRef(new Compartment());
  const initial = useRef(options);

  useEffect(() => {
    let lastSent = 0;
    const { language: lang, autocomplete: complete, highlighting: highlight } = initial.current;
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
          language.current.of(languages[lang]()),
          autocomplete.current.of(complete ? completion : []),
          highlighting.current.of(highlight ? syntaxHighlighting(monoHighlight) : []),
          keymap.of([...completionKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
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

  useEffect(() => {
    view.current?.dispatch({
      effects: [
        language.current.reconfigure(languages[options.language]()),
        autocomplete.current.reconfigure(options.autocomplete ? completion : []),
        highlighting.current.reconfigure(options.highlighting ? syntaxHighlighting(monoHighlight) : []),
      ],
    });
  }, [options.language, options.autocomplete, options.highlighting]);

  return <div className="code-editor" ref={host} />;
}
