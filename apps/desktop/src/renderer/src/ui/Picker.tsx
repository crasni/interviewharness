import { Check, ChevronDown, X } from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './picker.css';

export interface PickerOption {
  value: string;
  label: string;
  /** Shown before the label, in the list and on the button (a provider's logo, say). Decorative: the label names it. */
  icon?: ReactNode;
}

export interface PickerGroup {
  /** Shown above its options, and after the picked option's name on the button (e.g. "GPT-5.5 · ChatGPT"). */
  label: string;
  options: PickerOption[];
}

/** A last item that does something instead of picking a value (e.g. "Add a model…"). Always shown, even while searching. */
export interface PickerAction {
  label: string;
  onPick: () => void;
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
 * and keeps the old value; Shift+Delete removes the active option when options can be removed. `id` goes on
 * the button, so a `<label htmlFor>` names it.
 */
export function Picker({
  id,
  value,
  options = [],
  groups = [],
  placeholder = 'Choose…',
  disabled,
  defaultOpen = false,
  action,
  onRemove,
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
  /** Opens the list as soon as the picker appears. */
  defaultOpen?: boolean;
  /** The list's last item. */
  action?: PickerAction;
  /** Given, each option in a group gets a Remove button (and Shift+Delete removes the active one); the list stays open. */
  onRemove?: (value: string) => void;
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
  /** The keyboard moves through the options shown, then the action. */
  const count = shown.length + (action ? 1 : 0);
  const actionIndex = action ? shown.length : -1;

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

  function pickAction() {
    close({ refocus: false });
    action?.onPick();
  }

  const removable = (option: (typeof all)[number] | undefined) => !!onRemove && !!option && option.group !== null;

  function remove(option: (typeof all)[number]) {
    onRemove?.(option.value);
    // The same place in the list, now one shorter (back to the search, or the list, so the keyboard keeps working).
    setActive((i) => Math.max(0, Math.min(i, count - 2)));
    (searchable ? search.current : panel.current?.querySelector<HTMLElement>('[role="listbox"]'))?.focus();
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
    // The list stays with its button; a press elsewhere, or a scroll that moves the button away, closes it.
    const away = (event: Event) => {
      const target = event.target as Node;
      if (!list.contains(target) && !button.current?.contains(target)) close({ refocus: false });
    };
    // Content growing around the page (models arriving, say) can fire a scroll without moving the button.
    const openedAt = button.current!.getBoundingClientRect();
    const scrolled = (event: Event) => {
      const now = button.current?.getBoundingClientRect();
      if (now && now.top === openedAt.top && now.left === openedAt.left) return;
      away(event);
    };
    window.addEventListener('resize', place);
    document.addEventListener('scroll', scrolled, true);
    document.addEventListener('pointerdown', away, true);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', scrolled, true);
      document.removeEventListener('pointerdown', away, true);
    };
  }, [open, searchable]);

  // The active option stays in view as the keyboard moves through a long list.
  useEffect(() => {
    if (open) panel.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  useEffect(() => {
    if (defaultOpen) show();
    // Only when the picker first appears.
  }, []);

  function onListKey(event: KeyboardEvent) {
    const last = count - 1;
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
      if (active === actionIndex) pickAction();
      else if (option) pick(option.value);
    } else if (event.key === 'Delete' && event.shiftKey && removable(shown[active])) {
      event.preventDefault();
      remove(shown[active]!);
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
        const row = (
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
            {option.icon}
            {option.label}
          </div>
        );
        if (!removable(option)) return row;
        // Beside the option, not inside it, so the option's name stays its label.
        return (
          <div key={option.value} className="picker-row" data-active={i === active} onPointerMove={() => setActive(i)}>
            {row}
            <button type="button" className="picker-remove" tabIndex={-1} aria-label={`Remove ${option.label}`} title="Remove" onClick={() => remove(option)}>
              <X size={14} strokeWidth={2} aria-hidden />
            </button>
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
        {picked?.icon}
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
                aria-activedescendant={count ? optionId(active) : undefined}
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
              aria-activedescendant={!searchable && count ? optionId(active) : undefined}
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
              {!shown.length && (query || !action) && <p className="picker-empty">Nothing matches.</p>}
              {action && (
                <div role="group" className="picker-group picker-actions">
                  <div
                    id={optionId(actionIndex)}
                    role="option"
                    aria-selected={false}
                    data-index={actionIndex}
                    data-active={active === actionIndex}
                    className="picker-option"
                    onPointerMove={() => setActive(actionIndex)}
                    onClick={pickAction}
                  >
                    <span className="picker-check" />
                    {action.label}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
