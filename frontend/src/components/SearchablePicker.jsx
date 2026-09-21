import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Inline searchable picker.
 *
 * Renders a search input that opens a dropdown of matching items as the
 * user types. Unlike the native <select>, the filtered list is visible
 * immediately, each row can show a title + subtitle, and keyboard
 * navigation is supported.
 *
 * Props:
 *   items       — array of source objects
 *   value       — currently selected id (any type)
 *   onChange    — (newValue) => void, called with the selected id or ''
 *   getId       — item => id
 *   getPrimary  — item => bold title string
 *   getSecondary(optional) — item => subtitle string (email, code, etc.)
 *   matches(optional)      — (item, query) => bool. Default: substring
 *                            match against primary + secondary text.
 *   placeholder — search box placeholder
 *   emptyLabel  — text shown when no items match ("No tenants found")
 *   icon(optional) — small emoji/character shown left of the input
 *   disabled(optional) — bool
 */
export default function SearchablePicker({
  items,
  value,
  onChange,
  getId,
  getPrimary,
  getSecondary,
  matches,
  placeholder = 'Search…',
  emptyLabel = 'No matches',
  icon = '🔍',
  disabled = false,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const selected = useMemo(
    () => items.find((it) => String(getId(it)) === String(value)) || null,
    [items, value, getId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    const matchFn = matches
      || ((it, qq) => {
        const p = String(getPrimary(it) || '').toLowerCase();
        const s = String((getSecondary ? getSecondary(it) : '') || '').toLowerCase();
        return p.includes(qq) || s.includes(qq);
      });
    return items.filter((it) => matchFn(it, q));
  }, [items, query, matches, getPrimary, getSecondary]);

  // Close on outside click
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep active index within bounds
  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(0);
  }, [filtered, activeIdx]);

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault();
      const pick = filtered[activeIdx];
      if (pick) {
        onChange(getId(pick));
        setQuery('');
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const pick = (item) => {
    onChange(getId(item));
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const clear = () => {
    onChange('');
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="picker" ref={wrapRef}>
      <div className={`picker-input-wrap ${open ? 'is-open' : ''}`} onClick={() => !disabled && inputRef.current?.focus()}>
        <span className="picker-icon" aria-hidden>{icon}</span>
        {selected && !open ? (
          <span className="picker-pill">
            <span>{getPrimary(selected)}{getSecondary ? ` — ${getSecondary(selected)}` : ''}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); clear(); }} aria-label="Clear selection">×</button>
          </span>
        ) : (
          <input
            ref={inputRef}
            className="picker-input"
            type="text"
            value={query}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKey}
            autoComplete="off"
          />
        )}
      </div>

      {open && !disabled && (
        <div className="picker-menu" role="listbox">
          {filtered.length === 0 ? (
            <div className="picker-empty">{emptyLabel}</div>
          ) : filtered.map((item, i) => (
            <div
              key={getId(item)}
              className={`picker-item ${i === activeIdx ? 'is-active' : ''}`}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(item); }}
              role="option"
              aria-selected={String(getId(item)) === String(value)}
            >
              <div className="picker-item-primary">{getPrimary(item)}</div>
              {getSecondary && (
                <div className="picker-item-secondary">{getSecondary(item)}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
