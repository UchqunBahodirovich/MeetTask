import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import {
  addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek,
} from 'date-fns';
import { useI18n } from '../../i18n';
import { REDUCED_TRANSITION, SPRING_UI } from './motion';

/**
 * Date or date+time picker in the app's own design (replaces the browser's
 * native control). Values stay plain strings so forms keep their shape:
 * `YYYY-MM-DD` for dates, `YYYY-MM-DDTHH:mm` (local time) with `withTime`.
 * `min` / `max` disable days and times outside the allowed range.
 */
interface DateTimePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  withTime?: boolean;
  min?: Date;
  max?: Date;
  disabled?: boolean;
  /** Shown on the trigger when there is no value (or when disabled with a label of its own). */
  placeholder?: string;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const toDateValue = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const toDateTimeValue = (date: Date) => `${toDateValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
export const parseValue = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, y, m, d, hh = '0', mm = '0'] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
  return Number.isNaN(date.getTime()) ? null : date;
};
/** The next whole 5-minute mark at or after `date`. */
export const ceilToFive = (date: Date) => {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const extra = (5 - (next.getMinutes() % 5)) % 5;
  next.setMinutes(next.getMinutes() + extra);
  return next;
};

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
  id, value, onChange, withTime = false, min, max, disabled = false, placeholder, className = '',
}) => {
  const { t, dateLocale } = useI18n();
  const reduce = useReducedMotion();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ left: number; top: number; up: boolean } | null>(null);
  const selected = parseValue(value);
  const [cursor, setCursor] = useState(() => startOfMonth(selected ?? min ?? new Date()));
  const [focusDay, setFocusDay] = useState<Date>(() => startOfDay(selected ?? min ?? new Date()));
  // Time being edited; committed together with the day.
  const [draft, setDraft] = useState<Date>(() => selected ?? ceilToFive(min ?? new Date()));

  const minDay = min ? startOfDay(min) : null;
  const maxDay = max ? startOfDay(max) : null;
  const dayDisabled = (day: Date) => (minDay !== null && day < minDay) || (maxDay !== null && day > maxDay);
  const timeDisabled = (day: Date, hour: number, minute: number) => {
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
    return (min !== undefined && at < min) || (max !== undefined && at > max);
  };
  const hourDisabled = (day: Date, hour: number) => MINUTES.every((minute) => timeDisabled(day, hour, minute));

  /** Keep a draft inside the allowed range when the day changes. */
  const clamp = (date: Date) => {
    if (min && date < min) return withTime ? ceilToFive(min) : startOfDay(min);
    if (max && date > max) return max;
    return date;
  };

  const measure = () => {
    const box = trigger.current?.getBoundingClientRect();
    if (!box) return;
    const width = 300;
    const height = withTime ? 470 : 360;
    const up = box.bottom + height + 12 > window.innerHeight && box.top > height + 12;
    setPlace({ left: Math.max(8, Math.min(box.left, window.innerWidth - width - 8)), top: up ? box.top - 6 : box.bottom + 6, up });
  };

  const openPicker = () => {
    if (disabled) return;
    const start = selected ?? clamp(withTime ? ceilToFive(new Date()) : startOfDay(new Date()));
    setDraft(start);
    setCursor(startOfMonth(start));
    setFocusDay(startOfDay(start));
    measure();
    setOpen(true);
  };
  const close = (focusTrigger = true) => { setOpen(false); if (focusTrigger) trigger.current?.focus(); };
  const commit = (date: Date) => { onChange(withTime ? toDateTimeValue(date) : toDateValue(date)); };

  const pickDay = (day: Date) => {
    if (dayDisabled(day)) return;
    const next = clamp(new Date(day.getFullYear(), day.getMonth(), day.getDate(), draft.getHours(), draft.getMinutes()));
    setDraft(next);
    setFocusDay(startOfDay(day));
    if (!withTime) { commit(next); close(); }
  };
  const pickTime = (hour: number, minute: number) => {
    const next = clamp(new Date(draft.getFullYear(), draft.getMonth(), draft.getDate(), hour, minute));
    setDraft(next);
  };

  useLayoutEffect(() => { if (open) measure(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !panel.current?.contains(target)) close(false);
    };
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
  // Keep keyboard focus on the day the arrows point at.
  useEffect(() => {
    if (open) grid.current?.querySelector<HTMLButtonElement>(`[data-day="${toDateValue(focusDay)}"]`)?.focus({ preventScroll: true });
  }, [open, focusDay, cursor]);
  // Scroll the chosen hour/minute into view when the panel opens.
  useEffect(() => {
    if (!open || !withTime) return;
    panel.current?.querySelectorAll<HTMLElement>('[data-time-selected="true"]').forEach((el) => el.scrollIntoView({ block: 'center' }));
  }, [open, withTime]);

  const weeks = useMemo(() => {
    const first = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const last = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const days: Date[] = [];
    for (let day = first; day <= last; day = addDays(day, 1)) days.push(day);
    return days;
  }, [cursor]);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, i) => format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i), 'EEEEEE', { locale: dateLocale })), [dateLocale]);
  const prevDisabled = minDay !== null && endOfMonth(addMonths(cursor, -1)) < minDay;
  const nextDisabled = maxDay !== null && startOfMonth(addMonths(cursor, 1)) > maxDay;

  const moveFocus = (next: Date) => {
    setFocusDay(next);
    if (!isSameMonth(next, cursor)) setCursor(startOfMonth(next));
  };
  const onGridKey = (event: React.KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in steps) { event.preventDefault(); moveFocus(addDays(focusDay, steps[event.key])); }
    else if (event.key === 'PageUp') { event.preventDefault(); moveFocus(addMonths(focusDay, -1)); }
    else if (event.key === 'PageDown') { event.preventDefault(); moveFocus(addMonths(focusDay, 1)); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pickDay(focusDay); }
  };
  const onPanelKey = (event: React.KeyboardEvent) => {
    // Handled here so a surrounding modal does not close as well.
    if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); close(); }
  };

  const label = selected
    ? format(selected, withTime ? 'd MMMM yyyy, HH:mm' : 'd MMMM yyyy', { locale: dateLocale })
    : placeholder ?? (withTime ? t.picker.chooseDateTime : t.picker.chooseDate);
  const draftValid = !dayDisabled(startOfDay(draft)) && !(withTime && timeDisabled(draft, draft.getHours(), draft.getMinutes()));
  const now = new Date();
  const nowAllowed = !dayDisabled(startOfDay(now));

  return <>
    <button
      ref={trigger}
      id={id}
      type="button"
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={open}
      className={`ui-select-trigger ${className} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      onClick={() => (open ? close() : openPicker())}
      onKeyDown={(event) => { if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openPicker(); } }}
    >
      <span className={`ui-select-value ${selected || disabled ? '' : 'text-slate-500'}`}>{label}</span>
      <CalendarDays className="ui-select-chevron" size={16} strokeWidth={1.75} aria-hidden="true" />
    </button>
    {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {open && place && <motion.div
          ref={panel}
          role="dialog"
          aria-modal="false"
          aria-label={withTime ? t.picker.chooseDateTime : t.picker.chooseDate}
          className="ui-picker-panel"
          onKeyDown={onPanelKey}
          style={{ left: place.left, top: place.top, transformOrigin: place.up ? 'bottom left' : 'top left', translate: place.up ? '0 -100%' : undefined }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: place.up ? 6 : -6 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: place.up ? 4 : -4 }}
          transition={reduce ? REDUCED_TRANSITION : SPRING_UI}
        >
          <div className="ui-picker-head">
            <button type="button" className="ui-picker-nav" disabled={prevDisabled} onClick={() => setCursor(addMonths(cursor, -1))} aria-label={t.picker.prevMonth}><ChevronLeft size={16} /></button>
            <span className="ui-picker-month" aria-live="polite">{format(cursor, 'LLLL yyyy', { locale: dateLocale })}</span>
            <button type="button" className="ui-picker-nav" disabled={nextDisabled} onClick={() => setCursor(addMonths(cursor, 1))} aria-label={t.picker.nextMonth}><ChevronRight size={16} /></button>
          </div>
          <div className="ui-picker-weekdays" aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
          <div ref={grid} className="ui-picker-grid" role="grid" onKeyDown={onGridKey}>
            {weeks.map((day) => {
              const off = dayDisabled(day);
              const chosen = isSameDay(day, withTime ? draft : selected ?? new Date(NaN));
              return <button
                key={day.toISOString()}
                type="button"
                role="gridcell"
                data-day={toDateValue(day)}
                tabIndex={isSameDay(day, focusDay) ? 0 : -1}
                aria-selected={chosen}
                aria-disabled={off}
                aria-label={format(day, 'EEEE, d MMMM yyyy', { locale: dateLocale })}
                className="ui-picker-day"
                data-outside={!isSameMonth(day, cursor)}
                data-today={isSameDay(day, now)}
                data-selected={chosen}
                data-disabled={off}
                onClick={() => pickDay(day)}
              >{format(day, 'd')}</button>;
            })}
          </div>
          {withTime && <div className="ui-picker-time">
            <p className="ui-picker-time-label"><Clock size={13} aria-hidden="true" />{t.picker.time}</p>
            <div className="ui-picker-columns">
              <div className="ui-picker-column" role="listbox" aria-label={t.picker.hours}>
                {HOURS.map((hour) => {
                  const off = hourDisabled(draft, hour);
                  const on = draft.getHours() === hour;
                  return <button key={hour} type="button" role="option" aria-selected={on} aria-disabled={off} data-time-selected={on} data-disabled={off} className="ui-picker-cell"
                    onClick={() => {
                      if (off) return;
                      // Keep the minutes if they are still allowed at this hour, otherwise take the first free slot.
                      const keep = !timeDisabled(draft, hour, draft.getMinutes());
                      pickTime(hour, keep ? draft.getMinutes() : MINUTES.find((minute) => !timeDisabled(draft, hour, minute)) ?? 0);
                    }}>{pad(hour)}</button>;
                })}
              </div>
              <div className="ui-picker-column" role="listbox" aria-label={t.picker.minutes}>
                {MINUTES.map((minute) => {
                  const off = timeDisabled(draft, draft.getHours(), minute);
                  const on = draft.getMinutes() === minute;
                  return <button key={minute} type="button" role="option" aria-selected={on} aria-disabled={off} data-time-selected={on} data-disabled={off} className="ui-picker-cell"
                    onClick={() => { if (!off) pickTime(draft.getHours(), minute); }}>{pad(minute)}</button>;
                })}
              </div>
            </div>
          </div>}
          <div className="ui-picker-foot">
            <button type="button" className="ui-picker-link" disabled={!nowAllowed}
              onClick={() => {
                const next = clamp(withTime ? ceilToFive(new Date()) : startOfDay(new Date()));
                setDraft(next); setCursor(startOfMonth(next)); setFocusDay(startOfDay(next));
                if (!withTime) { commit(next); close(); }
              }}>
              {withTime ? t.picker.now : t.picker.today}
            </button>
            {withTime && <button type="button" className="ui-picker-done" disabled={!draftValid} onClick={() => { commit(draft); close(); }}>{t.picker.done}</button>}
          </div>
        </motion.div>}
      </AnimatePresence>,
      document.body,
    )}
  </>;
};
