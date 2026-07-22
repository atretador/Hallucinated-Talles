import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'motion/react';
import type { TokenUsageSummary } from '../../../../shared/types';

/* ── Props ── */

interface KpiCardsProps {
  summary: TokenUsageSummary | null;
  loading: boolean;
}

/* ── Helpers ── */

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatAvg(n: number): string {
  if (n >= 1000) return Math.round(n).toLocaleString();
  if (n >= 100) return n.toFixed(1);
  return n.toFixed(0);
}

/* ── Card data ── */

interface KpiDef {
  key: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string; // Tailwind gradient / color class for the left bar
}

/* ── Icons ── */

function TokensIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
  );
}

function AvgIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function CacheIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function SessionsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

/* ── Component ── */

export function KpiCards({ summary, loading }: KpiCardsProps) {
  const { t } = useTranslation();
  const prefersReduced = useReducedMotion();
  const shouldReduce = prefersReduced ?? true;

  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-elevated-lg animate-pulse rounded-xl p-4">
            <div className="mb-2 h-3 w-20 rounded bg-gray-700" />
            <div className="h-7 w-28 rounded bg-gray-700" />
          </div>
        ))}
      </div>
    );
  }

  const cards: KpiDef[] = [
    {
      key: 'total',
      label: t('tokenUsage.kpi.totalTokens', { ns: 'app' }),
      value: formatNumber(summary.totalTokens),
      icon: <TokensIcon />,
      accent: 'from-blue-500 to-blue-400',
    },
    {
      key: 'avg',
      label: t('tokenUsage.kpi.avgTokensPerSession', { ns: 'app' }),
      value: formatAvg(summary.avgTokensPerSession),
      icon: <AvgIcon />,
      accent: 'from-purple-500 to-purple-400',
    },
    {
      key: 'cache',
      label: t('tokenUsage.kpi.cacheHitRate', { ns: 'app' }),
      value: `${summary.cacheHitRate.toFixed(1)}%`,
      icon: <CacheIcon />,
      accent: 'from-green-500 to-green-400',
    },
    {
      key: 'sessions',
      label: t('tokenUsage.kpi.totalSessions', { ns: 'app' }),
      value: formatNumber(summary.totalSessions),
      icon: <SessionsIcon />,
      accent: 'from-amber-500 to-amber-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.key}
          initial={shouldReduce ? { opacity: 1 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.07, ease: [0.34, 1.56, 0.64, 1] }}
          className="card-elevated-lg group relative overflow-hidden rounded-xl"
        >
          {/* Accent gradient bar on top */}
          <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${card.accent} opacity-80`} />

          <div className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--theme-text-dim)]">{card.label}</span>
              <span className="text-[var(--theme-text-mute)] opacity-60 group-hover:opacity-100 transition-opacity">
                {card.icon}
              </span>
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-[var(--theme-text)]">
              {card.value}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
