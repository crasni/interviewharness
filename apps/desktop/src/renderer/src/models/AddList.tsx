import { ChevronRight } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { type AddableItem, searchAddable } from './addable.ts';
import './add-list.css';

/**
 * What can be added as a connection: a search field over the items grouped by kind, all in place (not a
 * popup), scrolling inside its own region. Typing filters across every group; ↑/↓, Home and End move;
 * Enter or a click picks. The search field has the keyboard from the start.
 */
export function AddList({ items, onPick }: { items: readonly AddableItem[]; onPick: (item: AddableItem) => void }) {
  const listId = useId();
  const list = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const groups = useMemo(() => searchAddable(items, query), [items, query]);
  const shown = groups.flatMap((group) => group.items);

  // The active item stays in view as the keyboard moves through the list.
  useEffect(() => {
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function onKey(event: KeyboardEvent) {
    const last = shown.length - 1;
    const moves: Record<string, () => number> = {
      ArrowDown: () => Math.min(active + 1, last),
      ArrowUp: () => Math.max(active - 1, 0),
      Home: () => 0,
      End: () => last,
    };
    if (moves[event.key]) {
      event.preventDefault();
      setActive(moves[event.key]!());
    } else if (event.key === 'Enter') {
      // Picks, rather than submitting the form the list sits in.
      event.preventDefault();
      const item = shown[active];
      if (item) onPick(item);
    }
  }

  const optionId = (index: number) => `${listId}-${index}`;
  return (
    <div className="add-list">
      <input
        className="add-list-search"
        type="search"
        placeholder="Search"
        aria-label="Search"
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-activedescendant={shown.length ? optionId(active) : undefined}
        autoFocus
        spellCheck={false}
        value={query}
        onKeyDown={onKey}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
        }}
      />
      <div ref={list} id={listId} role="listbox" aria-label="What to add" className="add-list-items">
        {groups.map((group) => (
          <div key={group.id} role="group" aria-label={group.label} className="add-list-group">
            <div className="add-list-group-label" aria-hidden>
              {group.label}
            </div>
            {group.items.map((item) => {
              const i = shown.indexOf(item);
              return (
                <div
                  key={item.id}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  data-active={i === active}
                  className="add-list-item"
                  onPointerMove={() => setActive(i)}
                  onClick={() => onPick(item)}
                >
                  {item.name}
                  <ChevronRight size={14} strokeWidth={1.75} aria-hidden className="add-list-chevron" />
                </div>
              );
            })}
          </div>
        ))}
        {!shown.length && <p className="add-list-empty">Nothing matches.</p>}
      </div>
    </div>
  );
}

/** Over a picked item's fields: its name, and Cancel back to the list. */
export function PickedHead({ item, onCancel }: { item: AddableItem; onCancel: () => void }) {
  return (
    <div className="add-list-picked">
      <h4 className="add-list-picked-name">{item.name}</h4>
      <button type="button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
