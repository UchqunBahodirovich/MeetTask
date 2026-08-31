import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../../i18n';

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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the first field so the dialog is usable from the keyboard immediately.
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-close])',
    );
    focusable?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${SIZES[size]} bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col animate-fade-up`}
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
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">{children}</div>

        {footer && (
          <div className="p-6 border-t border-slate-100 bg-slate-50/60 rounded-b-3xl flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
