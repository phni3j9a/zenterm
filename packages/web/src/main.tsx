import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { initI18n } from './i18n';
// ブランド書体 (見出し・ワードマーク専用)。unicode-range subset 配信なので
// 実際にダウンロードされるのは表示に使う文字のスライスのみ。
import '@fontsource/shippori-mincho/600.css';
import './index.css';

initI18n();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
