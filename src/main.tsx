import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './redux/store.ts';
import App from './App.tsx';
import './index.css';
import { I18nProvider } from './i18n';
import { AppToastProvider } from './components/ui/AppToastProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <I18nProvider>
        <AppToastProvider>
          <App />
        </AppToastProvider>
      </I18nProvider>
    </Provider>
  </StrictMode>,
);
