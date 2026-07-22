import { useTranslation } from 'react-i18next';

interface LoadingSpinnerProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingSpinner({ message, size = 'md' }: LoadingSpinnerProps) {
  const { t } = useTranslation();
  const sizeClass = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-5 w-5';

  return (
    <div className="flex items-center gap-2 text-sm text-gray-400">
      <span
        className={`inline-block animate-spin rounded-full border-2 border-gray-500 border-t-transparent ${sizeClass}`}
      />
      <span>{message || t('shared.loadingSpinner.loading', { ns: 'app' })}</span>
    </div>
  );
}
