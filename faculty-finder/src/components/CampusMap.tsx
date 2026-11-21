import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Compass, MapPin } from 'lucide-react';
import type { BuildingItem, FacultyDirectoryItem } from '../types/campusmitra';

interface CampusMapProps {
  buildings: BuildingItem[];
  faculty: FacultyDirectoryItem[];
  centerLat?: number;
  centerLng?: number;
  onSelectFaculty?: (fac: FacultyDirectoryItem) => void;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function CampusMap({ buildings, faculty, centerLat = 19.076, centerLng = 72.8777, onSelectFaculty }: CampusMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current).setView([centerLat, centerLng], 17);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    buildings.forEach((b) => {
      const buildingFaculty = faculty.filter((f) => f.building_id === b.id);
      const availCount = buildingFaculty.filter((f) => f.effective_status === 'Available').length;
      const marker = L.circleMarker([b.latitude, b.longitude], {
        radius: 10,
        color: '#1d4ed8',
        weight: 2,
        fillColor: availCount > 0 ? '#16a34a' : '#2563eb',
        fillOpacity: 0.85,
      }).addTo(map);

      marker.bindPopup(
        `<div style="font-family:sans-serif;min-width:170px">
          <strong style="font-size:13px">${b.name} (${b.code})</strong><br/>
          <span style="font-size:11px;color:#475569">${b.floors} floors · ${buildingFaculty.length} faculty cabins (${availCount} available)</span>
        </div>`
      );
    });

    if (userPos) {
      const uMarker = L.circleMarker([userPos.lat, userPos.lng], {
        radius: 8,
        color: '#0f172a',
        weight: 2,
        fillColor: '#f59e0b',
        fillOpacity: 0.95,
      }).addTo(map);
      uMarker.bindPopup('<strong>Your Current Location</strong>');
      map.setView([userPos.lat, userPos.lng], 17);
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [buildings, faculty, centerLat, centerLng, userPos]);

  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Browser geolocation is not supported on this device.');
      return;
    }
    setGeoStatus('Locating...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus(
          `Location shared (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`
        );
      },
      () => {
        setGeoStatus('Location permission declined. Showing default campus center.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-slate-900">Campus Buildings &amp; Faculty Cabins</h2>
          <p className="text-xs text-slate-500">
            Click any building pin to inspect faculty availability. Optionally share your browser location to compute walking distance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {geoStatus && <span className="text-xs font-mono text-slate-600">{geoStatus}</span>}
          <button
            type="button"
            onClick={handleShareLocation}
            className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Compass className="w-4 h-4" />
            Share My Location
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden min-h-[420px]">
          <div ref={containerRef} className="w-full h-[420px]" />
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-4 space-y-3 overflow-y-auto max-h-[420px]">
          <h3 className="text-xs font-bold text-slate-700">Campus Buildings Directory</h3>
          {buildings.map((b) => {
            const bFaculty = faculty.filter((f) => f.building_id === b.id);
            const dist = userPos ? haversineMeters(userPos.lat, userPos.lng, b.latitude, b.longitude) : null;
            return (
              <div key={b.id} className="p-3 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                      <span>{b.name}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {b.code} · {b.floors} floors
                      {dist !== null ? ` · ${dist}m away` : ''}
                    </div>
                  </div>
                </div>
                {bFaculty.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    {bFaculty.map((f) => (
                      <button
                        key={f.user_id}
                        type="button"
                        onClick={() => onSelectFaculty?.(f)}
                        className="w-full text-left text-[11px] flex items-center justify-between gap-2 py-1 px-1.5 rounded hover:bg-slate-50"
                      >
                        <span className="font-medium text-slate-800 truncate">
                          {f.full_name} ({f.cabin_number})
                        </span>
                        <span className="font-mono text-blue-700 shrink-0">{f.effective_status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
