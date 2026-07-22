import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import './index.css';
import App from './App';
import { initTheme } from './theme';
import i18n from './i18n';

initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-950 text-gray-400 text-sm">Loading...</div>}>
        <App />
      </Suspense>
    </I18nextProvider>
  </StrictMode>
);
