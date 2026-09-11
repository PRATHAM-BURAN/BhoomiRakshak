import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  CloudRain, 
  Compass, 
  Layers, 
  Radio, 
  Satellite, 
  ArrowRight,
  Plus,
  Clock
} from 'lucide-react';
import SeverityChip from '../components/SeverityChip';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function AdminDashboard({
  analytics,
  alerts = [],
  reports = [],
  regions = [],
  riskZones = [],
  historicalLandslides = [],
  setCurrentView,
  onOpenBroadcastModal,
  onOpenAddRegionModal
}) {
  const { role } = useAuth();
  const { t } = useLanguage();

  // Find any active critical or high alerts for the top emergency banner
  const criticalAlert = alerts.find(a => a.severity === 'CRITICAL' || a.severity === 'HIGH');

  // KPI Metrics directly from real DB analytics
  const activeAlertsCount = analytics?.alerts?.total || alerts.length || 0;
  const criticalCount = analytics?.alerts?.critical || alerts.filter(a => a.severity === 'CRITICAL').length || 0;
  const highCount = analytics?.alerts?.high || alerts.filter(a => a.severity === 'HIGH').length || 0;
  const modCount = analytics?.alerts?.moderate || alerts.filter(a => a.severity === 'MODERATE').length || 0;
  const lowCount = analytics?.alerts?.low || alerts.filter(a => a.severity === 'LOW').length || 0;

  const riskZonesCount = analytics?.risk_zones?.total_zones || riskZones.length || 0;
  const pendingReportsCount = analytics?.reports?.pending || reports.filter(r => r.status === 'pending').length || 0;
  const monitoredDistrictsCount = analytics?.operational?.monitored_regions || regions.length || 0;

  return (
    <div className="flex flex-col w-full pb-16">
      {/* 1. Dynamic Critical Emergency Alert Banner (Visible only if real critical alert is active) */}
      {criticalAlert && (
        <div className="bg-rose-950 text-white px-4 md:px-6 py-3 border-b-2 border-rose-500 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-md animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] bg-rose-800 text-rose-200 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  ALERT CODE: {criticalAlert.id.slice(0, 8).toUpperCase()}
                </span>
                <span className="text-xs font-bold text-rose-300 uppercase">
                  {criticalAlert.region_name || 'Immediate Protocol Tier-1'}
                </span>
              </div>
              <p className="text-sm font-bold text-white mt-0.5 leading-snug">
                {criticalAlert.message}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setCurrentView('alerts-console')}
              className="px-3 py-1 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold rounded flex items-center gap-1.5 transition-colors"
            >
              <span>View Emergency Dispatch</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Operational Sub-Header */}
      <div className="bg-white border-b border-outline-variant/30 px-4 md:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-on-surface-variant">
              NDMA-NEC Autonomous Threat Deck
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            <span className="text-[10px] font-mono text-secondary font-bold">OPERATIONAL LIVE</span>
          </div>
          <h1 className="text-lg md:text-xl font-bold text-on-surface tracking-tight">
            Integrated Disaster Analytics & Slope Early Warning System
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap shrink-0">
          <div className="hidden xl:flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1.5 rounded border border-outline-variant/30 text-xs whitespace-nowrap shrink-0">
            <Satellite className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
            <span className="text-[10px] font-mono text-on-surface-variant uppercase whitespace-nowrap">SAR Pass:</span>
            <span className="font-mono font-bold text-on-surface text-[11px] whitespace-nowrap">Sentinel-1B Orbit Ready</span>
          </div>

          {role === 'admin' && (
            <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
              <button
                onClick={onOpenAddRegionModal}
                className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container text-on-surface text-xs font-bold rounded flex items-center gap-1.5 transition-colors border border-outline-variant/40 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Add Monitored Region</span>
              </button>

              <button
                onClick={onOpenBroadcastModal}
                className="px-3.5 py-1.5 bg-red-700 hover:bg-red-800 text-white text-xs font-bold rounded flex items-center gap-1.5 transition-colors shadow-sm whitespace-nowrap shrink-0"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Broadcast Emergency Warning</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. KPI Metric Cluster (Strictly 0 when tables are empty) */}
      <div className="p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active Threat Queue */}
        <div className="bg-white p-4 rounded border border-outline-variant/40 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-600" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-on-surface-variant">
              Active Threat Queue
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold text-on-surface">{activeAlertsCount}</span>
              <span className="text-xs text-on-surface-variant">Active Alerts</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              {activeAlertsCount > 0 ? 'Threshold cross alerts in registry' : 'No active alerts in registry'}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-outline-variant/20">
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
              {criticalCount} CRIT
            </span>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">
              {highCount} HIGH
            </span>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
              {modCount} MOD
            </span>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-800">
              {lowCount} LOW
            </span>
          </div>
        </div>

        {/* KPI 2: Critical Slope Sectors */}
        <div className="bg-white p-4 rounded border border-outline-variant/40 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-on-surface-variant">
              Critical Slope Sectors
            </span>
            <Compass className="w-4 h-4 text-amber-600" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold text-on-surface">{riskZonesCount}</span>
              <span className="text-xs text-on-surface-variant">Sectors Identified</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              {riskZonesCount > 0 ? 'Geocoded by ML scoring pipeline' : 'Awaiting ML risk zone scoring'}
            </p>
          </div>
          <div className="text-[10px] font-mono text-on-surface-variant pt-1 border-t border-outline-variant/20 flex items-center justify-between">
            <span>Model Engine:</span>
            <span className={`font-bold ${historicalLandslides.length > 0 ? 'text-emerald-700' : 'text-primary'}`}>
              {historicalLandslides.length > 0 ? 'v2.0 RF (NASA COOLR)' : 'v1.0 Baseline Engine'}
            </span>
          </div>
        </div>

        {/* KPI 3: Field Verification Queue */}
        <div className="bg-white p-4 rounded border border-outline-variant/40 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-on-surface-variant">
              Ground Truth Review
            </span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold text-on-surface">{pendingReportsCount}</span>
              <span className="text-xs text-on-surface-variant">Awaiting Review</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              {pendingReportsCount > 0 ? 'Field crack / blockage reports' : 'Zero unreviewed field reports'}
            </p>
          </div>
          <div className="text-[10px] font-mono text-on-surface-variant pt-1 border-t border-outline-variant/20 flex items-center justify-between">
            <span>SDRF Verification:</span>
            <span className="font-bold text-secondary">Active Dispatch</span>
          </div>
        </div>

        {/* KPI 4: Regional Districts Online */}
        <div className="bg-white p-4 rounded border border-outline-variant/40 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-secondary" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-on-surface-variant">
              NER Mesh Telemetry
            </span>
            <Radio className="w-4 h-4 text-secondary" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold text-secondary">
                {monitoredDistrictsCount}
              </span>
              <span className="text-xs text-on-surface-variant">Districts Defined</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              {monitoredDistrictsCount > 0 ? 'Geofenced polygons active' : 'No monitored sectors created yet'}
            </p>
          </div>
          <div className="text-[10px] font-mono text-secondary pt-1 border-t border-outline-variant/20 flex items-center justify-between">
            <span>Mesh Telemetry:</span>
            <span className="font-bold">100% Signal</span>
          </div>
        </div>
      </div>

      {/* 4. Primary Split Workspace */}
      <div className="px-4 md:px-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Monitored Regions & Live Hazard Feed */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Active Alerts List */}
          <div className="bg-white rounded border border-outline-variant/40 p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                  Active Emergency Warnings ({alerts.length})
                </h3>
              </div>
              <button
                onClick={() => setCurrentView('alerts-console')}
                className="text-xs font-bold text-secondary hover:underline flex items-center gap-1"
              >
                <span>Alerts Console</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {alerts.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No Active Emergency Alerts"
                description="Zero threshold violations detected. All monitored sectors in NER are currently operating under baseline conditions."
                actionLabel={role === 'admin' ? "Issue Manual Broadcast" : null}
                onAction={role === 'admin' ? onOpenBroadcastModal : null}
              />
            ) : (
              <div className="flex flex-col gap-2">
                {alerts.map(a => (
                  <div key={a.id} className="p-3 bg-surface-container-low rounded border border-outline-variant/30 flex items-start justify-between gap-3">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <SeverityChip severity={a.severity} />
                        <span className="font-bold text-xs text-on-surface">{a.region_name}</span>
                        <span className="font-mono text-[10px] text-on-surface-variant">
                          {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST
                        </span>
                      </div>
                      <p className="text-xs text-on-surface mt-1 font-medium">{a.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Field Ground Truth Reports */}
          <div className="bg-white rounded border border-outline-variant/40 p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                  Recent Field Ground-Truth Reports ({reports.length})
                </h3>
              </div>
              <button
                onClick={() => setCurrentView('reports-review')}
                className="text-xs font-bold text-secondary hover:underline flex items-center gap-1"
              >
                <span>View All Reports</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {reports.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="No Field Reports Yet"
                description="Awaiting ground-truth observations from field officers and local citizens in the terrain."
                actionLabel="Submit Observation Report"
                onAction={() => setCurrentView('field-officer')}
              />
            ) : (
              <div className="divide-y divide-outline-variant/20">
                {reports.slice(0, 5).map(r => (
                  <div key={r.id} className="py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <SeverityChip severity={r.severity} />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-on-surface capitalize">
                          {r.report_type.replace('_', ' ')} • {r.region_name}
                        </span>
                        <span className="text-[11px] text-on-surface-variant truncate max-w-sm">
                          {r.description || 'No description provided'}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                      r.status === 'verified' ? 'bg-emerald-100 text-emerald-800' : (
                        r.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                      )
                    }`}>
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Monitored Districts Roster & Quick Action Hub */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Monitored Regions Registry */}
          <div className="bg-white rounded border border-outline-variant/40 p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                  Monitored Sectors ({regions.length})
                </h3>
              </div>
              <button
                onClick={() => setCurrentView('gis-map')}
                className="text-xs font-bold text-secondary hover:underline flex items-center gap-1"
              >
                <span>GIS Map</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {regions.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No Sectors Monitored Yet"
                description="Register pilot districts (e.g. Dima Hasao, Champhai) to enable automated precipitation and AI risk scoring."
                actionLabel={role === 'admin' ? "Register Sector" : null}
                onAction={role === 'admin' ? onOpenAddRegionModal : null}
              />
            ) : (
              <div className="flex flex-col gap-2">
                {regions.map(reg => (
                  <div key={reg.id} className="p-2.5 bg-surface-container-low rounded border border-outline-variant/30 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-on-surface">{reg.district}</h4>
                      <span className="font-mono text-[10px] text-on-surface-variant uppercase">{reg.state}</span>
                    </div>
                    <button
                      onClick={() => setCurrentView('gis-map')}
                      className="px-2 py-0.5 bg-white text-xs font-bold text-primary rounded border border-outline-variant/30 hover:bg-surface-container-high transition-colors"
                    >
                      Locate
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* NASA Ground Truth Landslides Card */}
          <div className="bg-white rounded border border-outline-variant/40 p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">🛰️</span>
                <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                  NASA COOLR Ground Truth ({historicalLandslides.length})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentView('historical-analysis')}
                  className="text-xs font-bold text-indigo-700 hover:underline flex items-center gap-1"
                >
                  <span>Data Visualizations</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
                <span className="text-outline-variant/60">•</span>
                <button
                  onClick={() => setCurrentView('gis-map')}
                  className="text-xs font-bold text-amber-700 hover:underline flex items-center gap-1"
                >
                  <span>Inspect on Map</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {historicalLandslides.length === 0 ? (
              <div className="p-3 text-center text-xs text-on-surface-variant italic">
                Awaiting NASA data pipeline synchronization.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                {historicalLandslides.slice(0, 4).map(ls => (
                  <div key={ls.id} className="p-2.5 bg-amber-500/5 rounded border border-amber-300/40 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-amber-950">{ls.district}, {ls.state}</h4>
                      <span className="text-[10px] text-amber-800">{ls.trigger || ls.landslide_type} ({ls.event_date})</span>
                    </div>
                    <button
                      onClick={() => setCurrentView('historical-analysis')}
                      className="px-2 py-0.5 bg-white text-[11px] font-bold text-indigo-900 rounded border border-indigo-300 hover:bg-indigo-50 transition-colors"
                    >
                      Analyze
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Protocol Checklist Card */}
          <div className="bg-primary text-white rounded p-4 shadow-sm border border-primary-container">
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400 mb-2">
              Disaster Response Checklist
            </h3>
            <ul className="text-xs space-y-2 text-gray-200">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span>Verify rainfall spikes exceeding 50mm in 3-hour telemetry pass.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span>Dispatch field inspection teams for tension crack reports on arterial roads.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                <span>Ensure multi-channel alerts reach village headmen via SMS gateway.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
