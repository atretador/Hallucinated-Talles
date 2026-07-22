import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlanNodeType } from '../../../../shared/types';

interface PaletteItem {
  type: PlanNodeType;
  icon: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  { type: 'chapter', icon: '📖' },
  { type: 'scene', icon: '🎬' },
  { type: 'beat', icon: '💡' },
  { type: 'note', icon: '📝' },
];

export function NodePalette() {
  const { t } = useTranslation();

  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-[var(--theme-border)] bg-[var(--theme-surface)]">
      {/* Header */}
      <div className="border-b border-[var(--theme-border)] px-3 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500">
          {t('planner.nodePalette.title', { ns: 'app' })}
        </h2>
        <p className="mt-0.5 text-[11px] text-gray-500">
          {t('planner.nodePalette.hint', { ns: 'app' })}
        </p>
      </div>

      {/* Items */}
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        {PALETTE_ITEMS.map((item) => (
          <PaletteCard key={item.type} item={item} />
        ))}
      </div>
    </aside>
  );
}

function PaletteCard({ item }: { item: PaletteItem }) {
  const { t } = useTranslation();
  const handleDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.dataTransfer.setData('application/reactflow', item.type);
      event.dataTransfer.effectAllowed = 'move';

      // Slight visual feedback — reduce opacity of the source element
      const target = event.currentTarget;
      target.classList.add('opacity-50');
      event.dataTransfer.setDragImage(target, 20, 20);
    },
    [item.type],
  );

  const handleDragEnd = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.currentTarget.classList.remove('opacity-50');
  }, []);

  const labelKey = `planner.nodePalette.items.${item.type}`;
  const descKey = `planner.nodePalette.items.${item.type}Desc`;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className="group cursor-grab rounded-lg border border-transparent px-3 py-2.5 transition-all duration-150 hover:border-[var(--theme-border)] hover:bg-[var(--theme-surface-2)] active:cursor-grabbing active:scale-[0.97]"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 select-none text-base leading-none" role="img" aria-hidden>
          {item.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-gray-200">{t(labelKey, { ns: 'app' })}</div>
          <div className="truncate text-[11px] text-gray-500">{t(descKey, { ns: 'app' })}</div>
        </div>
      </div>
    </div>
  );
}
