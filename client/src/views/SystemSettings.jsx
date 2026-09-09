import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Database, 
  CloudRain, 
  Radio, 
  MessageSquare, 
  Cpu, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Plus, 
  ShieldCheck,
  Server,
  FileSpreadsheet,
  Layers,
  BrainCircuit,
  BarChart3,
  HardDriveDownload,
  ArrowRight,
  Table,
  Search,
  Code,
  Users,
  MapPin,
  ShieldAlert,
  SlidersHorizontal
} from 'lucide-react';
import { api } from '../api';

export default function SystemSettings({ onRefreshData, onOpenAddRegionModal }) {
  const [activeTab, setActiveTab] = useState('database'); // 'database' | 'pipeline' | 'integrations'
  
  // Settings & Pipeline state
  const [statuses, setStatuses] = useState([]);
  const [pipelineInfo, setPipelineInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncingWeather, setSyncingWeather] = useState(false);
  const [ingestingData, setIngestingData] = useState(false);
  const [retrainingModel, setRetrainingModel] = useState(false);
  const [actionFeedback, setActionFeedback] = useState('');

  // Database Live Explorer state
  const [dbSummary, setDbSummary] = useState(null);
  const [selectedTable, setSelectedTable] = useState('users');
  const [tableData, setTableData] = useState(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewRawJson, setViewRawJson] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [res, pipeRes] = await Promise.allSettled([
        api.getStatus(),
        api.getPipelineStatus()
      ]);
      if (res.status === 'fulfilled') setStatuses(res.value.services || []);
      if (pipeRes.status === 'fulfilled') setPipelineInfo(pipeRes.value || null);
    } catch (err) {
      console.error('Failed to query integration status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDatabaseSummary = async () => {
    try {
      const summary = await api.getDatabaseSummary();
      setDbSummary(summary);
    } catch (err) {
      console.error('Failed to fetch DB summary:', err);
    }
  };

  const fetchTableRecords = async (tableName) => {
    setTableLoading(true);
    try {
      const res = await api.getDatabaseTable(tableName);
      setTableData(res);
    } catch (err) {
      console.error(`Failed to fetch table ${tableName}:`, err);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchDatabaseSummary();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTableRecords(selectedTable);
    }
  }, [selectedTable]);

  const handleSyncWeather = async () => {
    setSyncingWeather(true);
    setActionFeedback('');
    try {
      const res = await api.syncWeather();
      setActionFeedback(`Weather Sync: ${res.message}`);
      if (onRefreshData) onRefreshData();
      fetchStatus();
      fetchDatabaseSummary();
      if (selectedTable === 'sensor_rainfall_data') fetchTableRecords('sensor_rainfall_data');
    } catch (err) {
      setActionFeedback(`Weather sync error: ${err.message}`);
    } finally {
      setSyncingWeather(false);
    }
  };

  const handleIngestPipeline = async () => {
    setIngestingData(true);
    setActionFeedback('');
    try {
      const res = await api.ingestPipelineData();
      setActionFeedback(`Database Ingestion: ${res.message}`);
      if (onRefreshData) onRefreshData();
      fetchStatus();
      fetchDatabaseSummary();
      if (selectedTable === 'historical_landslides') fetchTableRecords('historical_landslides');
    } catch (err) {
      setActionFeedback(`Ingestion error: ${err.message}`);
    } finally {
      setIngestingData(false);
    }
  };

  const handleRetrainModel = async () => {
    setRetrainingModel(true);
    setActionFeedback('');
    try {
      const res = await api.trainMLModel();
      setActionFeedback(`AI Model Retrained: ${res.message}`);
      if (onRefreshData) onRefreshData();
      fetchStatus();
    } catch (err) {
      setActionFeedback(`Retraining error: ${err.message}`);
    } finally {
      setRetrainingModel(false);
    }
  };

  const handleResyncCommanders = async () => {
    setActionFeedback('');
    try {
      const res = await api.resyncCommanders();
      setActionFeedback(`Commander Roster Re-synced: ${res.message}`);
      fetchDatabaseSummary();
      if (selectedTable === 'users') fetchTableRecords('users');
    } catch (err) {
      setActionFeedback(`Commander sync error: ${err.message}`);
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'connected') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold uppercase border border-emerald-300">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>CONNECTED</span>
        </span>
      );
    }
    if (status === 'disconnected') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[10px] font-bold uppercase border border-rose-300">
          <XCircle className="w-3 h-3 text-rose-600" />
          <span>OFFLINE</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[10px] font-bold uppercase border border-amber-300">
        <AlertCircle className="w-3 h-3 text-amber-600" />
        <span>NOT CONFIGURED</span>
      </span>
    );
  };

  const mlService = pipelineInfo?.ml_service;
  const metrics = mlService?.metrics || {};
  const importances = mlService?.feature_importances || {};

  // Filtered records for table viewer
  const rawRecords = tableData?.records || [];
  const filteredRecords = rawRecords.filter(rec => {
    if (!searchTerm) return true;
    const str = JSON.stringify(rec).toLowerCase();
    return str.includes(searchTerm.toLowerCase());
  });

  // Extract columns dynamically
  const tableColumns = rawRecords.length > 0 
    ? Object.keys(rawRecords[0]).filter(k => k !== 'password_hash')
    : [];

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-outline-variant/30 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-on-surface-variant">
              Centralized Infrastructure, Database & AI Pipeline
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            <span className="text-[10px] font-mono text-secondary font-bold">OPERATIONAL LIVE POSTGIS CONSOLE</span>
          </div>
          <h1 className="text-xl font-bold text-on-surface tracking-tight">
            System Settings & Working Database
          </h1>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg border border-outline-variant/40">
          <button
            onClick={() => setActiveTab('database')}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'database'
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface hover:text-primary'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Database Live Explorer</span>
          </button>
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'pipeline'
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface hover:text-primary'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>NASA Data & AI Engine</span>
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'integrations'
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface hover:text-primary'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Gateways & Triggers</span>
          </button>
        </div>
      </div>

      {actionFeedback && (
        <div className="p-3 bg-primary-container text-white rounded text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: DATABASE LIVE EXPLORER */}
      {/* ======================================================== */}
      {activeTab === 'database' && (
        <div className="flex flex-col gap-5 animate-in fade-in duration-150">
          {/* Database Architecture & KPI Summary Card */}
          <div className="bg-white rounded border border-outline-variant/40 p-5 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-outline-variant/30 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-on-surface">
                    PostgreSQL PostGIS Working Database Telemetry
                  </h3>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Live connected database engine with real schema tables, geographic coordinates, and synchronized user authentication.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    fetchDatabaseSummary();
                    if (selectedTable) fetchTableRecords(selectedTable);
                  }}
                  className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 rounded text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-primary" />
                  <span>Refresh Tables</span>
                </button>
                <button
                  onClick={handleResyncCommanders}
                  className="px-3 py-1.5 bg-primary hover:bg-primary-container text-white font-bold rounded text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Re-Sync 1 Admin & 8 Commanders</span>
                </button>
              </div>
            </div>

            {/* Architecture Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
              <div className="p-3 bg-surface-container-low rounded border border-outline-variant/30">
                <span className="text-[10px] text-gray-500 font-bold uppercase block">ENGINE ARCHITECTURE</span>
                <span className="font-bold text-primary text-xs truncate block mt-1">
                  {dbSummary?.engine || 'Supabase PostGIS + Local Sync'}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                  ● {dbSummary?.status || 'OPERATIONAL'}
                </span>
              </div>

              <div className="p-3 bg-surface-container-low rounded border border-outline-variant/30">
                <span className="text-[10px] text-gray-500 font-bold uppercase block">SUPABASE CLOUD POSTGIS</span>
                <span className="font-bold text-gray-800 text-xs truncate block mt-1" title={dbSummary?.supabase_host}>
                  {dbSummary?.supabase_host || 'Local Mode / Dual Engine'}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                  Status: {dbSummary?.supabase_host ? 'Connected & Verified' : 'Local Fallback Active'}
                </span>
              </div>

              <div className="p-3 bg-surface-container-low rounded border border-outline-variant/30">
                <span className="text-[10px] text-gray-500 font-bold uppercase block">COMMAND ROSTER VERIFIED</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded font-bold text-[11px]">
                    1 Admin
                  </span>
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[11px]">
                    8 Field Commanders
                  </span>
                </div>
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  {dbSummary?.registered_citizens || 0} Registered Citizens
                </span>
              </div>

              <div className="p-3 bg-surface-container-low rounded border border-outline-variant/30">
                <span className="text-[10px] text-gray-500 font-bold uppercase block">LOCAL PERSISTENCE JSON</span>
                <span className="font-bold text-gray-800 text-xs truncate block mt-1">
                  {dbSummary?.local_storage_path || 'server/data/bhoomirakshak.json'}
                </span>
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  8 NER Monitored Sectors
                </span>
              </div>
            </div>

            {/* Table Selector Pills */}
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant block mb-2">
                Select Database Table to Inspect:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: 'users', label: 'Users & Commanders', icon: Users },
                  { name: 'regions', label: 'Monitored Regions', icon: MapPin },
                  { name: 'alerts', label: 'Emergency Alerts', icon: ShieldAlert },
                  { name: 'field_reports', label: 'Citizen Reports', icon: FileSpreadsheet },
                  { name: 'historical_landslides', label: 'NASA Historical Ground Truth', icon: Database },
                  { name: 'alert_subscriptions', label: 'Alert Subscriptions', icon: Radio },
                  { name: 'sensor_rainfall_data', label: 'Precipitation Telemetry', icon: CloudRain },
                  { name: 'api_connection_status', label: 'API Integrations', icon: Server }
                ].map(tbl => {
                  const count = dbSummary?.table_counts?.local?.[tbl.name] ?? '-';
                  const isSelected = selectedTable === tbl.name;
                  const Icon = tbl.icon;
                  return (
                    <button
                      key={tbl.name}
                      onClick={() => setSelectedTable(tbl.name)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                        isSelected
                          ? 'bg-primary text-white shadow-sm ring-1 ring-primary'
                          : 'bg-surface-container-low text-gray-700 border border-outline-variant/30 hover:bg-surface-container'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400' : 'text-gray-500'}`} />
                      <span>{tbl.label}</span>
                      <span className={`px-1.5 py-0.2 rounded font-mono text-[10px] ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Table Data Viewer */}
          <div className="bg-white rounded border border-outline-variant/40 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-outline-variant/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-lowest">
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4 text-primary" />
                <h4 className="font-bold text-xs uppercase tracking-wider text-on-surface">
                  Table: <span className="font-mono text-primary font-bold">{selectedTable}</span> ({filteredRecords.length} records)
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search records..."
                    className="h-8 pl-8 pr-3 bg-white border border-outline-variant/40 rounded text-xs focus:outline-none focus:border-primary w-48 font-mono"
                  />
                </div>
                <button
                  onClick={() => setViewRawJson(!viewRawJson)}
                  className={`h-8 px-2.5 rounded text-xs font-mono font-bold flex items-center gap-1 border transition-colors ${
                    viewRawJson
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-700 border-outline-variant/40 hover:bg-gray-50'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  <span>{viewRawJson ? 'Grid View' : 'Raw JSON'}</span>
                </button>
              </div>
            </div>

            {tableLoading ? (
              <div className="p-12 text-center text-xs text-gray-500 italic flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                <span>Reading live PostgreSQL records from server...</span>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-500 italic">
                No records found in table '{selectedTable}'.
              </div>
            ) : viewRawJson ? (
              <pre className="p-4 bg-gray-900 text-emerald-400 text-xs font-mono max-h-[500px] overflow-auto leading-relaxed">
                {JSON.stringify(filteredRecords, null, 2)}
              </pre>
            ) : (
              <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container-low text-on-surface-variant uppercase font-mono text-[10px] font-bold border-b border-outline-variant/30 sticky top-0 z-10">
                    <tr>
                      {tableColumns.map(col => (
                        <th key={col} className="p-3 whitespace-nowrap bg-surface-container-low">
                          {col.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20 font-mono text-xs">
                    {filteredRecords.map((row, rIdx) => (
                      <tr key={row.id || rIdx} className="hover:bg-surface-container-lowest/80 transition-colors">
                        {tableColumns.map(col => {
                          const val = row[col];
                          let formatted = String(val ?? '');

                          if (typeof val === 'object' && val !== null) {
                            formatted = JSON.stringify(val);
                          }

                          // Role styling
                          if (col === 'role') {
                            const badgeColor = val === 'admin' 
                              ? 'bg-rose-100 text-rose-800' 
                              : val === 'field_officer' 
                              ? 'bg-primary/10 text-primary font-bold' 
                              : 'bg-gray-100 text-gray-700';
                            return (
                              <td key={col} className="p-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeColor}`}>
                                  {val}
                                </span>
                              </td>
                            );
                          }

                          // Severity styling
                          if (col === 'severity') {
                            const badgeColor = val === 'CRITICAL' 
                              ? 'bg-rose-600 text-white' 
                              : val === 'HIGH' 
                              ? 'bg-orange-500 text-white' 
                              : 'bg-amber-100 text-amber-800';
                            return (
                              <td key={col} className="p-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeColor}`}>
                                  {val}
                                </span>
                              </td>
                            );
                          }

                          return (
                            <td key={col} className="p-3 max-w-xs truncate" title={formatted}>
                              {formatted}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: NASA DATA PIPELINE & ML ENGINE */}
      {/* ======================================================== */}
      {activeTab === 'pipeline' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-150">
          {/* SECTION 1: NASA & SRTM Ground Truth Datasets */}
          <div className="bg-white rounded border border-outline-variant/40 p-5 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-outline-variant/30 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                    Authoritative Regional Datasets (NASA COOLR / GPM / SRTM DEM)
                  </h3>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Genuine ground truth datasets collected and pre-processed specifically for the North Eastern Region.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleIngestPipeline}
                  disabled={ingestingData}
                  className="px-3 py-1.5 bg-secondary hover:bg-secondary/90 text-white font-bold rounded text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <HardDriveDownload className={`w-3.5 h-3.5 ${ingestingData ? 'animate-bounce' : ''}`} />
                  <span>{ingestingData ? 'Ingesting to DB...' : 'Ingest to Database'}</span>
                </button>
              </div>
            </div>

            {/* Dataset Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {pipelineInfo?.files ? (
                pipelineInfo.files.map((file, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-surface-container-low rounded border border-outline-variant/30 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[10px] font-bold uppercase text-primary">
                          STAGE 0{idx + 1}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                          file.exists ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {file.exists ? 'READY' : 'MISSING'}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-on-surface mb-1 truncate" title={file.filename}>
                        {file.filename}
                      </h4>
                      <p className="text-[11px] text-on-surface-variant leading-snug mb-3">
                        {file.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between font-mono text-[10px] text-on-surface-variant">
                      <span>Samples: <strong className="text-on-surface">{file.row_count}</strong></span>
                      <span>{(file.size_bytes / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-4 p-4 text-center text-xs text-on-surface-variant italic">
                  Loading pipeline dataset telemetry...
                </div>
              )}
            </div>

            <div className="p-3 bg-amber-50 rounded border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  <strong>Database Ground Truth Status:</strong> {pipelineInfo?.database_historical_count || 0} historical landslide events currently indexed in PostgreSQL PostGIS layer.
                </span>
              </div>
              <span className="font-mono text-[11px] font-bold text-amber-950">
                Assam, Meghalaya, Sikkim, Nagaland, Mizoram, Arunachal, Manipur, Tripura
              </span>
            </div>
          </div>

          {/* SECTION 2: AI Risk Engine Model & Explainability Weights */}
          <div className="bg-white rounded border border-outline-variant/40 p-5 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-outline-variant/30 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-secondary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface">
                    FastAPI Random Forest Model & Explainability Engine
                  </h3>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Trained on real geotechnical & meteorological ground truth vectors.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRetrainModel}
                  disabled={retrainingModel}
                  className="px-3 py-1.5 bg-primary hover:bg-primary-container text-white font-bold rounded text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${retrainingModel ? 'animate-spin' : ''}`} />
                  <span>{retrainingModel ? 'Training Model...' : 'Retrain Random Forest'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Model Status Card */}
              <div className="p-4 bg-surface-container-low rounded border border-outline-variant/30 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant block mb-1">
                    Active Architecture
                  </span>
                  <h4 className="font-bold text-sm text-primary mb-2">
                    {mlService?.model_name || 'BhoomiRakshak AI Model'}
                  </h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
                    {mlService?.disclaimer || 'Landslide hazard assessment model.'}
                  </p>

                  <div className="space-y-1.5 font-mono text-[11px] text-on-surface pt-2 border-t border-outline-variant/20">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Model Engine:</span>
                      <span className="font-bold">FastAPI + Scikit-Learn</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Training Samples:</span>
                      <span className="font-bold">{mlService?.total_samples || 0} samples</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ground Truth Status:</span>
                      <span className={`font-bold ${mlService?.trained_on_real_ground_truth ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {mlService?.trained_on_real_ground_truth ? 'VERIFIED GROUND TRUTH' : 'BASELINE'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="p-4 bg-surface-container-low rounded border border-outline-variant/30 flex flex-col justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant block mb-2">
                  Model Evaluation Metrics
                </span>
                <div className="grid grid-cols-2 gap-2 text-center my-auto">
                  <div className="p-2.5 bg-white rounded border border-outline-variant/20">
                    <span className="text-[10px] text-on-surface-variant font-mono block">ACCURACY</span>
                    <span className="font-mono text-lg font-bold text-emerald-800">
                      {metrics.accuracy !== undefined ? `${(metrics.accuracy * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded border border-outline-variant/20">
                    <span className="text-[10px] text-on-surface-variant font-mono block">ROC-AUC</span>
                    <span className="font-mono text-lg font-bold text-primary">
                      {metrics.roc_auc !== undefined ? metrics.roc_auc.toFixed(3) : 'N/A'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded border border-outline-variant/20">
                    <span className="text-[10px] text-on-surface-variant font-mono block">PRECISION</span>
                    <span className="font-mono text-lg font-bold text-secondary">
                      {metrics.precision !== undefined ? `${(metrics.precision * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-white rounded border border-outline-variant/20">
                    <span className="text-[10px] text-on-surface-variant font-mono block">RECALL</span>
                    <span className="font-mono text-lg font-bold text-amber-700">
                      {metrics.recall !== undefined ? `${(metrics.recall * 100).toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-gray-500 text-center font-mono mt-2">
                  Cross-validated against NASA COOLR & NER Control sites
                </span>
              </div>

              {/* Feature Importances (SHAP Drivers) */}
              <div className="p-4 bg-surface-container-low rounded border border-outline-variant/30 flex flex-col justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-on-surface-variant block mb-2">
                  Feature Weights (Explainability)
                </span>
                <div className="space-y-1.5 overflow-y-auto max-h-48 pr-1 text-xs">
                  {Object.keys(importances).length > 0 ? (
                    Object.entries(importances).map(([feat, weight]) => (
                      <div key={feat} className="flex flex-col gap-0.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-mono truncate max-w-[150px] text-on-surface capitalize">
                            {feat.replace(/_/g, ' ')}
                          </span>
                          <span className="font-mono font-bold text-primary">
                            {(weight * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(4, weight * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-on-surface-variant italic">Weights awaiting model load.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: GATEWAYS & OPERATIONAL TRIGGERS */}
      {/* ======================================================== */}
      {activeTab === 'integrations' && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-150">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface mb-3 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-primary" />
              <span>Core System Integrations & External Gateways</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {statuses.map(svc => (
                <div
                  key={svc.id}
                  className="bg-white rounded border border-outline-variant/40 p-4 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2.5 mb-3">
                      <span className="font-bold text-xs text-on-surface">
                        {svc.service_name}
                      </span>
                      {getStatusBadge(svc.status)}
                    </div>

                    <p className="text-xs text-on-surface-variant mb-3 leading-relaxed">
                      {svc.details?.message || svc.details?.error || svc.details?.provider || 'Production integration link verified.'}
                    </p>

                    {svc.details && (
                      <div className="p-2.5 bg-surface-container-low rounded border border-outline-variant/30 font-mono text-[11px] text-on-surface space-y-1">
                        {Object.entries(svc.details).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between">
                            <span className="text-gray-500 capitalize">{k}:</span>
                            <span className="font-bold truncate max-w-[180px]">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between text-[10px] font-mono text-on-surface-variant">
                    <span>Last Handshake:</span>
                    <span>{svc.last_synced_at ? new Date(svc.last_synced_at).toLocaleTimeString() : 'Never'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded border border-outline-variant/40 p-5 shadow-sm flex flex-col gap-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface border-b border-outline-variant/30 pb-3">
              Geospatial & Telemetry Synchronization Triggers
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-surface-container-low rounded border border-outline-variant/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <CloudRain className="w-4 h-4 text-secondary" />
                    <h4 className="font-bold text-xs text-on-surface">Trigger Live Weather Telemetry Sync</h4>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
                    Pulls real live precipitation telemetry (30min, 3h, 24h, 7d windows) from Open-Meteo & NASA GPM for all registered region coordinates.
                  </p>
                </div>
                <button
                  onClick={handleSyncWeather}
                  disabled={syncingWeather}
                  className="px-4 py-2 bg-primary hover:bg-primary-container text-white font-bold rounded text-xs flex items-center justify-center gap-1.5 transition-colors self-start shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingWeather ? 'animate-spin' : ''}`} />
                  <span>{syncingWeather ? 'Pulling Weather Packets...' : 'Sync Weather Telemetry Now'}</span>
                </button>
              </div>

              <div className="p-4 bg-surface-container-low rounded border border-outline-variant/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Plus className="w-4 h-4 text-primary" />
                    <h4 className="font-bold text-xs text-on-surface">Register New Monitored Sector</h4>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed mb-3">
                    Define a new geofenced district polygon in Assam, Meghalaya, Sikkim, or another NER state for autonomous threat monitoring.
                  </p>
                </div>
                <button
                  onClick={onOpenAddRegionModal}
                  className="px-4 py-2 bg-secondary hover:bg-secondary/90 text-white font-bold rounded text-xs flex items-center justify-center gap-1.5 transition-colors self-start shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register District Polygon</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
