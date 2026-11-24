import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Unregister any stale dev-mode service worker so API routes are never intercepted
if (import.meta.env.DEV && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  }).catch(() => {});
}

createRoot(document.getElementById('root')!).render(<App />);
