import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../stores';
import { CharacterList } from './CharacterList';
import { EventList } from './EventList';
import { WorldDataList } from './WorldDataList';
import { EntityDetailPanel } from './EntityDetailPanel';

type Tab = 'characters' | 'events' | 'worldData';

const baseTabClass = 'relative flex-1 px-3 py-2 text-xs font-medium';
const activeTabClass = `${baseTabClass} text-gray-100 bg-gray-800`;
const inactiveTabClass = `${baseTabClass} text-gray-400 hover:text-gray-200 hover:bg-gray-800/50`;

export function SidebarLeft() {
  const { t } = useTranslation('app');
  const { entityDetailPanel, setEntityDetailPanel } = useAppStore();
  const [tab, setTab] = useState<Tab>('characters');
  const shouldReduceMotion = useReducedMotion();

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
  };

  const handleSelectEntity = (kind: 'character' | 'event' | 'worldData', id: string) => {
    setEntityDetailPanel({ kind, id });
  };

  const handleAddEntity = (kind: 'character' | 'event' | 'worldData') => {
    setEntityDetailPanel({ kind, mode: 'add' });
  };

  const selectedId = entityDetailPanel && 'id' in entityDetailPanel ? entityDetailPanel.id : null;

  let contentKey: string;
  let content: React.ReactNode;

  if (tab === 'characters') {
    contentKey = 'tab-characters';
    content = (
      <CharacterList
        selectedId={entityDetailPanel?.kind === 'character' ? selectedId : null}
        onSelect={(id) => handleSelectEntity('character', id)}
        onAdd={() => handleAddEntity('character')}
      />
    );
  } else if (tab === 'worldData') {
    contentKey = 'tab-worldData';
    content = (
      <WorldDataList
        selectedId={entityDetailPanel?.kind === 'worldData' ? selectedId : null}
        onSelect={(id) => handleSelectEntity('worldData', id)}
        onAdd={() => handleAddEntity('worldData')}
      />
    );
  } else {
    contentKey = 'tab-events';
    content = (
      <EventList
        selectedId={entityDetailPanel?.kind === 'event' ? selectedId : null}
        onSelect={(id) => handleSelectEntity('event', id)}
        onAdd={() => handleAddEntity('event')}
      />
    );
  }

  // Determine enter/exit horizontal offset based on tab direction
  const getXOffset = (key: string) => {
    if (shouldReduceMotion) return 0;
    if (key.startsWith('tab-events')) return 24;
    if (key.startsWith('tab-characters')) return -24;
    if (key.startsWith('tab-worldData')) return 24;
    return 0;
  };

  return (
    <>
      <aside className="flex h-full w-full flex-col border-r border-gray-700 bg-gray-900">
        {/* Tab bar */}
        <div className="flex shrink-0 border-b border-gray-700">
          <button
            type="button"
            className={tab === 'characters' ? activeTabClass : inactiveTabClass}
            onClick={() => handleTabChange('characters')}
          >
            {t('sidebarLeft.tabs.characters')}
            {tab === 'characters' && (
              <motion.div
                layoutId="sidebar-tab-indicator"
                className="absolute bottom-0 inset-x-0 h-0.5 bg-blue-400"
                transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeInOut' }}
              />
            )}
          </button>
          <button
            type="button"
            className={tab === 'events' ? activeTabClass : inactiveTabClass}
            onClick={() => handleTabChange('events')}
          >
            {t('sidebarLeft.tabs.events')}
            {tab === 'events' && (
              <motion.div
                layoutId="sidebar-tab-indicator"
                className="absolute bottom-0 inset-x-0 h-0.5 bg-blue-400"
                transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeInOut' }}
              />
            )}
          </button>
          <button
            type="button"
            className={tab === 'worldData' ? activeTabClass : inactiveTabClass}
            onClick={() => handleTabChange('worldData')}
          >
            {t('sidebarLeft.tabs.world')}
            {tab === 'worldData' && (
              <motion.div
                layoutId="sidebar-tab-indicator"
                className="absolute bottom-0 inset-x-0 h-0.5 bg-blue-400"
                transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeInOut' }}
              />
            )}
          </button>
        </div>

        {/* Content — min-h-0 allows this flex item to shrink below its content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={contentKey}
              initial={{ opacity: 0, x: getXOffset(contentKey) }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: shouldReduceMotion ? 0 : -getXOffset(contentKey) }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeOut' }}
            >
              {content}
            </motion.div>
          </AnimatePresence>
        </div>
      </aside>

      {/* Floating entity detail panel (portal overlay) */}
      <AnimatePresence>
        {entityDetailPanel && (
          <EntityDetailPanel
            key={`${entityDetailPanel.kind}-${entityDetailPanel.mode === 'add' ? 'add' : entityDetailPanel.id}`}
            kind={entityDetailPanel.kind}
            id={'id' in entityDetailPanel ? entityDetailPanel.id : undefined}
            mode={entityDetailPanel.mode ?? 'view'}
            onClose={() => setEntityDetailPanel(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
