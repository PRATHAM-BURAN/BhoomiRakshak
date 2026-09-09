import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useWebSocket } from '../context/WebSocketContext';

export default function OfflineBanner() {
  const { isOnline, pendingSyncCount, triggerSync } = useWebSocket();

  if (isOnline && pendingSyncCount === 0) return null;

  return (
    <div className={`w-full px-4 py-2 flex items-center justify-between z-40 transition-colors ${
      !isOnline ? 'bg-amber-700 text-white' : 'bg-primary-container text-white'
    }`}>
      <div className="flex items-center gap-2.5 text-xs font-semibold">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 text-amber-200 animate-pulse" />
            <span>
              OFFLINE PROTOCOL ACTIVE: Local IndexedDB caching engaged. Reports will autonomously synchronize upon signal restoration.
            </span>
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4 text-secondary-container" />
            <span>
              Signal Restored: {pendingSyncCount} offline report(s) waiting for background transmission.
            </span>
          </>
        )}
      </div>

      {pendingSyncCount > 0 && (
        <button
          onClick={triggerSync}
          className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white text-[11px] font-mono font-bold rounded flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Sync ({pendingSyncCount})</span>
        </button>
      )}
    </div>
  );
}
