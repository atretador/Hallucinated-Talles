import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import type { TokenUsageSummary } from '../../../../shared/types';

/* ── Chart colour palette ── */

const DONUT_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
];

/* ── Props ── */

interface ModelDistributionChartProps {
  summary: TokenUsageSummary | null;
  loading: boolean;
}

/* ── Custom Tooltip ── */

function DonutTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { color: string } }> }) {
  if (!active || !payload || payload.length === 0) return null;

  const entry = payload[0];
  return (
    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2 shadow-lg">
      <div className="flex items-center gap-2 text-xs">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: entry.payload.color }}
        />
        <span className="text-[var(--theme-text-dim)]">{entry.name}:</span>
        <span className="font-medium text-[var(--theme-text)]">
          {entry.value.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

/* ── Component ── */

export function ModelDistributionChart({ summary, loading }: ModelDistributionChartProps) {
  const { t } = useTranslation('app');
  const chartData = useMemo(() => {
    if (!summary?.recordsByModel) return [];
    return summary.recordsByModel
      .filter((d) => d.totalTokens > 0)
      .sort((a, b) => b.totalTokens - a.totalTokens)
      .map((d, i) => ({
        name: d.model,
        value: d.totalTokens,
        color: DONUT_COLORS[i % DONUT_COLORS.length],
      }));
  }, [summary]);

  const hasData = chartData.length > 0;

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="card-elevated-lg flex h-full min-h-[260px] items-center justify-center rounded-xl p-4">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="card-elevated-lg rounded-xl p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-dim)]">
        {t('tokenUsage.charts.modelDistribution')}
      </h3>

      {!hasData ? (
        <div className="flex h-[220px] items-center justify-center">
          <p className="text-xs text-[var(--theme-text-mute)]">{t('tokenUsage.charts.noModelData')}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center sm:flex-row sm:items-start">
          {/* Donut Chart */}
          <div className="h-[200px] w-[200px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={84}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.color}
                      stroke="transparent"
                      className="transition-all duration-150 hover:opacity-80"
                    />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 sm:mt-0 sm:ml-4 sm:flex-col">
            {chartData.slice(0, 8).map((entry) => (
              <div key={entry.name} className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="truncate text-xs text-[var(--theme-text-dim)] max-w-[140px]">
                  {entry.name}
                </span>
                <span className="text-xs font-medium text-[var(--theme-text)]">
                  {entry.value.toLocaleString()}
                </span>
              </div>
            ))}
            {chartData.length > 8 && (
              <p className="text-[10px] text-[var(--theme-text-mute)]">
                +{chartData.length - 8} more models
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
