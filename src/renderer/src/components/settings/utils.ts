/** Notify all listeners that settings were saved (ChatPanel re-fetches AI status). */
export function notifySettingsChanged() {
  window.dispatchEvent(new CustomEvent('settings-changed'));
}

export type SettingsTab = 'providers' | 'skills' | 'mcp' | 'subagents' | 'language' | 'fonts' | 'compaction';
