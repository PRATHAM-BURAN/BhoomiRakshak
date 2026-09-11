import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Layers, 
  MapPin, 
  AlertTriangle, 
  CloudRain, 
  Compass, 
  Clock, 
  X, 
  ShieldAlert, 
  Info,
  ChevronRight
} from 'lucide-react';
import SeverityChip from '../components/SeverityChip';
import EmptyState from '../components/EmptyState';
import { resolveMediaUrl } from '../utils/imageUtils';

// Fix standard Leaflet default marker icon paths in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Free, unrestricted GIS basemaps with NO API key requirement and NO watermarks
const BASEMAP_PRESETS = {
  topo: {
    id: 'topo',
    name: 'Topo Relief',
    icon: '🏔️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; USGS, DeLorme, NPS',
    maxZoom: 19
  },
  osm: {
    id: 'osm',
    name: 'OpenStreetMap',
    icon: '🗺️',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    icon: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Earthstar Geographics',
    maxZoom: 19
  }
};

export default function GISRiskMap({
  regions = [],
  riskZones = [],
  reports = [],
  alerts = [],
  rainfallData = [],
  historicalLandslides = []
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const basemapLayerRef = useRef(null);
  const [activeBasemap, setActiveBasemap] = useState('topo');

  // Layer toggles
  const [layers, setLayers] = useState({
    riskZones: true,
    rainfall: true,
    fieldReports: true,
    activeAlerts: true,
    regions: true,
    historicalLandslides: true,
    terrain: false
  });

  const [selectedItem, setSelectedItem] = useState(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Center on Northeast India (Assam / Meghalaya / Nagaland hub)
    const map = L.map(mapContainerRef.current, {
      center: [26.14, 91.73], // Guwahati / NER Center
      zoom: 7,
      zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial institutional topographic basemap (Esri World Topo - No watermark, No API key)
    const baseConfig = BASEMAP_PRESETS[activeBasemap] || BASEMAP_PRESETS.topo;
    const initialBasemap = L.tileLayer(baseConfig.url, {
      attribution: baseConfig.attribution,
      maxZoom: baseConfig.maxZoom
    }).addTo(map);
    basemapLayerRef.current = initialBasemap;

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Dynamically swap basemap without recreating feature layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (basemapLayerRef.current) {
      map.removeLayer(basemapLayerRef.current);
    }
    const baseConfig = BASEMAP_PRESETS[activeBasemap] || BASEMAP_PRESETS.topo;
    const newBasemap = L.tileLayer(baseConfig.url, {
      attribution: baseConfig.attribution,
      maxZoom: baseConfig.maxZoom
    });
    newBasemap.addTo(map);
    if (typeof newBasemap.bringToBack === 'function') {
      newBasemap.bringToBack();
    }
    basemapLayerRef.current = newBasemap;
  }, [activeBasemap]);

  // Update Map Layers whenever data or layer toggles change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing feature layers
    map.eachLayer((layer) => {
      if (layer.options && layer.options.isFeatureLayer) {
        map.removeLayer(layer);
      }
    });

    const bounds = L.latLngBounds([]);

    // 1. Render Monitored Regions (District Polygons)
    if (layers.regions && regions.length > 0) {
      regions.forEach((reg) => {
        if (reg.geometry && reg.geometry.coordinates) {
          try {
            const geoJsonLayer = L.geoJSON(reg.geometry, {
              isFeatureLayer: true,
              style: {
                color: '#0f2922',
                weight: 2,
                dashArray: '4, 4',
                fillColor: '#0f2922',
                fillOpacity: 0.05
              }
            }).addTo(map);

            geoJsonLayer.on('click', () => {
              setSelectedItem({ type: 'region', data: reg });
            });

            bounds.extend(geoJsonLayer.getBounds());
          } catch (e) {
            console.warn('Invalid region geometry:', e);
          }
        }
      });
    }

    // 2. Render Risk Zones (Polygons or Centroid Hazard Circles from ML engine)
    if (layers.riskZones && riskZones.length > 0) {
      riskZones.forEach((zone) => {
        const color = 
          zone.risk_level === 'CRITICAL' ? '#991b1b' :
          zone.risk_level === 'HIGH' ? '#dc2626' :
          zone.risk_level === 'MODERATE' ? '#ea580c' :
          zone.risk_level === 'LOW' ? '#ca8a04' : '#15803d';

        const geom = zone.geometry || zone.location;
        if (geom) {
          try {
            const zLayer = L.geoJSON(geom, {
              isFeatureLayer: true,
              style: {
                color,
                weight: 3,
                fillColor: color,
                fillOpacity: 0.35
              },
              pointToLayer: (feature, latlng) => {
                return L.circle(latlng, {
                  radius: 8000,
                  color,
                  weight: 3,
                  fillColor: color,
                  fillOpacity: 0.5
                });
              }
            }).addTo(map);

            zLayer.bindTooltip(
              `<div style="font-family:sans-serif;font-size:12px;padding:4px;">
                <strong style="color:${color}; font-size:13px;">⚠️ ${zone.risk_level} RISK ZONE</strong><br/>
                <b>${zone.region_name || 'Monitored Sector'}</b><br/>
                <span>Risk Probability: ${(Number(zone.current_risk_score || 0) * 100).toFixed(1)}%</span><br/>
                <span style="color:#666;font-size:10px;">Model: ${zone.model_version || 'RandomForest-NER'}</span>
              </div>`,
              { sticky: true }
            );

            zLayer.on('click', () => {
              setSelectedItem({ type: 'risk_zone', data: zone });
            });

            bounds.extend(zLayer.getBounds());
          } catch (e) {
            console.warn('Invalid risk zone geometry:', e);
          }
        }
      });
    }

    // 3. Render Field Reports (Points)
    if (layers.fieldReports && reports.length > 0) {
      reports.forEach((rep) => {
        if (rep.geometry && rep.geometry.coordinates) {
          const [lon, lat] = rep.geometry.coordinates;
          const markerColor = rep.severity === 'CRITICAL' ? '#991b1b' : '#dc2626';

          const marker = L.circleMarker([lat, lon], {
            isFeatureLayer: true,
            radius: 8,
            fillColor: markerColor,
            color: '#ffffff',
            weight: 2,
            fillOpacity: 0.9
          }).addTo(map);

          marker.on('click', () => {
            setSelectedItem({ type: 'report', data: rep });
          });

          bounds.extend([lat, lon]);
        }
      });
    }

    // 4. Render Active Alerts (Red Danger Highlight)
    if (layers.activeAlerts && alerts.length > 0) {
      alerts.forEach((alert) => {
        const region = regions.find(r => r.id === alert.region_id || (alert.region_name && alert.region_name.includes(r.district)));
        const geom = region?.geometry || region?.boundary;
        if (geom) {
          try {
            const alertLayer = L.geoJSON(geom, {
              isFeatureLayer: true,
              style: {
                color: '#dc2626',
                weight: 4,
                dashArray: '6, 6',
                fillColor: '#dc2626',
                fillOpacity: 0.4
              }
            }).addTo(map);

            alertLayer.bindTooltip(
              `<div style="font-family:sans-serif;font-size:12px;padding:4px;">
                <strong style="color:#dc2626; font-size:13px;">🚨 ACTIVE ${alert.severity} ALERT</strong><br/>
                <b>${alert.region_name || region?.name}</b><br/>
                <span>${alert.message}</span>
              </div>`,
              { sticky: true }
            );

            alertLayer.on('click', () => {
              setSelectedItem({ type: 'alert', data: alert });
            });

            bounds.extend(alertLayer.getBounds());
          } catch (e) {
            console.warn('Alert geometry error:', e);
          }
        }
      });
    }

    // 5. Render Historical Landslide Ground Truth (NASA COOLR / GSI)
    if (layers.historicalLandslides && historicalLandslides.length > 0) {
      historicalLandslides.forEach((item) => {
        if (item.latitude && item.longitude) {
          const marker = L.circleMarker([item.latitude, item.longitude], {
            isFeatureLayer: true,
            radius: 8,
            fillColor: '#ea580c', // High-visibility amber/orange
            color: '#ffffff',
            weight: 2,
            fillOpacity: 0.95
          }).addTo(map);

          marker.bindTooltip(
            `<div style="font-family:sans-serif;font-size:11px;">
              <strong style="color:#ea580c;">🛰️ NASA COOLR Landslide</strong><br/>
              <b>${item.district}, ${item.state}</b><br/>
              <span>Trigger: ${item.trigger || 'Monsoon'}</span><br/>
              <span style="color:#666;font-size:10px;">Date: ${item.event_date}</span>
            </div>`,
            { direction: 'top', offset: [0, -6] }
          );

          marker.on('click', () => {
            setSelectedItem({ type: 'historical_landslide', data: item });
          });

          bounds.extend([item.latitude, item.longitude]);
        }
      });
    }

    // Adjust view if features exist
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
    }
  }, [layers, regions, riskZones, reports, alerts, historicalLandslides]);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] flex flex-col overflow-hidden bg-slate-100">
      {/* Top Map Layer Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="bg-white/95 backdrop-blur-sm p-2 rounded shadow-md border border-outline-variant/40 pointer-events-auto flex flex-wrap items-center gap-2 text-xs">
          {/* Basemap Switcher (Free, No API Key, No Watermark) */}
          <div className="flex items-center gap-1 bg-surface-container-low p-0.5 rounded border border-outline-variant/40">
            <span className="text-[10px] font-mono font-bold text-on-surface-variant uppercase px-1.5">Map:</span>
            {Object.values(BASEMAP_PRESETS).map(bm => (
              <button
                key={bm.id}
                type="button"
                onClick={() => setActiveBasemap(bm.id)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all flex items-center gap-1 ${
                  activeBasemap === bm.id
                    ? 'bg-primary text-white shadow-xs font-bold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-white/80'
                }`}
                title={`Switch to ${bm.name}`}
              >
                <span>{bm.icon}</span>
                <span>{bm.name}</span>
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-outline-variant/60 hidden sm:block" />

          <div className="flex items-center gap-1.5 font-bold text-on-surface px-1.5">
            <Layers className="w-4 h-4 text-primary" />
            <span>GIS Layers:</span>
          </div>

          <label className="flex items-center gap-1.5 px-2 py-1 bg-surface-container-low rounded cursor-pointer font-medium hover:bg-surface-container">
            <input
              type="checkbox"
              checked={layers.riskZones}
              onChange={e => setLayers({ ...layers, riskZones: e.target.checked })}
              className="accent-primary"
            />
            <span>🌋 AI Risk Zones ({riskZones.length})</span>
          </label>

          <label className="flex items-center gap-1.5 px-2 py-1 bg-surface-container-low rounded cursor-pointer font-medium hover:bg-surface-container">
            <input
              type="checkbox"
              checked={layers.activeAlerts}
              onChange={e => setLayers({ ...layers, activeAlerts: e.target.checked })}
              className="accent-primary"
            />
            <span>🚨 Active Alerts ({alerts.length})</span>
          </label>

          <label className="flex items-center gap-1.5 px-2 py-1 bg-surface-container-low rounded cursor-pointer font-medium hover:bg-surface-container">
            <input
              type="checkbox"
              checked={layers.fieldReports}
              onChange={e => setLayers({ ...layers, fieldReports: e.target.checked })}
              className="accent-primary"
            />
            <span>📍 Field Reports ({reports.length})</span>
          </label>

          <label className="flex items-center gap-1.5 px-2 py-1 bg-surface-container-low rounded cursor-pointer font-medium hover:bg-surface-container">
            <input
              type="checkbox"
              checked={layers.regions}
              onChange={e => setLayers({ ...layers, regions: e.target.checked })}
              className="accent-primary"
            />
            <span>🗺️ Monitored Sectors ({regions.length})</span>
          </label>

          <label className="flex items-center gap-1.5 px-2 py-1 bg-surface-container-low rounded cursor-pointer font-medium hover:bg-surface-container">
            <input
              type="checkbox"
              checked={layers.historicalLandslides}
              onChange={e => setLayers({ ...layers, historicalLandslides: e.target.checked })}
              className="accent-primary"
            />
            <span>🛰️ NASA Ground Truth ({historicalLandslides.length})</span>
          </label>
        </div>

        {/* Legend */}
        <div className="bg-white/95 backdrop-blur-sm px-3 py-2 rounded shadow-md border border-outline-variant/40 pointer-events-auto hidden md:flex items-center gap-3 text-[10px] font-mono font-bold">
          <span className="flex items-center gap-1 text-emerald-800">
            <span className="w-2.5 h-2.5 rounded bg-emerald-600" /> SAFE
          </span>
          <span className="flex items-center gap-1 text-amber-800">
            <span className="w-2.5 h-2.5 rounded bg-amber-500" /> MODERATE
          </span>
          <span className="flex items-center gap-1 text-red-800">
            <span className="w-2.5 h-2.5 rounded bg-red-600" /> HIGH
          </span>
          <span className="flex items-center gap-1 text-rose-950">
            <span className="w-2.5 h-2.5 rounded bg-rose-700 animate-pulse" /> CRITICAL
          </span>
        </div>
      </div>

      {/* Main Map Viewport */}
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Selected Feature / Zone Inspector Side Drawer */}
      {selectedItem && (
        <div className="absolute top-16 right-4 bottom-4 w-96 max-w-[calc(100vw-2rem)] bg-white rounded shadow-2xl border border-outline-variant/60 z-30 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
          <div className="p-3 bg-primary text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                Geospatial Inspector
              </span>
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-4 text-xs">
            {/* Risk Zone details */}
            {selectedItem.type === 'risk_zone' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-on-surface">
                    {selectedItem.data.region_name || 'Monitored Hazard Sector'}
                  </span>
                  <SeverityChip severity={selectedItem.data.risk_level} />
                </div>

                <div className="bg-surface-container-low p-3 rounded border border-outline-variant/30 flex items-center justify-between">
                  <span className="text-on-surface-variant font-medium">Computed Risk Index:</span>
                  <span className="font-mono font-bold text-sm text-primary">
                    {(selectedItem.data.current_risk_score * 100).toFixed(1)}%
                  </span>
                </div>

                <div>
                  <h4 className="font-mono text-[10px] font-bold uppercase text-on-surface-variant tracking-wider mb-1.5">
                    Explainable Risk Factors (SHAP Analysis)
                  </h4>
                  {selectedItem.data.reasons && selectedItem.data.reasons.length > 0 ? (
                    <ul className="space-y-1.5">
                      {selectedItem.data.reasons.map((r, i) => (
                        <li key={i} className="p-2 bg-amber-50 text-amber-900 rounded border border-amber-200 text-xs">
                          {r}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-on-surface-variant italic">
                      All geotechnical parameters within baseline thresholds.
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-outline-variant/20 flex flex-col gap-1 text-[11px] text-on-surface-variant">
                  <span>Model: {selectedItem.data.model_version}</span>
                  <span>Last Evaluated: {new Date(selectedItem.data.last_updated).toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Field Report details */}
            {selectedItem.type === 'report' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-on-surface capitalize">
                    {selectedItem.data.report_type.replace('_', ' ')}
                  </span>
                  <SeverityChip severity={selectedItem.data.severity} />
                </div>

                <div className="text-xs text-on-surface">
                  <span className="font-bold">District:</span> {selectedItem.data.region_name}
                </div>

                <p className="p-2.5 bg-surface-container-low rounded border border-outline-variant/30 text-xs text-on-surface">
                  {selectedItem.data.description || 'No detailed remarks provided.'}
                </p>

                {(selectedItem.data.media_data_url || selectedItem.data.media_url) && (
                  <div>
                    <h5 className="font-bold text-[11px] mb-1 text-on-surface flex items-center justify-between">
                      <span>Ground Evidence:</span>
                      <span className="text-[10px] font-mono text-primary font-bold">FIELD CAPTURE</span>
                    </h5>
                    <img
                      src={resolveMediaUrl(selectedItem.data.media_data_url || selectedItem.data.media_url)}
                      alt="Field evidence"
                      className="w-full h-44 object-cover rounded border border-outline-variant/40 shadow-sm"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                <div className="pt-2 border-t border-outline-variant/20 flex flex-col gap-1 text-[11px] text-on-surface-variant">
                  <span>Status: <strong className="uppercase">{selectedItem.data.status}</strong></span>
                  <span>Submitted by: {selectedItem.data.submitted_by_name || 'Field Officer'}</span>
                  <span>Coordinates: {selectedItem.data.geometry?.coordinates?.join(', ')}</span>
                  <span>Offline Captured: {selectedItem.data.created_offline ? 'Yes' : 'No'}</span>
                </div>
              </div>
            )}

            {/* Monitored Region details */}
            {selectedItem.type === 'region' && (
              <div className="flex flex-col gap-3">
                <h3 className="font-bold text-sm text-on-surface">
                  {selectedItem.data.district}, {selectedItem.data.state}
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Geofenced boundary sector monitored by BhoomiRakshak telemetry.
                </p>

                <div className="bg-surface-container-low p-3 rounded border border-outline-variant/30 flex flex-col gap-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-on-surface-variant">
                    Sector Telemetry Summary
                  </span>
                  <div className="flex items-center justify-between">
                    <span>Active Alerts:</span>
                    <strong className="font-mono">{alerts.filter(a => a.region_id === selectedItem.data.id).length}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Field Reports:</span>
                    <strong className="font-mono">{reports.filter(r => r.region_id === selectedItem.data.id).length}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Historical Landslide Ground Truth details */}
            {selectedItem.type === 'historical_landslide' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-on-surface">
                      {selectedItem.data.district}, {selectedItem.data.state}
                    </h3>
                    <span className="font-mono text-[10px] text-on-surface-variant">
                      {selectedItem.data.external_event_id}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-amber-100 text-amber-900 border border-amber-300">
                    NASA Ground Truth
                  </span>
                </div>

                <div className="bg-amber-500/10 p-3 rounded border border-amber-500/30 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-amber-950">Landslide Classification:</span>
                    <strong className="font-semibold text-amber-900">{selectedItem.data.landslide_type}</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-amber-950">Reported Trigger:</span>
                    <strong className="font-semibold text-amber-900">{selectedItem.data.trigger}</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-amber-950">Event Date:</span>
                    <strong className="font-mono text-amber-900">{selectedItem.data.event_date}</strong>
                  </div>
                </div>

                {/* Geotechnical & Precipitation Telemetry */}
                <div className="bg-surface-container-low p-3 rounded border border-outline-variant/30 flex flex-col gap-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-on-surface-variant tracking-wider">
                    Geotechnical & Climate Telemetry
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-white rounded border border-outline-variant/20">
                      <span className="text-[10px] text-on-surface-variant block">SRTM 30m Elevation</span>
                      <strong className="font-mono text-sm text-emerald-800">{selectedItem.data.elevation_m} m</strong>
                    </div>
                    <div className="p-2 bg-white rounded border border-outline-variant/20">
                      <span className="text-[10px] text-on-surface-variant block">Slope Gradient</span>
                      <strong className="font-mono text-sm text-amber-800">{selectedItem.data.slope_deg}°</strong>
                    </div>
                    <div className="p-2 bg-white rounded border border-outline-variant/20">
                      <span className="text-[10px] text-on-surface-variant block">Terrain Aspect</span>
                      <strong className="font-mono text-sm">{selectedItem.data.aspect_deg}°</strong>
                    </div>
                    <div className="p-2 bg-white rounded border border-outline-variant/20">
                      <span className="text-[10px] text-on-surface-variant block">GPM 24h Rain</span>
                      <strong className="font-mono text-sm text-blue-700">{selectedItem.data.rain_24h_mm} mm</strong>
                    </div>
                  </div>
                </div>

                {/* Catalog Citation */}
                <div>
                  <h4 className="font-mono text-[10px] font-bold uppercase text-on-surface-variant tracking-wider mb-1">
                    Ground Truth Catalog Citation
                  </h4>
                  <p className="p-2.5 bg-surface-container-low rounded border border-outline-variant/30 text-[11px] text-on-surface leading-relaxed">
                    {selectedItem.data.citation}
                  </p>
                </div>

                <div className="pt-2 border-t border-outline-variant/20 flex flex-col gap-1 text-[11px] text-on-surface-variant">
                  <span>Primary Source: <strong>{selectedItem.data.source}</strong></span>
                  <span>Coordinates: {selectedItem.data.latitude?.toFixed(4)}°N, {selectedItem.data.longitude?.toFixed(4)}°E</span>
                  <span>Ground Verification: Certified Ground Truth Incident</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Genuine Empty State Overlay if 0 items registered */}
      {regions.length === 0 && riskZones.length === 0 && reports.length === 0 && historicalLandslides.length === 0 && (
        <div className="absolute bottom-6 left-6 z-20 max-w-sm pointer-events-auto">
          <div className="bg-white/95 backdrop-blur-md p-4 rounded shadow-lg border border-outline-variant/40">
            <h4 className="font-bold text-xs uppercase tracking-wider text-on-surface mb-1">
              GIS Canvas Initialized
            </h4>
            <p className="text-xs text-on-surface-variant leading-relaxed mb-2">
              No geofenced sectors or risk zones exist yet in the database. Use the Admin Command Deck to register monitored regions or trigger rainfall synchronization.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
