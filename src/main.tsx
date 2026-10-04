import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

// SVG Blue Blood Drop with White 'D' in the Center
const DROP_D_FAVICON_DATA_URI = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' width='64' height='64'%3E%3Cdefs%3E%3ClinearGradient id='dDrop' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%2338bdf8'/%3E%3Cstop offset='45%25' stop-color='%230284c7'/%3E%3Cstop offset='100%25' stop-color='%230369a1'/%3E%3C/linearGradient%3E%3C/defs%3E%3Cpath d='M32 4 C32 4 10 26 10 41 A22 22 0 0 0 54 41 C54 26 32 4 32 4 Z' fill='url(%23dDrop)'/%3E%3Cpath d='M32 10 C27 17 17 27 16 38 C15 33 17 26 25 17 C28 13 32 10 32 10 Z' fill='%23ffffff' opacity='0.3'/%3E%3Ctext x='32' y='42' fill='%23ffffff' font-family='Arial, Helvetica, sans-serif' font-weight='900' font-size='22' text-anchor='middle' dominant-baseline='central'%3ED%3C/text%3E%3C/svg%3E`;

// Ensure browser tab favicon is set with the blue blood drop 'D' icon
(function setDropDFavicon() {
  try {
    const head = document.head || document.getElementsByTagName('head')[0];
    if (head) {
      const existingFavicons = document.querySelectorAll("link[rel*='icon']");
      existingFavicons.forEach(el => el.remove());

      const svgFavicon = document.createElement('link');
      svgFavicon.rel = 'icon';
      svgFavicon.type = 'image/svg+xml';
      svgFavicon.href = DROP_D_FAVICON_DATA_URI;
      head.appendChild(svgFavicon);

      const shortcutLink = document.createElement('link');
      shortcutLink.rel = 'shortcut icon';
      shortcutLink.type = 'image/svg+xml';
      shortcutLink.href = DROP_D_FAVICON_DATA_URI;
      head.appendChild(shortcutLink);

      const appleTouch = document.createElement('link');
      appleTouch.rel = 'apple-touch-icon';
      appleTouch.href = DROP_D_FAVICON_DATA_URI;
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
