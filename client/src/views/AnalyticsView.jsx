import React from 'react';
import { 
  BarChart3, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Radio, 
  CloudRain,
  ShieldCheck,
  TrendingUp,
  Info
} from 'lucide-react';
import SeverityChip from '../components/SeverityChip';
import EmptyState from '../components/EmptyState';

export default function AnalyticsView({ analytics }) {
  const alerts = analytics?.alerts || { total: 0, critical: 0, high: 0, moderate: 0, low: 0 };
  const reports = analytics?.reports || { total: 0, pending: 0, verified: 0, rejected: 0, by_type: { crack: 0, slope_movement: 0, road_blockage: 0 } };
  const zones = analytics?.risk_zones || { total_zones: 0, critical: 0, high: 0, moderate: 0, low: 0, safe: 0 };
  const operational = analytics?.operational || { monitored_regions: 0, total_officers: 0, total_citizens: 0, rainfall_telemetry_packets: 0 };

  const isCompletelyEmpty = alerts.total === 0 && reports.total === 0 && zones.total_zones === 0 && operational.monitored_regions === 0;

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-outline-variant/30 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-on-surface-variant">
              PostgreSQL Telemetry Aggregations
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            <span className="text-[10px] font-mono text-secondary font-bold">STRICT DATABASE GROUND TRUTH</span>
          </div>
          <h1 className="text-xl font-bold text-on-surface tracking-tight">
            Regional Telemetry Analytics & Disaster Aggregates
          </h1>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-on-surface-variant">
          <span>Telemetry Pulled:</span>
          <span className="font-bold text-primary">
            {analytics?.computed_at ? new Date(analytics.computed_at).toLocaleTimeString() : 'Live'}
          </span>
        </div>
      </div>

      {isCompletelyEmpty && (
        <div className="p-4 bg-surface-container-low rounded border border-outline-variant/30 text-xs text-on-surface-variant flex items-center gap-2">
          <Info className="w-4 h-4 text-primary shrink-0" />
          <span>
            Strict Zero-Data Policy Active: Telemetry tables are currently empty. All metrics show true counts (0) rather than simulated trend curves.
          </span>
        </div>
      )}

      {/* Grid 1: Core Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded border border-outline-variant/40 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant text-xs">
            <span className="font-mono uppercase font-bold text-[10px]">Total Alerts Dispatched</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="my-2 font-mono text-3xl font-bold text-on-surface">
            {alerts.total}
          </div>
          <span className="text-[11px] text-on-surface-variant">
            {alerts.total === 0 ? 'No emergency warnings in DB' : `${alerts.critical} critical, ${alerts.high} high warnings`}
          </span>
        </div>

        <div className="bg-white p-4 rounded border border-outline-variant/40 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant text-xs">
            <span className="font-mono uppercase font-bold text-[10px]">Ground-Truth Reports</span>
            <CheckCircle2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="my-2 font-mono text-3xl font-bold text-on-surface">
            {reports.total}
          </div>
          <span className="text-[11px] text-on-surface-variant">
            {reports.total === 0 ? 'No field submissions filed' : `${reports.verified} verified by officers`}
          </span>
        </div>

        <div className="bg-white p-4 rounded border border-outline-variant/40 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant text-xs">
            <span className="font-mono uppercase font-bold text-[10px]">ML Scored Risk Zones</span>
            <Layers className="w-4 h-4 text-amber-600" />
          </div>
          <div className="my-2 font-mono text-3xl font-bold text-on-surface">
            {zones.total_zones}
          </div>
          <span className="text-[11px] text-on-surface-variant">
            {zones.total_zones === 0 ? 'Awaiting ML feature ingestion' : `${zones.critical} critical hazard polygons`}
          </span>
        </div>

        <div className="bg-white p-4 rounded border border-outline-variant/40 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-on-surface-variant text-xs">
            <span className="font-mono uppercase font-bold text-[10px]">Rainfall Sensor Packets</span>
            <CloudRain className="w-4 h-4 text-secondary" />
          </div>
          <div className="my-2 font-mono text-3xl font-bold text-secondary">
            {operational.rainfall_telemetry_packets}
          </div>
          <span className="text-[11px] text-on-surface-variant">
            {operational.rainfall_telemetry_packets === 0 ? 'Awaiting weather sync pass' : 'Packets stored in database'}
          </span>
        </div>
      </div>

      {/* Grid 2: Detailed Breakdown Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Field Reports Breakdown */}
        <div className="bg-white rounded border border-outline-variant/40 p-5 shadow-sm flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface border-b border-outline-variant/30 pb-3 mb-4">
            Field Ground-Truth Triage Breakdown
          </h3>

          <div className="grid grid-cols-3 gap-3 mb-4 text-center">
            <div className="p-3 bg-surface-container-low rounded border border-outline-variant/30">
              <span className="text-[10px] font-mono uppercase text-on-surface-variant font-bold block">Pending</span>
              <span className="font-mono text-xl font-bold text-amber-600">{reports.pending}</span>
            </div>
            <div className="p-3 bg-surface-container-low rounded border border-outline-variant/30">
              <span className="text-[10px] font-mono uppercase text-on-surface-variant font-bold block">Verified</span>
              <span className="font-mono text-xl font-bold text-emerald-600">{reports.verified}</span>
            </div>
            <div className="p-3 bg-surface-container-low rounded border border-outline-variant/30">
              <span className="text-[10px] font-mono uppercase text-on-surface-variant font-bold block">Rejected</span>
              <span className="font-mono text-xl font-bold text-rose-600">{reports.rejected}</span>
            </div>
          </div>

          <h4 className="text-xs font-bold text-on-surface mb-2">Observations by Physical Category:</h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded bg-surface-container-low">
              <span>Road / Slope Tension Cracks</span>
              <strong className="font-mono">{reports.by_type?.crack || 0}</strong>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-surface-container-low">
              <span>Slope Movement / Creep</span>
              <strong className="font-mono">{reports.by_type?.slope_movement || 0}</strong>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-surface-container-low">
              <span>Highway / Road Blockages</span>
              <strong className="font-mono">{reports.by_type?.road_blockage || 0}</strong>
            </div>
          </div>
        </div>

        {/* Hazard Risk Distribution */}
        <div className="bg-white rounded border border-outline-variant/40 p-5 shadow-sm flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface border-b border-outline-variant/30 pb-3 mb-4">
            Hazard Severity Distribution (NDMA Scale)
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2 bg-rose-50 border border-rose-200 rounded text-rose-900 font-semibold">
              <span>CRITICAL Threat Sectors</span>
              <span className="font-mono font-bold text-sm">{zones.critical}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded text-red-900 font-semibold">
              <span>HIGH Risk Sectors</span>
              <span className="font-mono font-bold text-sm">{zones.high}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded text-amber-900 font-semibold">
              <span>MODERATE Risk Sectors</span>
              <span className="font-mono font-bold text-sm">{zones.moderate}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-900 font-semibold">
              <span>LOW Advisory Sectors</span>
              <span className="font-mono font-bold text-sm">{zones.low}</span>
            </div>
            <div className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 font-semibold">
              <span>SAFE Baseline Sectors</span>
              <span className="font-mono font-bold text-sm">{zones.safe}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
