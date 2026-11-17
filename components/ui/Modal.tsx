import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { useI18n } from '../../i18n';
import { REDUCED_TRANSITION, SPRING_SHEET, SPRING_UI } from './motion';
import { useModalStack } from './modalStack';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const { depth, isTop } = useModalStack(open);

  // Parents pass inline closures; reading them through a ref keeps the effects
  // below from re-running (and re-focusing) on every parent render.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const isTopRef = useRef(isTop);
  isTopRef.current = isTop;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // Only the dialog on top answers Escape, so one press closes one sheet.
      if (e.key === 'Escape' && isTopRef.current) closeRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    // Focus the first field once, so the dialog is usable from the keyboard immediately.
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-close])',
    );
    focusable?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  // The panel leaves along the path it arrived on, so the surface reads as one
  // object moving rather than two unrelated effects.
  // A covered sheet steps back rather than staying flat under the new one.
  const coveredScale = isTop ? 1 : 0.955;
  const coveredOpacity = isTop ? 1 : 0.55;

  const panelMotion = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: coveredOpacity },
        exit: { opacity: 0 },
        transition: REDUCED_TRANSITION,
      }
    : {
        initial: { opacity: 0, y: 24, scale: 0.98 },
        animate: { opacity: coveredOpacity, y: isTop ? 0 : -8, scale: coveredScale },
        exit: { opacity: 0, y: 16, scale: 0.985 },
        transition: SPRING_SHEET,
      };

  return (
    <AnimatePresence>
      {open && (
        <div
          style={{ zIndex: 60 + depth * 10 }}
          className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-6"
        >
          {/* Only the top sheet dims; stacked scrims would compound and also
              keep intercepting clicks meant for the sheet above. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isTop ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? REDUCED_TRANSITION : SPRING_UI}
            className={`app-scrim absolute inset-0 bg-slate-900/40 backdrop-blur-sm ${
              isTop ? '' : 'pointer-events-none'
            }`}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            {...panelMotion}
            aria-hidden={!isTop}
            className={`app-modal-panel relative w-full ${SIZES[size]} ${isTop ? '' : 'pointer-events-none'} bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col`}
          >
            <div className="flex items-start justify-between gap-4 p-6 border-b border-slate-100">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-slate-900">{title}</h2>
                {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
              </div>
              <button
                type="button"
                data-close
                onClick={onClose}
                aria-label={t.common.close}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0 active:scale-90 active:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">{children}</div>

            {footer && (
              <div className="app-modal-footer p-6 border-t border-slate-100 bg-slate-50/60 rounded-b-3xl flex items-center justify-end gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
