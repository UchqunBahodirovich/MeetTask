import React, { useEffect, useRef } from 'react';

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
      {open && (
        <div
          className={`absolute z-50 mt-2 ${align === 'right' ? 'right-0' : 'left-0'} ${panelClassName} bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/60 overflow-hidden animate-fade-in`}
        >
          {children}
        </div>
      )}
    </div>
  );
};
