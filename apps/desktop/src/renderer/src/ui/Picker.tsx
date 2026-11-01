import { Check, ChevronDown } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './picker.css';

export interface PickerOption {
  value: string;
  label: string;
}

export interface PickerGroup {
  /** Shown above its options, and after the picked option's name on the button (e.g. "GPT-5.5 · ChatGPT"). */
  label: string;
  options: PickerOption[];
}

/** Lists longer than this get a search field. */
const searchFrom = 9;

/**
 * Picks one value from a list, optionally in named groups: a button showing the current choice, and a
 * list that opens under it (above, if there's no room) with a search field when it's long. Drawn with the
 * app's tokens on every OS, unlike a native select, whose list the OS draws. The list sits in the top layer
 * (the Popover API), so a dialog or a scrolling page never clips it.
 *
 * Keyboard: Enter, Space or ↓ opens; ↑/↓, Home and End move; typing searches; Enter picks; Escape closes
 * and keeps the old value. `id` goes on the button, so a `<label htmlFor>` names it.
 */
export function Picker({
  id,
  value,
  options = [],
  groups = [],
  placeholder = 'Choose…',
  disabled,
  onChange,
}: {
  id?: string;
  value: string;
  /** Options before the groups, ungrouped (e.g. "Same as interviewer"). */
  options?: PickerOption[];
  groups?: PickerGroup[];
  /** Shown when `value` is none of the options. */
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const fallbackId = useId();
  const buttonId = id ?? fallbackId;
  const listId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const all = useMemo(
    () => [...options.map((option) => ({ ...option, group: null as string | null })), ...groups.flatMap((g) => g.options.map((option) => ({ ...option, group: g.label })))],
    [options, groups],
  );
  const picked = all.find((option) => option.value === value);
  const searchable = all.length >= searchFrom;
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    return words ? all.filter((option) => `${option.label} ${option.group ?? ''}`.toLowerCase().includes(words)) : all;
  }, [all, query]);

  function show() {
    if (disabled) return;
    setQuery('');
    setActive(Math.max(0, all.findIndex((option) => option.value === value)));
    setOpen(true);
  }

  function close({ refocus = true } = {}) {
    setOpen(false);
    if (refocus) button.current?.focus();
  }

  function pick(next: string) {
    close();
    if (next !== value) onChange(next);
  }

  // Into the top layer, placed under the button (or above it when the window has no room below).
  useLayoutEffect(() => {
    const list = panel.current;
    if (!list) return;
    if (!open) {
      if (list.matches(':popover-open')) list.hidePopover();
      return;
    }
    list.showPopover();
    const place = () => {
      const at = button.current!.getBoundingClientRect();
      const margin = 8;
      const below = window.innerHeight - at.bottom - margin * 2;
      const above = at.top - margin * 2;
      const up = below < 240 && above > below;
      list.style.left = `${Math.min(at.left, window.innerWidth - Math.max(at.width, 240) - margin)}px`;
      list.style.minWidth = `${at.width}px`;
      list.style.maxHeight = `${Math.min(up ? above : below, 360)}px`;
      list.style.top = up ? '' : `${at.bottom + 4}px`;
      list.style.bottom = up ? `${window.innerHeight - at.top + 4}px` : '';
    };
    place();
    (searchable ? search.current : list.querySelector<HTMLElement>('[role="listbox"]'))?.focus();
    // The list stays with its button; anything that moves the button away closes it instead.
    const away = (event: Event) => {
      const target = event.target as Node;
      if (!list.contains(target) && !button.current?.contains(target)) close({ refocus: false });
    };
    window.addEventListener('resize', place);
    document.addEventListener('scroll', away, true);
    document.addEventListener('pointerdown', away, true);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', away, true);
      document.removeEventListener('pointerdown', away, true);
    };
  }, [open, searchable]);

  // The active option stays in view as the keyboard moves through a long list.
  useEffect(() => {
    if (open) panel.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function onListKey(event: KeyboardEvent) {
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
      event.preventDefault();
      const option = shown[active];
      if (option) pick(option.value);
    } else if (event.key === 'Escape') {
      // Closes the list, not the dialog it's in.
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      close({ refocus: false });
    }
  }

  const optionId = (index: number) => `${listId}-${index}`;
  const rows = (group: string | null) =>
    shown
      .filter((option) => option.group === group)
      .map((option) => {
        const i = shown.indexOf(option);
        const selected = option.value === value;
        return (
          <div
            key={option.value}
            id={optionId(i)}
            role="option"
            aria-selected={selected}
            data-index={i}
            data-active={i === active}
            className="picker-option"
            onPointerMove={() => setActive(i)}
            onClick={() => pick(option.value)}
          >
            <span className="picker-check">{selected && <Check size={14} strokeWidth={2} aria-hidden />}</span>
            {option.label}
          </div>
        );
      });
  const groupsShown = [null, ...groups.map((g) => g.label)].filter((group) => shown.some((option) => option.group === group));

  return (
    <>
      <button
        ref={button}
        id={buttonId}
        type="button"
        className="picker-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            show();
          }
        }}
      >
        <span className="picker-value">
          {picked ? picked.label : placeholder}
          {picked?.group && <span className="picker-group-name"> · {picked.group}</span>}
        </span>
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden className="picker-chevron" />
      </button>
      <div ref={panel} popover="manual" className="picker-panel" onKeyDown={onListKey}>
        {open && (
          <>
            {searchable && (
              <input
                ref={search}
                className="picker-search"
                type="search"
                placeholder="Search"
                aria-label="Search"
                role="combobox"
                aria-expanded
                aria-controls={listId}
                aria-activedescendant={shown.length ? optionId(active) : undefined}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
              />
            )}
            <div
              id={listId}
              role="listbox"
              tabIndex={searchable ? -1 : 0}
              aria-labelledby={buttonId}
              aria-activedescendant={!searchable && shown.length ? optionId(active) : undefined}
              className="picker-list"
            >
              {groupsShown.map((group) =>
                group === null ? (
                  <div key="" role="group" className="picker-group">
                    {rows(null)}
                  </div>
                ) : (
                  <div key={group} role="group" aria-label={group} className="picker-group">
                    <div className="picker-group-label" aria-hidden>
                      {group}
                    </div>
                    {rows(group)}
                  </div>
                ),
              )}
              {!shown.length && <p className="picker-empty">Nothing matches.</p>}
            </div>
          </>
        )}
      </div>
    </>
  );
}
