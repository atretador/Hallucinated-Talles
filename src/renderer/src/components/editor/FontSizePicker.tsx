import { useTranslation } from 'react-i18next';

/* ── Font size picker ───────────────────────────────── */
export function FontSizePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  const { t } = useTranslation();

  return (
    <select
      value={value}
      onChange={onChange}
      title={t('editor.fontSize.sizeLabel', { ns: 'app' })}
      className="rounded border border-gray-700 bg-gray-800 px-1.5 py-1 text-[11px] text-gray-300 focus:border-blue-500 focus:outline-none cursor-pointer shrink-0"
    >
      <option value="">{t('editor.fontSize.sizeLabel', { ns: 'app' })}</option>
      <option value="0.75rem">{t('editor.fontSize.small', { ns: 'app' })}</option>
      <option value="1rem">{t('editor.fontSize.normal', { ns: 'app' })}</option>
      <option value="1.25rem">{t('editor.fontSize.large', { ns: 'app' })}</option>
      <option value="1.5rem">{t('editor.fontSize.xlarge', { ns: 'app' })}</option>
    </select>
  );
}
