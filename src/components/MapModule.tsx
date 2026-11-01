import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Parcel, Heir } from '../types';
import { formatCurrency, formatArea } from '../utils/fractionEngine';
import { Layers, Maximize2 } from 'lucide-react';

interface MapModuleProps {
  parcels: Parcel[];
  heirs: Heir[];
  selectedParcelId?: string;
  onSelectParcel?: (parcelId: string) => void;
  heightClass?: string;
}

type TileProvider = 'google_hybrid' | 'esri_satellite' | 'osm_streets';

export const MapModule: React.FC<MapModuleProps> = ({
  parcels,
  heirs,
  selectedParcelId,
  onSelectParcel,
  heightClass = 'h-[500px]',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polygonLayersRef = useRef<L.LayerGroup | null>(null);
  const [activeTile, setActiveTile] = useState<TileProvider>('google_hybrid');

  const tileConfigs: Record<TileProvider, { url: string; attribution: string; name: string }> = {
    google_hybrid: {
      url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      attribution: '&copy; Google Maps',
      name: 'Google Hibrit (Uydu + Yol)',
    },
    esri_satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '&copy; Esri World Imagery',
      name: 'Esri Uydu',
    },
    osm_streets: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
      name: 'Sokak Haritası (OSM)',
    },
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenter: [number, number] = [39.0, 35.0]; // Turkey center default
    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 6,
      zoomControl: true,
    });

    const cfg = tileConfigs[activeTile];
    const tileLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: 20,
    }).addTo(map);

    tileLayerRef.current = tileLayer;
    polygonLayersRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer on switch
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }

    const cfg = tileConfigs[activeTile];
    const newLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: 20,
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  }, [activeTile]);

  // Render Polygons and Sub-Usage Areas
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = polygonLayersRef.current;
    if (!map || !group) return;

    group.clearLayers();

    const allBounds: L.LatLngBounds[] = [];

    parcels.forEach((parcel) => {
      if (!parcel.coordinates || parcel.coordinates.length < 3) return;

      const isSelected = parcel.id === selectedParcelId;

      // 1. Draw Master Parcel Polygon
      const polygon = L.polygon(parcel.coordinates, {
        color: isSelected ? '#EF4444' : '#2563EB',
        weight: isSelected ? 3.5 : 2,
        fillColor: isSelected ? '#F87171' : '#3B82F6',
        fillOpacity: 0.25,
      });

      polygon.on('click', () => {
        if (onSelectParcel) onSelectParcel(parcel.id);
      });

      // Master Parcel Popup
      const subAreaCount = parcel.subUsageAreas?.length || 0;
      const popupHtml = `
        <div class="p-2 min-w-[180px] font-sans text-xs">
          <div class="font-bold text-slate-900 border-b pb-1 mb-1">
            Ada ${parcel.ada} / Parsel ${parcel.parselNo}
          </div>
          <div class="text-slate-600 mb-0.5">Mevkii: <strong>${parcel.mevkii || '-'}</strong></div>
          <div class="text-slate-600 mb-0.5">Yüzölçümü: <strong>${formatArea(parcel.alanM2)}</strong></div>
          <div class="text-slate-600 mb-0.5">Nitelik: <strong>${parcel.nitelik}</strong></div>
          <div class="text-blue-700 font-bold mb-1">Değer: ${formatCurrency(parcel.toplamDegerTL)}</div>
          ${
            subAreaCount > 0
              ? `<div class="mt-1 text-[11px] text-emerald-700 font-semibold border-t pt-1">
                   ${subAreaCount} Adet Fiili Kullanım Bölümü Mevcut
                 </div>`
              : `<div class="mt-1 text-[10px] text-slate-600">Alt kullanım alanı tanımlanmamış</div>`
          }
        </div>
      `;

      polygon.bindPopup(popupHtml);
      group.addLayer(polygon);
      allBounds.push(polygon.getBounds());

      // 2. Draw In-Parcel Sub-Usage Areas (Fiili Kullanım Krokileri)
      if (parcel.subUsageAreas && parcel.subUsageAreas.length > 0) {
        parcel.subUsageAreas.forEach((sub) => {
          if (!sub.coordinates || sub.coordinates.length < 3) return;

          const heir = heirs.find((h) => h.id === sub.assignedHeirId);
          const heirName = heir ? heir.adSoyad : (sub.assignedHeirName || 'Tahsis Yok');

          const subPoly = L.polygon(sub.coordinates, {
            color: sub.color || '#D97706',
            weight: 2,
            dashArray: '4, 4',
            fillColor: sub.color || '#D97706',
            fillOpacity: 0.45,
          });

          const subPopupHtml = `
            <div class="p-2 min-w-[180px] font-sans text-xs">
              <div class="font-bold text-slate-900 border-b pb-1 mb-1 text-emerald-700">
                Fiili Kullanım Alanı: ${sub.name}
              </div>
              <div class="text-slate-600 mb-0.5">Ana Parsel: <strong>Ada ${parcel.ada} / Parsel ${parcel.parselNo}</strong></div>
              <div class="text-slate-600 mb-0.5">Alan: <strong>${formatArea(sub.alanM2)}</strong></div>
              <div class="text-slate-900 font-bold mt-1 p-1 bg-emerald-50 rounded border border-emerald-200">
                Tahsis Edilen: ${heirName}
              </div>
            </div>
          `;

          subPoly.bindPopup(subPopupHtml);
          group.addLayer(subPoly);
        });
      }
    });

    // Auto-fit to parcels if exists
    if (allBounds.length > 0) {
      const combinedBounds = allBounds[0];
      for (let i = 1; i < allBounds.length; i++) {
        combinedBounds.extend(allBounds[i]);
      }
      map.fitBounds(combinedBounds, { padding: [30, 30], maxZoom: 17 });
    }
  }, [parcels, heirs, selectedParcelId]);

  const handleFitBounds = () => {
    if (!mapInstanceRef.current || !polygonLayersRef.current) return;
    const layers = polygonLayersRef.current.getLayers() as L.Polygon[];
    if (layers.length === 0) return;

    const bounds = layers[0].getBounds();
    layers.forEach((l) => bounds.extend(l.getBounds()));
    mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30] });
  };

  return (
    <div className={`relative w-full ${heightClass} rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm`}>
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Map Controls */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md">
        <div className="flex items-center gap-1 px-1">
          <Layers className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={activeTile}
            onChange={(e) => setActiveTile(e.target.value as TileProvider)}
            className="text-xs font-medium text-slate-800 dark:text-slate-200 bg-transparent border-0 focus:ring-0 py-1 pl-1 pr-6 cursor-pointer"
          >
            <option value="google_hybrid">Google Hibrit (Uydu + Yol)</option>
            <option value="esri_satellite">Esri Uydu</option>
            <option value="osm_streets">Sokak Haritası (OSM)</option>
          </select>
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

        <button
          onClick={handleFitBounds}
          title="Tüm parselleri ekrana sığdır"
          className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Empty State Banner if no parcels */}
      {parcels.length === 0 && (
        <div className="absolute inset-0 z-[500] pointer-events-none flex items-center justify-center bg-slate-900/10 backdrop-blur-[1px]">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 max-w-sm text-center">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Henüz Parsel Yüklenmedi
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              "Dosyadan KML Yükle" butonuna tıklayarak kadastro parsel KML dosyanızı ekleyin.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
