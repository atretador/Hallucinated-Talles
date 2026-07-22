import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../stores';

export function useChatSession() {
  const {
    sessions,
    activeSessionId,
    currentSessionData,
    loadSessions,
    createSession,
    switchSession,
    books,
  } = useAppStore();

  // Build a map of bookId -> book title for display
  const bookMap = new Map(books.map(b => [b.id, b.title]));

  const [sessionDropdownOpen, setSessionDropdownOpen] = useState(false);
  const [sessionListOpen, setSessionListOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load sessions on mount (project-level, all books)
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!sessionDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSessionDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sessionDropdownOpen]);

  const handleNewSession = useCallback(async () => {
    await createSession();
    setSessionDropdownOpen(false);
  }, [createSession]);

  const handleSwitchSession = useCallback(async (id: string) => {
    await switchSession(id);
    setSessionDropdownOpen(false);
  }, [switchSession]);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  return {
    sessions,
    activeSessionId,
    activeSession,
    currentSessionData,
    bookMap,
    sessionDropdownOpen,
    setSessionDropdownOpen,
    sessionListOpen,
    setSessionListOpen,
    dropdownRef,
    handleNewSession,
    handleSwitchSession,
  };
}
