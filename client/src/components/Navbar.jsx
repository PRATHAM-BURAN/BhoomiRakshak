import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  RefreshCw, 
  User, 
  LogOut, 
  LogIn,
  SlidersHorizontal,
  ChevronDown,
  Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';

export default function Navbar({ 
  currentView, 
  setCurrentView, 
  onOpenLoginModal, 
  onRefreshData 
}) {
  const { user, role, logout } = useAuth();
  const { wsConnected } = useWebSocket();
  const [seconds, setSeconds] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState('');

  // Live IST Date & Time clock ticker
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const datePart = now.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
      });
      const timePart = now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata'
      });
      setCurrentDateTime(`${datePart} • ${timePart} IST`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cycle sync ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(s => (s >= 180 ? 0 : s + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `00:${m}:${s}`;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (onRefreshData) await onRefreshData();
    setSeconds(0);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <header className="h-16 w-full max-w-full bg-surface/95 border-b border-outline-variant/40 backdrop-blur-md sticky top-0 z-30 px-3 md:px-5 flex items-center justify-between gap-2">
      {/* Left branding & Telemetry state */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-white shadow-sm shrink-0">
          <ShieldAlert className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex flex-col shrink-0">
          <span className="font-bold text-sm sm:text-base tracking-tight text-on-surface leading-none whitespace-nowrap">
            BhoomiRakshak
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-on-surface-variant font-semibold mt-0.5 whitespace-nowrap">
            AI Landslide Sentinel • NER
          </span>
        </div>

        <div className="hidden 2xl:flex items-center gap-1.5 px-3 py-1 bg-surface-container-high rounded-full text-xs font-semibold text-on-surface whitespace-nowrap shrink-0">
          <Activity className="w-3.5 h-3.5 text-secondary shrink-0" />
          <span className="uppercase tracking-wider text-[10px] whitespace-nowrap">
            NER Telemetry: Active Monitoring • 8 States
          </span>
        </div>

        <div className="hidden xl:flex items-center gap-1.5 font-mono text-[11px] font-semibold text-on-surface-variant whitespace-nowrap shrink-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${wsConnected ? 'bg-secondary' : 'bg-amber-500'}`} />
          <span className="whitespace-nowrap">Gateway: {wsConnected ? 'Connected' : 'Reconnecting...'}</span>
        </div>
      </div>

      {/* Right controls: Date & Time clock, cycle sync, minimised refresh, role switch, auth */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Live IST Date & Time Clock Widget */}
        <div className="hidden lg:flex items-center gap-1.5 bg-surface-container-low px-2 py-1 rounded border border-outline-variant/40 text-xs shadow-xs whitespace-nowrap shrink-0">
          <Clock className="w-3.5 h-3.5 text-sky-500 animate-pulse shrink-0" />
          <span className="font-mono font-bold text-[11px] text-on-surface tracking-tight whitespace-nowrap">
            {currentDateTime}
          </span>
        </div>

        {/* Cycle Sync Timer */}
        <div className="hidden md:flex items-center gap-1.5 bg-surface-container-low px-2 py-1 rounded border border-outline-variant/30 text-xs whitespace-nowrap shrink-0">
          <span className="text-on-surface-variant font-medium uppercase text-[10px] whitespace-nowrap">Sync:</span>
          <span className="font-mono font-bold text-secondary text-xs whitespace-nowrap">{formatTimer(seconds)}</span>
        </div>

        {/* Minimised Refresh Button (Icon-Only Compact Tool) */}
        <button
          onClick={handleRefresh}
          title="Force Telemetry Sync"
          aria-label="Force Telemetry Sync"
          className="p-1.5 rounded bg-surface-container-low hover:bg-surface-container-high text-on-surface transition-colors border border-outline-variant/30 shrink-0 flex items-center justify-center shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-primary shrink-0 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>

        {/* View Switcher strictly governed by User Role (Citizens CANNOT access Admin or Field Officer) */}
        {role === 'admin' ? (
          <div className="relative flex items-center bg-primary text-white px-2.5 py-1 rounded text-xs font-semibold shadow-sm whitespace-nowrap shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-emerald-400 shrink-0" />
            <select
              value={currentView}
              onChange={(e) => setCurrentView(e.target.value)}
              className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer"
            >
              <option value="dashboard" className="text-gray-900">Admin Command Deck</option>
              <option value="gis-map" className="text-gray-900">GIS Risk Map</option>
              <option value="alerts-console" className="text-gray-900">Alerts Broadcast</option>
              <option value="field-officer" className="text-gray-900">Field Officer Mode</option>
              <option value="citizen" className="text-gray-900">Citizen Warning Feed</option>
            </select>
          </div>
        ) : role === 'field_officer' ? (
          <div className="relative flex items-center bg-emerald-800 text-white px-2.5 py-1 rounded text-xs font-semibold shadow-sm whitespace-nowrap shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-emerald-300 shrink-0" />
            <select
              value={currentView}
              onChange={(e) => setCurrentView(e.target.value)}
              className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer"
            >
              <option value="field-officer" className="text-gray-900">Field Officer Portal</option>
              <option value="gis-map" className="text-gray-900">GIS Risk Map</option>
              <option value="citizen" className="text-gray-900">Citizen Warning Feed</option>
            </select>
          </div>
        ) : (
          /* Citizen / Guest Role: Strictly limited to Citizen Portal and GIS Map */
          <div className="relative flex items-center bg-slate-800 text-white px-2.5 py-1 rounded text-xs font-semibold shadow-sm whitespace-nowrap shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-emerald-400 shrink-0" />
            <select
              value={currentView === 'gis-map' ? 'gis-map' : 'citizen'}
              onChange={(e) => setCurrentView(e.target.value)}
              className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer"
            >
              <option value="citizen" className="text-gray-900">Community Citizen Portal</option>
              <option value="gis-map" className="text-gray-900">Public GIS Risk Map</option>
            </select>
          </div>
        )}

        {/* User Account / Profile action with Truncated Name */}
        {user ? (
          <div className="flex items-center gap-1.5 pl-0.5 shrink-0">
            <div className="hidden sm:flex flex-col text-right max-w-[110px] md:max-w-[150px] shrink-0">
              <span className="text-xs font-bold text-on-surface leading-tight truncate block" title={user.name}>
                {user.name}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-secondary font-bold whitespace-nowrap block">
                {user.role === 'admin' ? 'NDMA Admin' : (user.role === 'field_officer' ? 'Field Master' : 'Citizen Member')}
              </span>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded hover:bg-rose-50 text-rose-700 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenLoginModal}
            className="px-2.5 py-1 bg-primary text-white text-xs font-semibold rounded hover:bg-primary-container transition-colors shadow-sm flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <LogIn className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline">Login / Register</span>
          </button>
        )}
      </div>
    </header>
  );
}
