import { useState, useCallback } from 'react';

const STORAGE_KEY = 'story-teller-tool-approvals';

// All tools that CAN be toggled
export const APPROVABLE_TOOLS = [
  { name: 'editContent', label: 'Replace document content', default: true },
  { name: 'appendToContent', label: 'Append to document', default: true },
  { name: 'editRange', label: 'Find and replace in document', default: false },
  { name: 'insertChapter', label: 'Insert chapter heading', default: false },
  { name: 'deleteChapter', label: 'Delete chapter heading', default: true },
  { name: 'addCharacter', label: 'Add character', default: false },
  { name: 'editCharacter', label: 'Edit character', default: false },
  { name: 'deleteCharacter', label: 'Delete character', default: true },
  { name: 'addEvent', label: 'Add event', default: false },
  { name: 'editEvent', label: 'Edit event', default: false },
  { name: 'deleteEvent', label: 'Delete event', default: true },
  { name: 'addWorldData', label: 'Add world data', default: false },
  { name: 'editWorldData', label: 'Edit world data', default: false },
  { name: 'deleteWorldData', label: 'Delete world data', default: true },
  { name: 'createBook', label: 'Create book', default: false },
  { name: 'addRelation', label: 'Add relation', default: false },
  { name: 'editRelation', label: 'Edit relation', default: false },
  { name: 'deleteRelation', label: 'Delete relation', default: true },
] as const;

export type ToolApprovalMap = Record<string, boolean>;

function loadApprovals(): ToolApprovalMap {
  // Build current defaults
  const defaults: ToolApprovalMap = {};
  for (const tool of APPROVABLE_TOOLS) {
    defaults[tool.name] = tool.default;
  }

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ToolApprovalMap;
      // Merge: keep saved prefs for known tools, add new tools with defaults
      return { ...defaults, ...parsed };
    }
  } catch {}

  return defaults;
}

function saveApprovals(map: ToolApprovalMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

export function useToolApprovals() {
  const [approvals, setApprovals] = useState<ToolApprovalMap>(loadApprovals);

  const toggleApproval = useCallback((toolName: string) => {
    setApprovals(prev => {
      const next = { ...prev, [toolName]: !prev[toolName] };
      saveApprovals(next);
      return next;
    });
  }, []);

  const setAll = useCallback((value: boolean) => {
    setApprovals(() => {
      const next: ToolApprovalMap = {};
      for (const tool of APPROVABLE_TOOLS) {
        next[tool.name] = value;
      }
      saveApprovals(next);
      return next;
    });
  }, []);

  const enabledCount = Object.values(approvals).filter(Boolean).length;

  return { approvals, toggleApproval, setAll, enabledCount };
}
