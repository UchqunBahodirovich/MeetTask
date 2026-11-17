import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { REDUCED_TRANSITION, SPRING_UI } from './motion';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T) => void;
  id?: string;
  ariaLabel?: string;
  /** Classes for the trigger, so each surface keeps its own field styling. */
  className?: string;
  /** Extra classes for the floating list (e.g. capitalize). */
  panelClassName?: string;
  align?: 'left' | 'right';
}

type Placement = { left: number; top: number; width: number; up: boolean };

/**
 * Select-only combobox (WAI-ARIA APG pattern) with a styled listbox.
 * The list renders in a portal so scrolling modal bodies and pills never clip it.
 */
export function Select<T extends string>({ value, options, onChange, id, ariaLabel, className = '', panelClassName = '', align = 'left' }: SelectProps<T>) {
  const reduce = useReducedMotion();
  const autoId = useId();
  const listId = `${id ?? autoId}-list`;
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [place, setPlace] = useState<Placement | null>(null);
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
  const selected = options[selectedIndex];

  const measure = () => {
    const box = trigger.current?.getBoundingClientRect();
    if (!box) return;
    const listHeight = Math.min(320, options.length * 40 + 12);
    const up = box.bottom + listHeight + 12 > window.innerHeight && box.top > listHeight + 12;
    const width = Math.max(box.width, 180);
    const left = align === 'right' ? box.right - width : box.left;
    setPlace({ left: Math.max(8, Math.min(left, window.innerWidth - width - 8)), top: up ? box.top - 6 : box.bottom + 6, width, up });
  };

  const openList = (index = selectedIndex) => { measure(); setActive(index); setOpen(true); };
  const close = (focusTrigger = true) => { setOpen(false); if (focusTrigger) trigger.current?.focus(); };
  const choose = (index: number) => { const option = options[index]; if (option && option.value !== value) onChange(option.value); close(); };

  useLayoutEffect(() => { if (open) measure(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !list.current?.contains(target)) close(false);
    };
    // Keep the list attached to its trigger while any ancestor scrolls or the window resizes.
    const follow = () => measure();
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', follow);
    window.addEventListener('scroll', follow, true);
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('resize', follow);
      window.removeEventListener('scroll', follow, true);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const typeahead = (key: string) => {
    const now = Date.now();
    typed.current = { text: now - typed.current.at > 600 ? key : typed.current.text + key, at: now };
    const query = typed.current.text.toLowerCase();
    const start = open ? active : selectedIndex;
    const order = options.map((_, i) => (start + 1 + i) % options.length);
    return order.find(i => options[i].label.toLowerCase().startsWith(query)) ?? -1;
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) { event.preventDefault(); openList(); return; }
      if (event.key.length === 1 && /\S/.test(event.key)) { const match = typeahead(event.key); if (match >= 0) onChange(options[match].value); }
      return;
    }
    // Handled here so a surrounding modal does not also react to Escape or Enter.
    event.stopPropagation();
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); setActive(i => Math.min(last, i + 1)); break;
      case 'ArrowUp': event.preventDefault(); setActive(i => Math.max(0, i - 1)); break;
      case 'Home': event.preventDefault(); setActive(0); break;
      case 'End': event.preventDefault(); setActive(last); break;
      case 'Enter': case ' ': event.preventDefault(); choose(active); break;
      case 'Escape': event.preventDefault(); close(); break;
      case 'Tab': choose(active); break;
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) { const match = typeahead(event.key); if (match >= 0) setActive(match); }
    }
  };

  return <>
    <button
      ref={trigger}
      id={id}
      type="button"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listId}
      aria-activedescendant={open ? `${listId}-${active}` : undefined}
      aria-label={ariaLabel}
      className={`ui-select-trigger ${className}`}
      data-open={open}
      onClick={() => (open ? close() : openList())}
      onKeyDown={onKeyDown}
    >
      <span className="ui-select-value">{selected?.label}</span>
      <ChevronDown className="ui-select-chevron" size={15} strokeWidth={1.75} aria-hidden="true" />
    </button>
    {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {open && place && <motion.ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          tabIndex={-1}
          className={`ui-select-panel ${panelClassName}`}
          style={{ left: place.left, top: place.top, minWidth: place.width, transformOrigin: place.up ? 'bottom center' : 'top center', translate: place.up ? '0 -100%' : undefined }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: place.up ? 6 : -6 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: place.up ? 4 : -4 }}
          transition={reduce ? REDUCED_TRANSITION : SPRING_UI}
        >
          {options.map((option, index) => <li
            key={option.value}
            id={`${listId}-${index}`}
            data-index={index}
            role="option"
            aria-selected={option.value === value}
            data-active={index === active}
            className="ui-select-option"
            onPointerMove={() => setActive(index)}
            onPointerDown={event => event.preventDefault()}
            onClick={() => choose(index)}
          >
            <span>{option.label}</span>
            {option.value === value && <Check size={15} strokeWidth={2} aria-hidden="true" />}
          </li>)}
        </motion.ul>}
      </AnimatePresence>,
      document.body,
    )}
  </>;
}
