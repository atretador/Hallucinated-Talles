import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';

/* ── Types ── */

type SourceFilter = 'all' | 'chat' | 'import';

interface ProjectInfo {
  projectId: string;
  projectName: string;
}

interface FilterBarProps {
  models: string[];
  selectedModel: string | null;
  onModelChange: (model: string | null) => void;
  projects: ProjectInfo[];
  selectedProject: string | null;
  onProjectChange: (projectId: string | null) => void;
  source: SourceFilter;
  onSourceChange: (source: SourceFilter) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
}

/* ── Source label key mapping ── */

const SOURCE_LABEL_KEYS: Record<SourceFilter, string> = {
  all: 'tokenUsage.filter.source.all',
  chat: 'tokenUsage.filter.source.chat',
  import: 'tokenUsage.filter.source.import',
};

const SOURCE_VALUES: SourceFilter[] = ['all', 'chat', 'import'];

/* ── Component ── */

export function FilterBar({
  models,
  selectedModel,
  onModelChange,
  projects,
  selectedProject,
  onProjectChange,
  source,
  onSourceChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: FilterBarProps) {
  const { t } = useTranslation();
  const [modelOpen, setModelOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const projectDropdownRef = useRef<HTMLDivElement>(null);

  /* Close dropdown on outside click */
  useEffect(() => {
    if (!modelOpen && !projectOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (modelOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
      if (projectOpen && projectDropdownRef.current && !projectDropdownRef.current.contains(e.target as Node)) {
        setProjectOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [modelOpen, projectOpen]);

  const handleSelectModel = useCallback(
    (m: string | null) => {
      onModelChange(m);
      setModelOpen(false);
    },
    [onModelChange],
  );

  const handleSelectProject = useCallback(
    (p: string | null) => {
      onProjectChange(p);
      setProjectOpen(false);
    },
    [onProjectChange],
  );

  const activeLabel = selectedModel
    ? selectedModel.length > 20
      ? selectedModel.slice(0, 20) + '…'
      : selectedModel
    : t('tokenUsage.filter.allModels', { ns: 'app' });

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* ── Date range ── */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-[var(--theme-text-mute)]">{t('tokenUsage.filter.from', { ns: 'app' })}</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="focus-ring rounded border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2 py-1.5 text-xs text-[var(--theme-text)] transition-colors focus:border-blue-500 [color-scheme:dark]"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-[var(--theme-text-mute)]">{t('tokenUsage.filter.to', { ns: 'app' })}</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="focus-ring rounded border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2 py-1.5 text-xs text-[var(--theme-text)] transition-colors focus:border-blue-500 [color-scheme:dark]"
        />
      </div>

      {/* ── Divider ── */}
      <div className="hidden h-5 w-px bg-[var(--theme-border)] sm:block" />

      {/* ── Model dropdown ── */}
      <div ref={dropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setModelOpen(!modelOpen)}
          className="focus-ring flex items-center gap-1.5 rounded border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2.5 py-1.5 text-xs text-[var(--theme-text)] transition-colors hover:border-[var(--card-glow)]"
        >
          <svg className="h-3.5 w-3.5 text-[var(--theme-text-dim)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          <span>{activeLabel}</span>
          <svg className={`h-3 w-3 text-[var(--theme-text-dim)] transition-transform ${modelOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {modelOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-1 w-56 rounded border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-lg"
          >
            <div className="max-h-56 overflow-y-auto p-1">
              <button
                type="button"
                onClick={() => handleSelectModel(null)}
                className={`w-full rounded px-3 py-1.5 text-left text-xs transition-colors ${
                  selectedModel === null
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-[var(--theme-text-dim)] hover:bg-[var(--theme-surface-2)] hover:text-[var(--theme-text)]'
                }`}
              >
                {t('tokenUsage.filter.allModels', { ns: 'app' })}
              </button>
              {models.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelectModel(m)}
                  className={`w-full rounded px-3 py-1.5 text-left text-xs transition-colors ${
                    selectedModel === m
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'text-[var(--theme-text-dim)] hover:bg-[var(--theme-surface-2)] hover:text-[var(--theme-text)]'
                  }`}
                >
                  <span className="truncate block">{m}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Project dropdown ── */}
      <div ref={projectDropdownRef} className="relative">
        <button
          type="button"
          onClick={() => setProjectOpen(!projectOpen)}
          className="focus-ring flex items-center gap-1.5 rounded border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2.5 py-1.5 text-xs text-[var(--theme-text)] transition-colors hover:border-[var(--card-glow)]"
        >
          <svg className="h-3.5 w-3.5 text-[var(--theme-text-dim)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
          <span>{selectedProject ? (projects.find(p => p.projectId === selectedProject)?.projectName ?? selectedProject).slice(0, 20) : t('tokenUsage.filter.allProjects', { ns: 'app' })}</span>
          <svg className={`h-3 w-3 text-[var(--theme-text-dim)] transition-transform ${projectOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {projectOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-1 w-56 rounded border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-lg"
          >
            <div className="max-h-56 overflow-y-auto p-1">
              <button
                type="button"
                onClick={() => handleSelectProject(null)}
                className={`w-full rounded px-3 py-1.5 text-left text-xs transition-colors ${
                  selectedProject === null
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-[var(--theme-text-dim)] hover:bg-[var(--theme-surface-2)] hover:text-[var(--theme-text)]'
                }`}
              >
                {t('tokenUsage.filter.allProjects', { ns: 'app' })}
              </button>
              {projects.map((p) => (
                <button
                  key={p.projectId}
                  type="button"
                  onClick={() => handleSelectProject(p.projectId)}
                  className={`w-full rounded px-3 py-1.5 text-left text-xs transition-colors ${
                    selectedProject === p.projectId
                      ? 'bg-blue-600/20 text-blue-400'
                      : 'text-[var(--theme-text-dim)] hover:bg-[var(--theme-surface-2)] hover:text-[var(--theme-text)]'
                  }`}
                >
                  <span className="truncate block">{p.projectName}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Source toggle ── */}
      <div className="flex items-center rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-0.5">
        {SOURCE_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onSourceChange(value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              source === value
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-[var(--theme-text-dim)] hover:text-[var(--theme-text)]'
            }`}
          >
            {t(SOURCE_LABEL_KEYS[value], { ns: 'app' })}
          </button>
        ))}
      </div>
    </div>
  );
}
