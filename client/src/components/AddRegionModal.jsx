import React, { useState } from 'react';
import { Layers, X, Plus, CheckCircle2, MapPin } from 'lucide-react';
import { api } from '../api';

const NER_PILOT_PRESETS = [
  {
    name: "Dima Hasao Sector (Lumding-Haflong Corridor)",
    state: "Assam",
    district: "Dima Hasao",
    coordinates: [
      [92.80, 25.10],
      [93.20, 25.10],
      [93.20, 25.40],
      [92.80, 25.40],
      [92.80, 25.10]
    ]
  },
  {
    name: "Champhai Eastern Border Corridor",
    state: "Mizoram",
    district: "Champhai",
    coordinates: [
      [93.25, 23.35],
      [93.55, 23.35],
      [93.55, 23.65],
      [93.25, 23.65],
      [93.25, 23.35]
    ]
  },
  {
    name: "East Khasi Hills (Shillong-Cherrapunji)",
    state: "Meghalaya",
    district: "East Khasi Hills",
    coordinates: [
      [91.75, 25.25],
      [92.05, 25.25],
      [92.05, 25.60],
      [91.75, 25.60],
      [91.75, 25.25]
    ]
  },
  {
    name: "Gangtok Fragile Himalayan Sector",
    state: "Sikkim",
    district: "East Sikkim (Gangtok)",
    coordinates: [
      [88.50, 27.25],
      [88.75, 27.25],
      [88.75, 27.45],
      [88.50, 27.45],
      [88.50, 27.25]
    ]
  }
];

export default function AddRegionModal({ isOpen, onClose, onRegionCreated }) {
  const [name, setName] = useState('');
  const [state, setState] = useState('Assam');
  const [district, setDistrict] = useState('');
  const [coordsJson, setCoordsJson] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleApplyPreset = (preset) => {
    setName(preset.name);
    setState(preset.state);
    setDistrict(preset.district);
    setCoordsJson(JSON.stringify(preset.coordinates, null, 2));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    let coordinates;
    try {
      coordinates = JSON.parse(coordsJson);
      if (!Array.isArray(coordinates) || coordinates.length < 3) {
        throw new Error('Polygon must contain at least 3 coordinate points.');
      }
    } catch (err) {
      setErrorMsg(`Invalid coordinates JSON: ${err.message}`);
      return;
    }

    // Wrap in GeoJSON Polygon ring
    const polygonGeometry = {
      type: 'Polygon',
      coordinates: [coordinates]
    };

    setSubmitting(true);
    try {
      const res = await api.createRegion({
        name,
        state,
        district,
        geometry: polygonGeometry
      });

      if (onRegionCreated) onRegionCreated(res.region);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to register sector.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-primary/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl border border-outline-variant/40 max-w-xl w-full p-5 flex flex-col gap-4 text-xs animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm uppercase tracking-wider text-on-surface">
              Register Monitored Sector Polygon
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface font-bold text-sm"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Quick Presets */}
        <div>
          <label className="font-bold text-on-surface mb-1.5 block">
            Quick-Fill Authentic NER Pilot Sectors:
          </label>
          <div className="grid grid-cols-2 gap-2">
            {NER_PILOT_PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="p-2 text-left bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 rounded transition-colors"
              >
                <div className="font-bold text-primary">{p.district}</div>
                <div className="text-[10px] text-on-surface-variant uppercase">{p.state}</div>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-2 border-t border-outline-variant/20">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-on-surface mb-1 block">District Name</label>
              <input
                type="text"
                value={district}
                onChange={e => setDistrict(e.target.value)}
                placeholder="e.g. Dima Hasao"
                className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="font-bold text-on-surface mb-1 block">NER State</label>
              <select
                value={state}
                onChange={e => setState(e.target.value)}
                className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded font-semibold focus:outline-none focus:border-primary"
              >
                <option value="Assam">Assam</option>
                <option value="Arunachal Pradesh">Arunachal Pradesh</option>
                <option value="Manipur">Manipur</option>
                <option value="Meghalaya">Meghalaya</option>
                <option value="Mizoram">Mizoram</option>
                <option value="Nagaland">Nagaland</option>
                <option value="Sikkim">Sikkim</option>
                <option value="Tripura">Tripura</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-on-surface mb-1 block">Sector Name / Description</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Lumding-Badarpur Hill Section NH-27 Corridor"
              className="w-full h-9 px-3 bg-surface-container-low border border-outline-variant/40 rounded focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="font-bold text-on-surface mb-1 block">
              Polygon Coordinates Array [[lon, lat], ...]
            </label>
            <textarea
              rows={4}
              value={coordsJson}
              onChange={e => setCoordsJson(e.target.value)}
              placeholder="[[92.8, 25.1], [93.2, 25.1], [93.2, 25.4], [92.8, 25.4], [92.8, 25.1]]"
              className="w-full p-2 bg-surface-container-low border border-outline-variant/40 rounded font-mono text-[11px] focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-outline-variant/30">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-on-surface-variant hover:bg-surface-container text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-primary hover:bg-primary-container text-white rounded text-xs font-bold shadow-sm transition-colors"
            >
              {submitting ? 'Registering...' : 'Register Monitored Sector'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
