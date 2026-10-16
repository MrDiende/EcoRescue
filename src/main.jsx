import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppErrorBoundary from './components/AppErrorBoundary';
import './styles/index.css';
import App from './App';
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
