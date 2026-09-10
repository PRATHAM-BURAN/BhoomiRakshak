import React from 'react';
import { 
  LayoutDashboard, 
  Map, 
  AlertTriangle, 
  ClipboardCheck, 
  Radio,
  ShieldAlert,
  LogIn
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function BottomNav({ currentView, setCurrentView, onOpenLoginModal }) {
  const { role, user } = useAuth();

  let items = [];
  if (role === 'admin') {
    items = [
      { id: 'dashboard', label: 'Command', icon: LayoutDashboard },
      { id: 'gis-map', label: 'GIS Map', icon: Map },
      { id: 'field-officer', label: 'Field App', icon: Radio },
      { id: 'alerts-console', label: 'Alerts', icon: AlertTriangle },
      { id: 'reports-review', label: 'Reports', icon: ClipboardCheck }
    ];
  } else if (role === 'field_officer') {
    items = [
      { id: 'field-officer', label: 'Field Ops', icon: Radio },
      { id: 'gis-map', label: 'GIS Map', icon: Map },
      { id: 'reports-review', label: 'Reports', icon: ClipboardCheck },
      { id: 'citizen', label: 'Public View', icon: ShieldAlert }
    ];
  } else {
    // citizen or guest
    items = [
      { id: 'citizen', label: 'Community', icon: ShieldAlert },
      { id: 'gis-map', label: 'Risk Map', icon: Map },
      ...(!user ? [{ id: 'login-action', label: 'Sign In', icon: LogIn, isAction: true }] : [])
    ];
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-primary text-white border-t border-primary-container/40 z-40 flex items-center justify-around px-2 shadow-lg backdrop-blur-sm">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              if (item.isAction) {
                if (onOpenLoginModal) onOpenLoginModal();
              } else {
                setCurrentView(item.id);
              }
            }}
            className={`flex flex-col items-center justify-center w-full py-1 text-[10px] font-semibold transition-all touch-manipulation active:scale-95 ${
              item.isAction
                ? 'text-emerald-300 hover:text-emerald-200'
                : (isActive ? 'text-emerald-400 font-bold' : 'text-on-primary-container hover:text-white')
            }`}
          >
            <Icon className="w-4 h-4 mb-0.5" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
