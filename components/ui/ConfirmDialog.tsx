import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { useI18n } from '../../i18n';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}) => {
  const { t } = useI18n();
  return (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    size="sm"
    footer={
      <>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
        >
          {t.common.cancel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
        >
          {confirmLabel ?? t.common.delete}
        </button>
      </>
    }
  >
    <div className="flex gap-3">
      <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <p className="text-sm text-slate-600 leading-relaxed pt-2">{message}</p>
      </div>
    </Modal>
  );
};
