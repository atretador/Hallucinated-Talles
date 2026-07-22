import { useState, useEffect } from 'react';
import { bookSettingsApi } from '../api/client';
import type { BookSettings } from '../../../shared/types';
import { DEFAULT_BOOK_SETTINGS } from '../../../shared/constants';

const MM_TO_PX = 3.7795275591; // 1mm = 3.7795275591px at 96dpi

export interface PaginationConfig {
  bookSettings: BookSettings;
  pageWidthPx: number;
  pageHeightPx: number;
  marginTopPx: number;
  marginBottomPx: number;
  marginLeftPx: number;
  marginRightPx: number;
}

/* ── Custom hook: loads book settings & computes pixel dimensions ── */
export function usePaginationConfig(activeBookId: string | null): PaginationConfig {
  const [bookSettings, setBookSettings] = useState<BookSettings>(DEFAULT_BOOK_SETTINGS);

  useEffect(() => {
    if (!activeBookId) return; // Wait for book to be selected
    bookSettingsApi.get().then((res) => {
      if (res.data) {
        setBookSettings(res.data);
      }
    }).catch(() => {
      /* use defaults */
    });
  }, [activeBookId]);

  return {
    bookSettings,
    pageWidthPx: bookSettings.pageSize.width * MM_TO_PX,
    pageHeightPx: bookSettings.pageSize.height * MM_TO_PX,
    marginTopPx: bookSettings.margins.top * MM_TO_PX,
    marginBottomPx: bookSettings.margins.bottom * MM_TO_PX,
    marginLeftPx: bookSettings.margins.left * MM_TO_PX,
    marginRightPx: bookSettings.margins.right * MM_TO_PX,
  };
}
