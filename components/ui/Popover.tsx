import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { REDUCED_TRANSITION, SPRING_UI } from './motion';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
  panelClassName?: string;
}

/** Anchored dropdown that closes on outside click or Escape. */
export const Popover: React.FC<PopoverProps> = ({
  open,
  onClose,
  trigger,
  children,
  align = 'right',
  className = '',
  panelClassName = 'w-72',
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {trigger}
      <AnimatePresence>
        {open && (
          <motion.div
            // Growing from the trigger's corner keeps the spatial relationship
            // between the button and its panel obvious.
            style={{ transformOrigin: align === 'right' ? 'top right' : 'top left' }}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: -6 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
            transition={reduceMotion ? REDUCED_TRANSITION : SPRING_UI}
            className={`app-popover absolute z-50 mt-2 ${align === 'right' ? 'right-0' : 'left-0'} ${panelClassName} bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/60 overflow-hidden`}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
