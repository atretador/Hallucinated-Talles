import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { TokenUsageSummary } from '../../../../shared/types';

/* ── Props ── */

interface UsageOverTimeChartProps {
  summary: TokenUsageSummary | null;
  loading: boolean;
}

/* ── Custom Tooltip ── */

interface TooltipContent {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipContent[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-medium text-[var(--theme-text)]">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-xs">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[var(--theme-text-dim)]">{entry.name}:</span>
          <span className="font-medium text-[var(--theme-text)]">
            {entry.value?.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Component ── */

export function UsageOverTimeChart({ summary, loading }: UsageOverTimeChartProps) {
  const { t } = useTranslation('app');
  const chartData = useMemo(() => {
    if (!summary?.recordsByDate) return [];
    return summary.recordsByDate.map((d) => ({
      date: d.date,
      totalTokens: d.totalTokens,
    }));
  }, [summary]);

  const hasData = chartData.length > 0 && chartData.some((d) => d.totalTokens > 0);

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
        {t('tokenUsage.charts.usageOverTime')}
      </h3>

      {!hasData ? (
        <div className="flex h-[220px] items-center justify-center">
          <p className="text-xs text-[var(--theme-text-mute)]">{t('tokenUsage.charts.noUsageData')}</p>
        </div>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--theme-border)"
                strokeOpacity={0.4}
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--theme-text-dim)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--theme-border)', strokeOpacity: 0.3 }}
                tickFormatter={(val: string) => {
                  const d = new Date(val);
                  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--theme-text-dim)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val: number) => {
                  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
                  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
                  return String(val);
                }}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--theme-text-mute)', strokeDasharray: '3 3' }} />
              <Area
                type="monotone"
                dataKey="totalTokens"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#tokenGradient)"
                dot={false}
                activeDot={{ r: 4, stroke: '#3b82f6', strokeWidth: 2, fill: 'var(--theme-surface)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
