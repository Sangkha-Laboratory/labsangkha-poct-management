import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

// SVG Bold DTX Text Favicon (Frameless, full-width, clean blue gradient)
const DTX_FAVICON_DATA_URI = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' width='64' height='64'%3E%3Cdefs%3E%3ClinearGradient id='dtxGrad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%230284c7'/%3E%3Cstop offset='100%25' stop-color='%230369a1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ctext x='32' y='36' fill='url(%23dtxGrad)' font-family='%27Arial Black%27, Impact, %27Segoe UI%27, -apple-system, sans-serif' font-weight='900' font-size='28' letter-spacing='-1.5' text-anchor='middle' dominant-baseline='central'%3EDTX%3C/text%3E%3C/svg%3E`;

// Ensure browser tab favicon is set with the bold DTX icon
(function setDtxFavicon() {
  try {
    const head = document.head || document.getElementsByTagName('head')[0];
    if (head) {
      const existingFavicons = document.querySelectorAll("link[rel*='icon']");
      existingFavicons.forEach(el => el.remove());

      const svgFavicon = document.createElement('link');
      svgFavicon.rel = 'icon';
      svgFavicon.type = 'image/svg+xml';
      svgFavicon.href = DTX_FAVICON_DATA_URI;
      head.appendChild(svgFavicon);

      const shortcutLink = document.createElement('link');
      shortcutLink.rel = 'shortcut icon';
      shortcutLink.type = 'image/svg+xml';
      shortcutLink.href = DTX_FAVICON_DATA_URI;
      head.appendChild(shortcutLink);

      const appleTouch = document.createElement('link');
      appleTouch.rel = 'apple-touch-icon';
      appleTouch.href = DTX_FAVICON_DATA_URI;
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
