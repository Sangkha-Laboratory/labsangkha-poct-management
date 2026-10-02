import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { DEFAULT_HOSPITAL_LOGO_BASE64 } from './assets/hospitalLogoBase64.ts';
import './index.css';

// Ensure browser tab favicon is set with Sangkha Hospital Logo
(function setHospitalFavicon() {
  try {
    const head = document.head || document.getElementsByTagName('head')[0];
    if (head) {
      const existingFavicons = document.querySelectorAll("link[rel*='icon']");
      existingFavicons.forEach(el => el.remove());

      const base64Favicon = document.createElement('link');
      base64Favicon.rel = 'icon';
      base64Favicon.type = 'image/png';
      base64Favicon.href = DEFAULT_HOSPITAL_LOGO_BASE64;
      head.appendChild(base64Favicon);

      const shortcutLink = document.createElement('link');
      shortcutLink.rel = 'shortcut icon';
      shortcutLink.href = DEFAULT_HOSPITAL_LOGO_BASE64;
      head.appendChild(shortcutLink);

      const appleTouch = document.createElement('link');
      appleTouch.rel = 'apple-touch-icon';
      appleTouch.href = DEFAULT_HOSPITAL_LOGO_BASE64;
      head.appendChild(appleTouch);
    }
  } catch (e) {
    console.warn('Favicon initialization notice:', e);
  }
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
