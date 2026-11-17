import { useEffect, useId, useSyncExternalStore } from 'react';

/**
 * Tracks which dialogs are open, in order. Stacked sheets need it: the layer
 * underneath has to be pushed back and stop painting its own scrim, otherwise
 * two dimming layers compound and the parent still swallows pointer events.
 */
let stack: string[] = [];
const listeners = new Set<() => void>();

/**
 * Page scroll is locked while any dialog is open and released when the last one
 * closes. Deriving it from the stack (instead of each dialog saving and restoring
 * the previous value) keeps stacked dialogs from leaving the page stuck unscrollable.
 */
const syncScrollLock = () => {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = stack.length > 0 ? 'hidden' : '';
};

const emit = () => {
  syncScrollLock();
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => stack;
const EMPTY: string[] = [];

export interface ModalStackPosition {
  /** 0 for the first dialog, 1 for one opened on top of it, and so on. */
  depth: number;
  /** False while another dialog covers this one. */
  isTop: boolean;
}

export function useModalStack(open: boolean): ModalStackPosition {
  const id = useId();
  const current = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);

  useEffect(() => {
    if (!open) return;
    stack = [...stack, id];
    emit();
    return () => {
      stack = stack.filter((entry) => entry !== id);
      emit();
    };
  }, [open, id]);

  const depth = current.indexOf(id);
  return {
    depth: depth === -1 ? current.length : depth,
    isTop: depth === -1 ? true : depth === current.length - 1,
  };
}
