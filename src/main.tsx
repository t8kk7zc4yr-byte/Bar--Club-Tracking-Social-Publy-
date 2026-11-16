import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import './styles/tokens.css';
import './styles/base.css';
import App from './App';
import { initSession } from './data/session';
import { applyTheme, watchSystemTheme } from './data/theme';

applyTheme();
watchSystemTheme();
initSession();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
);
