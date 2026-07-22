import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

/* ── Tweak / feedback input ──────────────────────────── */

interface AiTweakInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onSend: () => void;
  onCancel: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export function AiTweakInput({ value, onChange, onKeyDown, onSend, onCancel, inputRef }: AiTweakInputProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      key="tweak-input"
      initial={{ opacity: 0, width: 0 }}
      animate={{ opacity: 1, width: 'auto' }}
      exit={{ opacity: 0, width: 0 }}
      className="flex items-center gap-1.5"
    >
      <button
        onClick={onCancel}
        className="rounded p-1 text-gray-400 hover:text-gray-200 transition-colors"
        title={t('buttons.cancel', { ns: 'common' })}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t('editor.selectionToolbar.tweakPlaceholder', { ns: 'app' })}
        className="w-64 rounded border border-gray-600 bg-gray-700 px-2.5 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
      />

      <button
        onClick={onSend}
        disabled={!value.trim()}
        className="rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
      >
        {t('editor.selectionToolbar.send', { ns: 'app' })}
      </button>
    </motion.div>
  );
}
