import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import type { SettingsTab } from './utils';
import { ProvidersTab } from './ProvidersTab';
import { SkillsTab } from './SkillsTab';
import { McpServersTab } from './McpServersTab';
import { SubAgentsTab } from './SubAgentsTab';
import { LanguageTab } from './LanguageTab';
import { FontsTab } from './FontsTab';
import { CompactionTab } from './CompactionTab';

// ── Main Panel ────────────────────────────────────────────────────────────────

export function SettingsPanel() {
  const { t } = useTranslation('app');
  const { settingsOpen, setSettingsOpen } = useAppStore();
  const prefersReduced = useReducedMotion();
  const [activeTab, setActiveTab] = useState<SettingsTab>('providers');

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };

  const contentVariants: Variants = {
    hidden: { opacity: 0, ...(prefersReduced ? {} : { scale: 0.95, y: 20 }) },
    visible: { opacity: 1, ...(prefersReduced ? {} : { scale: 1, y: 0 }) },
    exit: { opacity: 0, ...(prefersReduced ? {} : { scale: 0.95, y: 20 }), transition: { duration: 0.2 } },
  };

  return (
    <AnimatePresence>
      {settingsOpen && (
        <motion.div
          key="settings-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{ duration: 0.2 }}
          onClick={() => setSettingsOpen(false)}
        >
          <motion.div
            key="settings-content"
            className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl border border-gray-600 bg-gray-800 p-6 shadow-2xl"
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ type: 'spring' as const, stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-100">{t('settings.title')}</h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="mb-4 flex gap-1 border-b border-gray-700">
              {([['providers', t('settings.tabs.providers')], ['skills', t('settings.tabs.skills')], ['mcp', t('settings.tabs.mcp')], ['subagents', t('settings.tabs.subAgents')], ['compaction', t('settings.compaction.tab', 'Compaction')], ['language', t('settings.language.tab')], ['fonts', t('settings.tabs.fonts', 'Fonts')]] as [SettingsTab, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === key
                      ? 'border-b-2 border-blue-500 text-blue-400'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'providers' && <ProvidersTab />}
            {activeTab === 'skills' && <SkillsTab />}
            {activeTab === 'mcp' && <McpServersTab />}
            {activeTab === 'subagents' && <SubAgentsTab />}
            {activeTab === 'compaction' && <CompactionTab />}
            {activeTab === 'language' && <LanguageTab />}
            {activeTab === 'fonts' && <FontsTab />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
