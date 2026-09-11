import React from 'react';
import { 
  LayoutDashboard, 
  Map, 
  AlertTriangle, 
  ClipboardCheck, 
  Users, 
  BarChart3, 
  Settings, 
  Shield, 
  Radio,
  History
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ currentView, setCurrentView, alertCount = 0, reportCount = 0 }) {
  const { role } = useAuth();

  const navItems = role === 'admin' ? [
    { id: 'dashboard', label: 'Dashboard Home', icon: LayoutDashboard },
    { id: 'gis-map', label: 'GIS Risk Map', icon: Map },
    { 
      id: 'historical-analysis', 
      label: 'Historical Analysis', 
      icon: History,
      badge: '1,094 EVENTS',
      badgeColor: 'bg-indigo-600 text-white'
    },
    { 
      id: 'alerts-console', 
      label: 'Alerts Console', 
      icon: AlertTriangle,
      badge: alertCount > 0 ? `${alertCount} ACTIVE` : null,
      badgeColor: 'bg-red-600 text-white'
    },
    { 
      id: 'reports-review', 
      label: 'Field Reports Review', 
      icon: ClipboardCheck,
      badge: reportCount > 0 ? `${reportCount} PENDING` : null,
      badgeColor: 'bg-amber-500 text-white'
    },
    { id: 'officer-management', label: 'Officer Management', icon: Users },
    { id: 'analytics', label: 'Analytics & Trends', icon: BarChart3 },
    { id: 'settings', label: 'System Settings', icon: Settings }
  ] : [
    { id: 'field-officer', label: 'Field Operations', icon: Radio },
    { id: 'gis-map', label: 'GIS Risk Map', icon: Map },
    { 
      id: 'historical-analysis', 
      label: 'Historical Analysis', 
      icon: History,
      badge: '1,094 EVENTS',
      badgeColor: 'bg-indigo-600 text-white'
    },
    { 
      id: 'reports-review', 
      label: 'Field Reports Review', 
      icon: ClipboardCheck,
      badge: reportCount > 0 ? `${reportCount} PENDING` : null,
      badgeColor: 'bg-amber-500 text-white'
    }
  ];

  return (
    <aside className="w-64 bg-primary text-on-primary flex-shrink-0 flex flex-col justify-between hidden md:flex border-r border-primary-container shadow-sm select-none">
      <div className="flex flex-col">
        {/* Hub Header */}
        <div className="p-4 border-b border-primary-container bg-primary-container/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-wider font-bold text-white">
              Regional Core
            </span>
          </div>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-800/60">
            Zone 1 - 8 NER
          </span>
        </div>

        {/* Navigation List */}
        <nav className="p-3 flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded text-xs font-semibold tracking-wide transition-colors text-left ${
                  isActive
                    ? 'bg-primary-container text-white shadow-sm font-bold border-l-2 border-emerald-400'
                    : 'text-on-primary-container hover:bg-primary-container/40 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-on-primary-container'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Institutional Node Details at Bottom */}
      <div className="p-4 bg-primary-container/40 border-t border-primary-container flex flex-col gap-2">
        <div className="flex items-center justify-between font-mono text-[10px] text-on-primary-container">
          <span className="uppercase tracking-wider">Node Sentinel</span>
          <span className="font-bold text-emerald-400">V2.8.4-PROD</span>
        </div>
        <div className="p-2.5 rounded bg-primary flex items-center gap-2.5 border border-primary-container">
          <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[11px] font-bold text-white leading-tight">NDMA • NEC Federated</span>
            <span className="font-mono text-[9px] text-on-primary-container">Shillong Command Hub 01</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
