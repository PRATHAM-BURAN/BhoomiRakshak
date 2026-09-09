import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getAuthToken } from '../api';
import { getPendingOfflineReports, syncOfflineQueue } from '../utils/offlineQueue';

const WebSocketContext = createContext(null);

export function WebSocketProvider({ children }) {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wsConnected, setWsConnected] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [liveEvent, setLiveEvent] = useState(null);
  const [activeNotification, setActiveNotification] = useState(null);

  // Check pending offline queue count
  const refreshPendingCount = useCallback(async () => {
    try {
      const queue = await getPendingOfflineReports();
      setPendingSyncCount(queue.length);
    } catch {
      setPendingSyncCount(0);
    }
  }, []);

  // Perform offline queue sync
  const triggerSync = useCallback(async () => {
    if (!navigator.onLine) return;
    const token = getAuthToken();
    try {
      const res = await syncOfflineQueue(token);
      if (res.synced > 0) {
        setActiveNotification({
          type: 'success',
          message: `Synchronized ${res.synced} offline report(s) to BhoomiRakshak command center.`
        });
      }
      refreshPendingCount();
    } catch (err) {
      console.warn('Queue sync error:', err.message);
    }
  }, [refreshPendingCount]);

  // Online / Offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    refreshPendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync, refreshPendingCount]);

  // WebSocket connection
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host || 'localhost:5000';
      // In Vite dev mode, port 3000 proxies /ws to port 5000
      const wsUrl = `${protocol}//${host}/ws`;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
        // Subscribe to user's assigned region if available
        if (user?.region_id) {
          ws.send(JSON.stringify({ action: 'subscribe_region', region_id: user.region_id }));
        }
      };

      ws.onmessage = (e) => {
        try {
          const packet = JSON.parse(e.data);
          setLiveEvent(packet);

          if (packet.event === 'new_alert') {
            setActiveNotification({
              type: 'alert',
              severity: packet.data.severity,
              message: `EMERGENCY ALERT: ${packet.data.message}`,
              data: packet.data
            });
          } else if (packet.event === 'new_report') {
            setActiveNotification({
              type: 'info',
              message: `New field report filed in ${packet.data.region_name || 'monitored sector'}`
            });
          }
        } catch (err) {
          console.error('WS Parse Error:', err);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimeout = setTimeout(connect, 4000);
      };

      ws.onerror = () => {
        setWsConnected(false);
      };
    }

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [user]);

  const dismissNotification = () => setActiveNotification(null);

  return (
    <WebSocketContext.Provider
      value={{
        isOnline,
        wsConnected,
        pendingSyncCount,
        liveEvent,
        activeNotification,
        dismissNotification,
        refreshPendingCount,
        triggerSync
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}
