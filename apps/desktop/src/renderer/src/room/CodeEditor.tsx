import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { HighlightStyle, indentOnInput, syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { drawSelection, EditorView, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { useEffect, useRef } from 'react';
import './code-editor.css';

/** Syntax shown with weight and slant only: the room stays black and white. */
const monoHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword], fontWeight: 'var(--weight-bold)' },
  { tag: [tags.function(tags.definition(tags.variableName)), tags.definition(tags.className)], fontWeight: 'var(--weight-medium)', textDecoration: 'underline' },
  { tag: [tags.comment, tags.string], fontStyle: 'italic' },
]);

// The engine expects editor activity about once a second (see Signal 'editor-activity').
const activityEvery = 1_000;

/** CodeMirror 6 in the mono theme. Reports typing as activity, at most once a second. No code runs yet. */
export function CodeEditor({ onActivity }: { onActivity: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const activity = useRef(onActivity);
  activity.current = onActivity;

  useEffect(() => {
    let lastSent = 0;
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: '',
        extensions: [
          lineNumbers(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          indentOnInput(),
          python(),
          syntaxHighlighting(monoHighlight),
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
    return () => view.destroy();
  }, []);

  return <div className="code-editor" ref={host} />;
}
