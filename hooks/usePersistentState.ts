import { useEffect, useRef, useState } from 'react';

/**
 * useState backed by localStorage so button-driven changes survive a reload.
 * Storage failures (private mode, disabled site data) degrade to in-memory state.
 */
export function usePersistentState<T>(key: string, initialValue: T | (() => T)) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch {
      /* ignore unreadable storage */
    }
    return typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
  });

  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    try {
      window.localStorage.setItem(keyRef.current, JSON.stringify(value));
    } catch {
      /* ignore unwritable storage */
    }
  }, [value]);

  return [value, setValue] as const;
}
