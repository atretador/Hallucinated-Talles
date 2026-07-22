import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  pendingImages: string[];
  setPendingImages: (updater: string[] | ((prev: string[]) => string[])) => void;
  isStreaming: boolean;
  shouldReduceMotion: boolean;
  handleSend: () => Promise<void>;
  handleCancel: () => Promise<void>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function ChatInput({
  input,
  setInput,
  pendingImages,
  setPendingImages,
  isStreaming,
  shouldReduceMotion,
  handleSend,
  handleCancel,
  handleKeyDown,
}: ChatInputProps) {
  const { t } = useTranslation();
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    if (imageItems.length === 0) return;
    e.preventDefault();
    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setPendingImages(prev => [...prev, dataUrl]);
      };
      reader.readAsDataURL(file);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const removeImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, idx) => idx !== index));
  };

  return (
    <div className="border-t border-gray-700 p-3">
      {/* Text input */}
      <div className="relative">
        {/* Pending image previews */}
        {pendingImages.length > 0 && (
          <div className="flex gap-2 px-3 pt-2 pb-1 overflow-x-auto">
            {pendingImages.map((img, i) => (
              <div key={i} className="relative flex-shrink-0">
                <img src={img} alt={t('chat.input.attachmentLabel', { ns: 'app', index: i + 1 })} className="h-16 w-16 rounded-lg object-cover border border-gray-600" />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs hover:bg-red-500"
                  title={t('chat.input.removeImage', { ns: 'app' })}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          value={input}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          onPaste={onPaste}
          placeholder={pendingImages.length > 0 ? t('chat.input.placeholderWithImages', { ns: 'app' }) : t('chat.input.placeholder', { ns: 'app' })}
          className="w-full resize-none rounded-xl border border-gray-600 bg-gray-800 px-4 pb-10 pt-3 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none focus:ring-0"
          rows={2}
          disabled={isStreaming}
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
          {isStreaming && (
            <motion.button
              onClick={handleCancel}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-700/80 text-gray-200 hover:bg-red-600 transition-colors"
              whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
              title={t('buttons.cancel', { ns: 'common' })}
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </motion.button>
          )}
          <motion.button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600"
            whileTap={shouldReduceMotion ? undefined : { scale: 0.9 }}
            title={t('chat.input.send', { ns: 'app' })}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
