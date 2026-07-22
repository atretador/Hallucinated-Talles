import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const prefersReduced = useReducedMotion();
  const resolvedConfirm = confirmLabel ?? t('shared.confirmDialog.confirm', { ns: 'app' });
  const resolvedCancel = cancelLabel ?? t('shared.confirmDialog.cancel', { ns: 'app' });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="confirm-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReduced ? 0 : 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={onCancel}
        >
          <motion.div
            key="confirm-dialog"
            initial={{ opacity: 0, scale: prefersReduced ? 1 : 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: prefersReduced ? 1 : 0.95 }}
            transition={{ duration: prefersReduced ? 0 : 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="mx-4 w-full max-w-sm rounded-lg border border-gray-600 bg-gray-800 p-4 shadow-xl"
          >
            {title && (
              <h3 className="mb-2 text-sm font-semibold text-gray-100">{title}</h3>
            )}
            <p className="mb-4 text-sm text-gray-300">{message}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={onCancel}
                className="focus-ring rounded bg-gray-600 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-500"
              >
                {resolvedCancel}
              </button>
              <button
                onClick={onConfirm}
                className="focus-ring rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-500"
              >
                {resolvedConfirm}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
