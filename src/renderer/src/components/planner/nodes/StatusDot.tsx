import { useTranslation } from 'react-i18next';
import type { PlanNodeStatus } from '../../../../../shared/types';

const STATUS_STYLES: Record<PlanNodeStatus, string> = {
  draft: 'bg-gray-500',
  in_progress: 'bg-amber-400',
  complete: 'bg-green-400',
  cut: 'bg-red-400',
};

const STATUS_LABEL_KEYS: Record<PlanNodeStatus, string> = {
  draft: 'planner.nodeInspector.statusOptions.draft',
  in_progress: 'planner.nodeInspector.statusOptions.inProgress',
  complete: 'planner.nodeInspector.statusOptions.complete',
  cut: 'planner.nodeInspector.statusOptions.cut',
};

export function StatusDot({ status }: { status: PlanNodeStatus }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5" title={t(STATUS_LABEL_KEYS[status], { ns: 'app' })}>
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_STYLES[status]}`}
      />
      <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
        {t(STATUS_LABEL_KEYS[status], { ns: 'app' })}
      </span>
    </span>
  );
}
