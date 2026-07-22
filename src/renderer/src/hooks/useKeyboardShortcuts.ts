import { useEffect } from 'react';
import { undo, redo } from '../stores';

type ShortcutMap = Record<
  string,
  (e: KeyboardEvent) => void
>;

interface UseKeyboardShortcutsOptions {
  onSave?: () => void;
  onNewChapter?: () => void;
  onSearchFocus?: () => void;
  onExportText?: () => void;
  onExportPdf?: () => void;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { onSave, onNewChapter, onSearchFocus, onExportText, onExportPdf } = options;

  useEffect(() => {
    const isMac = navigator.platform.toLowerCase().includes('mac');
    const mod = isMac ? 'metaKey' : 'ctrlKey';

    const shortcuts: ShortcutMap = {
      // Save: Ctrl/Cmd + S
      's': (e) => {
        e.preventDefault();
        onSave?.();
      },
      // Undo: Ctrl/Cmd + Z (without shift)
      'z': (e) => {
        if (e.shiftKey) {
          // Redo: Ctrl/Cmd + Shift + Z
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      },
      // New chapter: Ctrl/Cmd + N
      'n': (e) => {
        if (!e.shiftKey) {
          e.preventDefault();
          onNewChapter?.();
        }
      },
      // Focus search: Ctrl/Cmd + F
      'f': (e) => {
        e.preventDefault();
        onSearchFocus?.();
      },
    };

    // Shift+letter shortcuts (checked separately because they don't match the simple map)
    const shiftShortcuts: ShortcutMap = {
      'e': (e) => {
        e.preventDefault();
        onExportText?.();
      },
      'p': (e) => {
        e.preventDefault();
        onExportPdf?.();
      },
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      // (but allow Ctrl+Z to still trigger undo globally)
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        // Let Ctrl+Z (undo) and Ctrl+S (save) pass through even in contentEditable
        if (e.key !== 'z' && e.key !== 's') return;
      }

      if (!e[mod]) return;

      // Check shift shortcuts first (Ctrl+Shift+Key)
      if (e.shiftKey) {
        const shiftHandler = shiftShortcuts[e.key.toLowerCase()];
        if (shiftHandler) {
          shiftHandler(e);
          return;
        }
      }

      const handler = shortcuts[e.key.toLowerCase()];
      if (handler) {
        handler(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onNewChapter, onSearchFocus, onExportText, onExportPdf]);
}
