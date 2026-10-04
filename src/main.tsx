import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

// SVG Blue Box with White Microscope Icon (matching app header branding)
const MICROSCOPE_FAVICON_DATA_URI = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' width='64' height='64'%3E%3Crect width='64' height='64' rx='16' fill='%230284c7'/%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='3.6' stroke-linecap='round' stroke-linejoin='round' transform='translate(8, 8) scale(1.5)'%3E%3Cpath d='M6 18h8'/%3E%3Cpath d='M3 22h18'/%3E%3Cpath d='m14 22 .77-1.15a5.57 5.57 0 0 0 .74-2.85V10'/%3E%3Cpath d='m9 14 5-5'/%3E%3Cpath d='M12 7 9 4a2 2 0 0 0-2.83 0L3.34 6.83a2 2 0 0 0 0 2.83l3 3a2 2 0 0 0 2.83 0'/%3E%3Cpath d='M11 17a3 3 0 0 0-3-3H6'/%3E%3Cpath d='M19 13a4.97 4.97 0 0 0-2.07-1.07'/%3E%3C/g%3E%3C/svg%3E`;

// Ensure browser tab favicon is set with the blue microscope icon
(function setMicroscopeFavicon() {
  try {
    const head = document.head || document.getElementsByTagName('head')[0];
    if (head) {
      const existingFavicons = document.querySelectorAll("link[rel*='icon']");
      existingFavicons.forEach(el => el.remove());

      const svgFavicon = document.createElement('link');
      svgFavicon.rel = 'icon';
      svgFavicon.type = 'image/svg+xml';
      svgFavicon.href = MICROSCOPE_FAVICON_DATA_URI;
      head.appendChild(svgFavicon);

      const shortcutLink = document.createElement('link');
      shortcutLink.rel = 'shortcut icon';
      shortcutLink.type = 'image/svg+xml';
      shortcutLink.href = MICROSCOPE_FAVICON_DATA_URI;
      head.appendChild(shortcutLink);

      const appleTouch = document.createElement('link');
      appleTouch.rel = 'apple-touch-icon';
      appleTouch.href = MICROSCOPE_FAVICON_DATA_URI;
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
