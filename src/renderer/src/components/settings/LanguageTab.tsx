import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type Locale } from '../../i18n';

export function LanguageTab() {
  const { t, i18n } = useTranslation('app');

  const handleLanguageChange = (code: Locale) => {
    i18n.changeLanguage(code);
    document.documentElement.lang = code;
  };

  return (
    <div>
      <h3 className="mb-1 text-sm font-medium text-gray-100">{t('settings.language.title')}</h3>
      <p className="mb-4 text-sm text-gray-400">{t('settings.language.description')}</p>

      <div className="grid grid-cols-2 gap-3">
        {(Object.entries(SUPPORTED_LANGUAGES) as [Locale, { label: string; dir: string }][]).map(
          ([code, lang]) => {
            const isActive = i18n.language === code;
            return (
              <div
                key={code}
                onClick={() => handleLanguageChange(code)}
                className={`cursor-pointer rounded-lg border-2 p-4 text-center transition-all ${
                  isActive
                    ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                    : 'border-gray-600 hover:border-gray-500 text-gray-300'
                }`}
              >
                <div className="text-sm font-medium">{lang.label}</div>
                {isActive && <div className="mt-1 text-xs text-blue-400">✓</div>}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
}
