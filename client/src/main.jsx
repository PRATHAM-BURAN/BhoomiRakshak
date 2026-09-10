import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { LanguageProvider } from './context/LanguageContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <WebSocketProvider>
          <LanguageProvider>
            <App />
          </LanguageProvider>
        </WebSocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
