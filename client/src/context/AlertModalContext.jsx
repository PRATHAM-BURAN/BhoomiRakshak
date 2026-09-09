import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from './AuthContext';
import { useWebSocket } from './WebSocketContext';
import { api } from '../api';

const AlertModalContext = createContext(null);

export function AlertModalProvider({ children, onNavigateToMap }) {
  const { user, role, isAuthenticated } = useAuth();
  const { liveEvent } = useWebSocket();

  // Queue of alerts waiting for acknowledgment
  const [alertQueue, setAlertQueue] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('bhoomi_alert_sound') === 'true';
  });
  const [acknowledgedIds, setAcknowledgedIds] = useState(() => new Set());

  // Audio Context Ref (initialized after first user interaction)
  const audioCtxRef = useRef(null);

  // Play synthesized emergency alert tone using Web Audio API
  const playAlertTone = useCallback((severity) => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const sev = (severity || 'HIGH').toUpperCase();
      if (sev === 'CRITICAL') {
        // Urgent dual siren tone
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      } else {
        // High alert ping
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch (err) {
      // Audio autoplay restrictions before user gesture
    }
  }, [soundEnabled]);

  // Toggle sound with explicit user click gesture (primes Web Audio API)
  const toggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    localStorage.setItem('bhoomi_alert_sound', String(nextState));

    if (nextState) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
          if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
        }
      } catch (e) {}
    }
  };

  // Role and Region Scoping Checker:
  // admin -> always show
  // field_officer -> show if alert.region_id === user.region_id || alert.severity === 'CRITICAL'
  // citizen -> show if alert.region_id === user.region_id || alert.region_ids.includes(...) || alert.severity === 'CRITICAL'
  const shouldUserSeeAlert = useCallback((alert) => {
    if (!alert) return false;
    if (!isAuthenticated || !user) return false;

    // Admin receives all regional alerts for central oversight
    if (role === 'admin' || user.role === 'admin') {
      return true;
    }

    const alertSeverity = (alert.severity || 'MODERATE').toUpperCase();
    // Critical disaster alerts always interrupt across all emergency sectors
    if (alertSeverity === 'CRITICAL') {
      return true;
    }

    const userRegionId = user.region_id;
    const userRegionIds = Array.isArray(user.region_ids) ? user.region_ids : [];

    // Check primary region match
    if (alert.region_id && userRegionId && alert.region_id === userRegionId) {
      return true;
    }

    // Check multi-district matches
    if (alert.region_id && userRegionIds.includes(alert.region_id)) {
      return true;
    }

    if (Array.isArray(alert.region_ids)) {
      if (userRegionId && alert.region_ids.includes(userRegionId)) return true;
      if (userRegionIds.some(r => alert.region_ids.includes(r))) return true;
    }

    return false;
  }, [user, role, isAuthenticated]);

  // Enqueue new alert safely with deduplication
  const enqueueAlert = useCallback((rawAlert) => {
    if (!rawAlert || !rawAlert.id) return;
    if (acknowledgedIds.has(rawAlert.id)) return;

    // Check role / region permissions
    if (!shouldUserSeeAlert(rawAlert)) {
      return;
    }

    setAlertQueue(prev => {
      if (prev.some(a => a.id === rawAlert.id)) {
        return prev; // Already queued
      }
      // Play audio chime
      playAlertTone(rawAlert.severity);
      return [...prev, rawAlert];
    });
  }, [acknowledgedIds, shouldUserSeeAlert, playAlertTone]);

  // Offline / Reconnect Recovery: Fetch unacknowledged alerts from last 24h
  const fetchUnacknowledged = useCallback(async () => {
    if (!isAuthenticated || !user) return;
    try {
      const res = await api.getUnacknowledgedAlerts(24);
      if (res && Array.isArray(res.alerts)) {
        res.alerts.forEach(alert => {
          enqueueAlert(alert);
        });
      }
    } catch (err) {
      console.warn('[OFFLINE RECOVERY] Unacknowledged alerts fetch notice:', err.message);
    }
  }, [isAuthenticated, user, enqueueAlert]);

  // Initial fetch on mount / user change
  useEffect(() => {
    fetchUnacknowledged();
  }, [fetchUnacknowledged]);

  // Listen to browser network reconnect event
  useEffect(() => {
    const handleOnline = () => {
      console.log('[NETWORK] Reconnected to internet. Fetching unacknowledged alerts...');
      fetchUnacknowledged();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchUnacknowledged]);

  // 1. Supabase Realtime Subscription: alerts-global
  useEffect(() => {
    if (!supabase) return;
    console.log('[REALTIME] Connecting to Supabase channel alerts-global...');
    const channel = supabase
      .channel('alerts-global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        (payload) => {
          console.log('[SUPABASE REALTIME INSERT] New alert detected:', payload.new);
          const alert = payload.new;
          enqueueAlert(alert);
        }
      )
      .subscribe((status) => {
        console.log('[SUPABASE REALTIME] Subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enqueueAlert]);

  // 2. WebSocket Fallback Subscription (WebSocketContext liveEvent)
  useEffect(() => {
    if (!liveEvent) return;
    if (liveEvent.event === 'new_alert' && liveEvent.data) {
      console.log('[WS REALTIME] New alert received via WebSocket:', liveEvent.data);
      enqueueAlert(liveEvent.data);
    } else if (liveEvent.event === 'risk_notification' && liveEvent.data) {
      console.log('[WS RISK NOTIFICATION] Emergency broadcast received:', liveEvent.data);
      enqueueAlert({
        id: liveEvent.data.alert_id,
        severity: liveEvent.data.severity,
        message: liveEvent.data.message,
        action_recommendation: liveEvent.data.action_recommendation,
        region_id: liveEvent.data.region_id,
        created_at: liveEvent.data.timestamp
      });
    }
  }, [liveEvent, enqueueAlert]);

  // Acknowledge current alert
  const acknowledgeCurrentAlert = async () => {
    if (alertQueue.length === 0) return;
    const alertToAck = alertQueue[0];

    // Mark acknowledged locally
    setAcknowledgedIds(prev => new Set([...prev, alertToAck.id]));
    setAlertQueue(prev => prev.slice(1));

    // Send acknowledgment to backend
    if (alertToAck.id) {
      try {
        await api.acknowledgeAlert(alertToAck.id);
        console.log(`[ALERT ACKNOWLEDGED] Recorded acknowledgment for alert ${alertToAck.id}`);
      } catch (err) {
        console.warn('Failed to record acknowledgment:', err.message);
      }
    }
  };

  // View on Map handler
  const viewCurrentAlertOnMap = () => {
    if (alertQueue.length === 0) return;
    const alertToView = alertQueue[0];

    // Dismiss from queue and navigate
    acknowledgeCurrentAlert();
    if (onNavigateToMap) {
      onNavigateToMap(alertToView);
    }
  };

  const currentAlert = alertQueue[0] || null;

  return (
    <AlertModalContext.Provider
      value={{
        currentAlert,
        queueLength: alertQueue.length,
        soundEnabled,
        toggleSound,
        acknowledgeCurrentAlert,
        viewCurrentAlertOnMap,
        enqueueAlert
      }}
    >
      {children}
    </AlertModalContext.Provider>
  );
}

export function useAlertModal() {
  const context = useContext(AlertModalContext);
  if (!context) {
    throw new Error('useAlertModal must be used within an AlertModalProvider');
  }
  return context;
}
