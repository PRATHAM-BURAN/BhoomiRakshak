import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import { useWebSocket } from './context/WebSocketContext';
import { api } from './api';

// Components
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import OfflineBanner from './components/OfflineBanner';
import AddRegionModal from './components/AddRegionModal';
import { RiskNotificationPopup } from './components/RiskNotificationPopup';
import { AlertModalProvider } from './context/AlertModalContext';

// Views
import AdminDashboard from './views/AdminDashboard';
import GISRiskMap from './views/GISRiskMap';
import AlertsConsole from './views/AlertsConsole';
import FieldReportsReview from './views/FieldReportsReview';
import OfficerManagement from './views/OfficerManagement';
import CitizenPortal from './views/CitizenPortal';
import FieldOfficerApp from './views/FieldOfficerApp';
import AnalyticsView from './views/AnalyticsView';
import SystemSettings from './views/SystemSettings';
import LoginModal from './views/LoginModal';

export default function App() {
  const { user, role } = useAuth();
  const { activeNotification, dismissNotification, liveEvent } = useWebSocket();

  // Navigation State - defaults safely to citizen view unless authorized admin/field officer
  const getPermittedView = useCallback((view, userRole) => {
    if (userRole === 'admin') {
      return view || 'dashboard';
    }
    if (userRole === 'field_officer') {
      const allowed = ['field-officer', 'gis-map', 'citizen', 'reports-review'];
      return allowed.includes(view) ? view : 'field-officer';
    }
    // citizen or guest/unauthenticated
    const citizenAllowed = ['citizen', 'gis-map'];
    return citizenAllowed.includes(view) ? view : 'citizen';
  }, []);

  const [currentView, setCurrentView] = useState(() => {
    return role === 'admin' ? 'dashboard' : (role === 'field_officer' ? 'field-officer' : 'citizen');
  });

  // Core Data Stores (Zero mock data - populated strictly from DB)
  const [regions, setRegions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState([]);
  const [riskZones, setRiskZones] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [historicalLandslides, setHistoricalLandslides] = useState([]);

  // Modals
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAddRegionModal, setShowAddRegionModal] = useState(false);

  // Master Data Refresh
  const fetchData = useCallback(async () => {
    try {
      const [regionsRes, alertsRes, reportsRes, zonesRes, analyticsRes, landslidesRes] = await Promise.allSettled([
        api.getRegions(),
        api.getAlerts(),
        api.getReports(),
        api.getRiskZones(),
        api.getAnalytics(),
        api.getHistoricalLandslides()
      ]);

      if (regionsRes.status === 'fulfilled') setRegions(regionsRes.value.regions || []);
      if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.alerts || []);
      if (reportsRes.status === 'fulfilled') setReports(reportsRes.value.reports || []);
      if (zonesRes.status === 'fulfilled') setRiskZones(zonesRes.value.risk_zones || []);
      if (analyticsRes.status === 'fulfilled') setAnalytics(analyticsRes.value || null);
      if (landslidesRes.status === 'fulfilled') setHistoricalLandslides(landslidesRes.value.historical_landslides || []);
    } catch (err) {
      console.warn('Data pull failed:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, user]);

  // Handle live WebSocket update events
  useEffect(() => {
    if (!liveEvent) return;
    if (liveEvent.event === 'new_alert') {
      setAlerts(prev => [liveEvent.data, ...prev]);
    } else if (liveEvent.event === 'new_report') {
      setReports(prev => [liveEvent.data, ...prev]);
    } else if (liveEvent.event === 'risk_zone_updated') {
      setRiskZones(prev => {
        const idx = prev.findIndex(z => z.region_id === liveEvent.data.region_id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = liveEvent.data;
          return updated;
        }
        return [liveEvent.data, ...prev];
      });
    } else if (liveEvent.event === 'report_status_updated') {
      setReports(prev => prev.map(r => r.id === liveEvent.data.id ? liveEvent.data : r));
    }
  }, [liveEvent]);

  // Enforce permitted views strictly on role changes
  useEffect(() => {
    setCurrentView(prev => getPermittedView(prev, role));
  }, [role, getPermittedView]);

  // Strict view switcher guard
  const handleViewChange = (newView) => {
    const target = newView === 'alerts' ? (role === 'admin' ? 'alerts-console' : 'citizen') : newView;
    const permitted = getPermittedView(target, role);
    if (permitted !== target) {
      console.warn(`[RBAC] Access denied: view '${newView}' restricted for role '${role}'. Defaulted to '${permitted}'.`);
    }
    setCurrentView(permitted);
  };

  return (
    <AlertModalProvider onNavigateToMap={(alert) => handleViewChange('gis-map')}>
      <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-surface flex flex-col antialiased selection:bg-primary-container selection:text-white">
      {/* 1. Global Offline & Auto-Sync Warning Banner */}
      <OfflineBanner />

      {/* 2. Top Operational Command Header */}
      <Navbar
        currentView={currentView}
        setCurrentView={handleViewChange}
        onOpenLoginModal={() => setShowLoginModal(true)}
        onRefreshData={fetchData}
      />

      {/* 3. Live Alert Toast Banner */}
      {activeNotification && (
        <div className="fixed top-20 right-4 z-50 max-w-md bg-white rounded-lg shadow-xl border-l-4 border-rose-600 p-4 flex items-start justify-between gap-3 animate-in slide-in-from-right duration-200">
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-rose-700 block">
              Emergency Satellite / Telemetry Trigger
            </span>
            <p className="text-xs font-bold text-on-surface mt-0.5">
              {activeNotification.message}
            </p>
          </div>
          <button
            onClick={dismissNotification}
            className="text-on-surface-variant hover:text-on-surface text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 4. App Body: Desktop Left Rail + Fluid Workspace */}
      <div className="flex flex-1 w-full max-w-full overflow-hidden">
        {/* Pinned dark navigation rail (strictly hidden for citizens and guests) */}
        {(role === 'admin' || role === 'field_officer') && currentView !== 'citizen' && currentView !== 'field-officer' && (
          <Sidebar
            currentView={currentView}
            setCurrentView={handleViewChange}
            alertCount={alerts.length}
            reportCount={reports.filter(r => r.status === 'pending').length}
          />
        )}

        {/* Main Dynamic Viewport with Strict Role Protection */}
        <main className="flex-1 min-w-0 max-w-full overflow-y-auto bg-surface">
          {currentView === 'dashboard' && role === 'admin' && (
            <AdminDashboard
              analytics={analytics}
              alerts={alerts}
              reports={reports}
              regions={regions}
              riskZones={riskZones}
              historicalLandslides={historicalLandslides}
              setCurrentView={handleViewChange}
              onOpenBroadcastModal={() => setCurrentView('alerts-console')}
              onOpenAddRegionModal={() => setShowAddRegionModal(true)}
            />
          )}

          {currentView === 'gis-map' && (
            <GISRiskMap
              regions={regions}
              riskZones={riskZones}
              reports={reports}
              alerts={alerts}
              historicalLandslides={historicalLandslides}
            />
          )}

          {currentView === 'alerts-console' && role === 'admin' && (
            <AlertsConsole
              alerts={alerts}
              regions={regions}
              onAlertBroadcasted={(newAlert) => {
                setAlerts(prev => [newAlert, ...prev]);
                fetchData();
              }}
            />
          )}

          {currentView === 'reports-review' && (role === 'admin' || role === 'field_officer') && (
            <FieldReportsReview
              reports={reports}
              onReportUpdated={(updated) => {
                setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
                fetchData();
              }}
              setCurrentView={handleViewChange}
            />
          )}

          {currentView === 'officer-management' && role === 'admin' && (
            <OfficerManagement regions={regions} />
          )}

          {currentView === 'analytics' && role === 'admin' && (
            <AnalyticsView analytics={analytics} />
          )}

          {currentView === 'settings' && role === 'admin' && (
            <SystemSettings
              onRefreshData={fetchData}
              onOpenAddRegionModal={() => setShowAddRegionModal(true)}
            />
          )}

          {currentView === 'citizen' && (
            <CitizenPortal
              regions={regions}
              alerts={alerts}
              onReportSubmitted={(newRep) => {
                setReports(prev => [newRep, ...prev]);
                fetchData();
              }}
            />
          )}

          {currentView === 'field-officer' && (role === 'admin' || role === 'field_officer') && (
            <FieldOfficerApp
              regions={regions}
              onReportSubmitted={(newRep) => {
                setReports(prev => [newRep, ...prev]);
                fetchData();
              }}
            />
          )}

          {/* Access Denied Security Fallback if an unauthorized route is forced */}
          {['dashboard', 'alerts-console', 'officer-management', 'analytics', 'settings'].includes(currentView) && role !== 'admin' && (
            <div className="p-8 max-w-lg mx-auto text-center mt-12 bg-white rounded-xl border border-rose-200 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <span className="text-xl font-bold">⚠️</span>
              </div>
              <h2 className="text-lg font-bold text-on-surface">Institutional Clearance Required</h2>
              <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                The Administrative Command Deck is strictly restricted to NDMA and GSI verified administrators.
              </p>
              <button
                onClick={() => setCurrentView(role === 'field_officer' ? 'field-officer' : 'citizen')}
                className="mt-4 px-4 py-2 bg-primary text-white rounded text-xs font-bold hover:bg-primary-container transition-colors shadow-sm"
              >
                Return to {role === 'field_officer' ? 'Field Operations' : 'Citizen Portal'}
              </button>
            </div>
          )}

          {currentView === 'field-officer' && role !== 'admin' && role !== 'field_officer' && (
            <div className="p-8 max-w-lg mx-auto text-center mt-12 bg-white rounded-xl border border-amber-200 shadow-sm">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <span className="text-xl font-bold">🛡️</span>
              </div>
              <h2 className="text-lg font-bold text-on-surface">Field Commander Clearance Required</h2>
              <p className="text-xs text-on-surface-variant mt-2 leading-relaxed">
                The Field Operations Command app is restricted to designated district officers and emergency responders.
              </p>
              <button
                onClick={() => setCurrentView('citizen')}
                className="mt-4 px-4 py-2 bg-primary text-white rounded text-xs font-bold hover:bg-primary-container transition-colors shadow-sm"
              >
                Return to Citizen Portal
              </button>
            </div>
          )}
        </main>
      </div>

      {/* 5. Mobile Persistent Bottom Navigation */}
      <BottomNav
        currentView={currentView}
        setCurrentView={handleViewChange}
      />

      {/* 6. Modals */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        regions={regions}
      />

      <AddRegionModal
        isOpen={showAddRegionModal}
        onClose={() => setShowAddRegionModal(false)}
        onRegionCreated={(newReg) => {
          setRegions(prev => [...prev, newReg]);
          fetchData();
        }}
      />

      {/* 7. Real-Time Risk Emergency Pop-up Alert */}
      <RiskNotificationPopup onNavigateToMap={(alert) => handleViewChange('gis-map')} />
    </div>
    </AlertModalProvider>
  );
}

