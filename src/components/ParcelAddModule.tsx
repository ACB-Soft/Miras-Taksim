import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  AlertCircle,
  CheckCircle2,
  Compass,
  Layers,
  Loader2,
  MapPin,
  Maximize2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ArrowRight,
  Edit3,
} from 'lucide-react';
import { Parcel, TkgmAdminItem, TkgmParcelResult } from '../types';
import {
  createParcelFromTkgm,
  fetchTkgmIlceler,
  fetchTkgmIller,
  fetchTkgmMahalleler,
  mergeParcelWithTkgm,
  queryTkgmParcelByAdaParsel,
  queryTkgmParcelByCoords,
} from '../services/tkgmService';
import { formatArea, formatCurrency } from '../utils/fractionEngine';

interface ParcelAddModuleProps {
  parcels: Parcel[];
  onUpdateParcels: (parcels: Parcel[]) => void;
  onNavigateToParcels: () => void;
}

type QueryMode = 'ada_parsel' | 'koordinat' | 'manuel';
type TileProvider = 'google_hybrid' | 'esri_satellite' | 'osm_streets';

function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeKey(val: string | undefined | null): string {
  return String(val || '').trim().toLocaleLowerCase('tr');
}

export const ParcelAddModule: React.FC<ParcelAddModuleProps> = ({
  parcels,
  onUpdateParcels,
  onNavigateToParcels,
}) => {
  const [mode, setMode] = useState<QueryMode>('ada_parsel');

  // Administrative hierarchy states
  const [iller, setIller] = useState<TkgmAdminItem[]>([]);
  const [ilceler, setIlceler] = useState<TkgmAdminItem[]>([]);
  const [mahalleler, setMahalleler] = useState<TkgmAdminItem[]>([]);

  const [selectedIlId, setSelectedIlId] = useState<string>('');
  const [selectedIlceId, setSelectedIlceId] = useState<string>('');
  const [selectedMahalleId, setSelectedMahalleId] = useState<string>('');

  const [ilFilter, setIlFilter] = useState('');
  const [ilceFilter, setIlceFilter] = useState('');
  const [mahalleFilter, setMahalleFilter] = useState('');

  const [adaNo, setAdaNo] = useState('');
  const [parselNo, setParselNo] = useState('');

  // Coordinate mode states
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [pickedPoint, setPickedPoint] = useState<[number, number] | null>(null);

  // Manual entry states
  const [manualForm, setManualForm] = useState({
    il: '',
    ilce: '',
    mahalle: '',
    ada: '',
    parselNo: '',
    pafta: '',
    mevkii: '',
    nitelik: 'Tarla',
    alanM2: '',
    birimFiyatTL: '500',
  });

  // Loading & status states
  const [loadingIller, setLoadingIller] = useState(false);
  const [loadingIlceler, setLoadingIlceler] = useState(false);
  const [loadingMahalleler, setLoadingMahalleler] = useState(false);
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Queried TKGM parcel preview & valuation
  const [result, setResult] = useState<TkgmParcelResult | null>(null);
  const [birimFiyatTL, setBirimFiyatTL] = useState<number>(500);

  // Leaflet map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const adminLayerRef = useRef<L.LayerGroup | null>(null);
  const portfolioLayerRef = useRef<L.LayerGroup | null>(null);
  const queryLayerRef = useRef<L.LayerGroup | null>(null);
  const [activeTile, setActiveTile] = useState<TileProvider>('google_hybrid');

  // Keep latest mode & auto-query callback ref for map click listener
  const modeRef = useRef<QueryMode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

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

  // Load provinces on mount
  const loadProvinces = async () => {
    setLoadingIller(true);
    setErrorMsg(null);
    try {
      const items = await fetchTkgmIller();
      setIller(items);
    } catch (err: any) {
      setErrorMsg(err?.message || 'İl listesi yüklenemedi.');
    } finally {
      setLoadingIller(false);
    }
  };

  useEffect(() => {
    loadProvinces();
  }, []);

  // Load districts when İl changes
  useEffect(() => {
    if (!selectedIlId) {
      setIlceler([]);
      setSelectedIlceId('');
      setMahalleler([]);
      setSelectedMahalleId('');
      return;
    }

    let cancelled = false;
    setLoadingIlceler(true);
    setErrorMsg(null);
    setSelectedIlceId('');
    setIlceFilter('');
    setMahalleler([]);
    setSelectedMahalleId('');
    setMahalleFilter('');

    fetchTkgmIlceler(Number(selectedIlId))
      .then((items) => {
        if (!cancelled) setIlceler(items);
      })
      .catch((err: any) => {
        if (!cancelled) setErrorMsg(err?.message || 'İlçe listesi yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setLoadingIlceler(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedIlId]);

  // Load neighborhoods when İlçe changes
  useEffect(() => {
    if (!selectedIlceId) {
      setMahalleler([]);
      setSelectedMahalleId('');
      return;
    }

    let cancelled = false;
    setLoadingMahalleler(true);
    setErrorMsg(null);
    setSelectedMahalleId('');
    setMahalleFilter('');

    fetchTkgmMahalleler(Number(selectedIlceId))
      .then((items) => {
        if (!cancelled) setMahalleler(items);
      })
      .catch((err: any) => {
        if (!cancelled) setErrorMsg(err?.message || 'Mahalle listesi yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setLoadingMahalleler(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedIlceId]);

  const filteredIller = useMemo(() => {
    const q = ilFilter.trim().toLocaleLowerCase('tr');
    return q ? iller.filter((i) => i.text.toLocaleLowerCase('tr').includes(q)) : iller;
  }, [iller, ilFilter]);

  const filteredIlceler = useMemo(() => {
    const q = ilceFilter.trim().toLocaleLowerCase('tr');
    return q ? ilceler.filter((i) => i.text.toLocaleLowerCase('tr').includes(q)) : ilceler;
  }, [ilceler, ilceFilter]);

  const filteredMahalleler = useMemo(() => {
    const q = mahalleFilter.trim().toLocaleLowerCase('tr');
    return q
      ? mahalleler.filter((m) => m.text.toLocaleLowerCase('tr').includes(q))
      : mahalleler;
  }, [mahalleler, mahalleFilter]);

  const selectedIlObj = useMemo(
    () => iller.find((i) => String(i.id) === selectedIlId) || null,
    [iller, selectedIlId]
  );
  const selectedIlceObj = useMemo(
    () => ilceler.find((i) => String(i.id) === selectedIlceId) || null,
    [ilceler, selectedIlceId]
  );
  const selectedMahalleObj = useMemo(
    () => mahalleler.find((m) => String(m.id) === selectedMahalleId) || null,
    [mahalleler, selectedMahalleId]
  );

  // Check if queried parcel already exists in portfolio
  const existingDuplicate = useMemo(() => {
    if (!result) return null;
    return (
      parcels.find(
        (p) =>
          normalizeKey(p.ada) === normalizeKey(result.ada) &&
          normalizeKey(p.parselNo) === normalizeKey(result.parselNo) &&
          (!result.mahalle || !p.mahalle || normalizeKey(p.mahalle) === normalizeKey(result.mahalle))
      ) || null
    );
  }, [parcels, result]);

  // Execute coordinate query helper
  const runCoordQuery = async (lat: number, lng: number) => {
    setErrorMsg(null);
    setSuccessBanner(null);
    setResult(null);
    setSearching(true);
    try {
      const data = await queryTkgmParcelByCoords(lat, lng);
      setResult(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Koordinat üzerinden TKGM parsel sorgusu başarısız oldu.');
    } finally {
      setSearching(false);
    }
  };

  const runCoordQueryRef = useRef(runCoordQuery);
  runCoordQueryRef.current = runCoordQuery;

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [39.0, 35.2],
      zoom: 6,
      zoomControl: true,
    });

    const cfg = tileConfigs[activeTile];
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: 20,
    }).addTo(map);

    adminLayerRef.current = L.layerGroup().addTo(map);
    portfolioLayerRef.current = L.layerGroup().addTo(map);
    queryLayerRef.current = L.layerGroup().addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (modeRef.current === 'koordinat') {
        const lat = Number(e.latlng.lat.toFixed(6));
        const lng = Number(e.latlng.lng.toFixed(6));
        setLatInput(String(lat));
        setLngInput(String(lng));
        setPickedPoint([lat, lng]);
        runCoordQueryRef.current(lat, lng);
      } else if (modeRef.current === 'manuel') {
        const lat = Number(e.latlng.lat.toFixed(6));
        const lng = Number(e.latlng.lng.toFixed(6));
        setPickedPoint([lat, lng]);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update tile layer when user switches basemap
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const cfg = tileConfigs[activeTile];
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: 20,
    }).addTo(map);
  }, [activeTile]);

  // Draw existing portfolio parcels subtly for spatial context
  useEffect(() => {
    const group = portfolioLayerRef.current;
    if (!group) return;
    group.clearLayers();

    parcels.forEach((p) => {
      if (!p.coordinates || p.coordinates.length < 3) return;
      const poly = L.polygon(p.coordinates, {
        color: '#2563EB',
        weight: 1.5,
        dashArray: '4, 3',
        fillColor: '#3B82F6',
        fillOpacity: 0.14,
      });
      poly.bindTooltip(
        `${escapeHtml(p.mahalle || '')} Ada ${escapeHtml(p.ada)} / ${escapeHtml(p.parselNo)}`,
        { direction: 'center', sticky: true }
      );
      group.addLayer(poly);
    });
  }, [parcels]);

  // Progressive administrative boundary rendering & zoom (like brktrk/parselsorgu)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = adminLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();

    let deepestBounds: L.LatLngBounds | null = null;

    if (selectedIlObj?.coordinates && selectedIlObj.coordinates.length >= 3) {
      const ilPoly = L.polygon(selectedIlObj.coordinates, {
        color: '#475569',
        weight: 1.5,
        dashArray: '6, 4',
        fillColor: '#64748B',
        fillOpacity: selectedIlceObj ? 0.03 : 0.08,
      });
      group.addLayer(ilPoly);
      deepestBounds = ilPoly.getBounds();
    }

    if (selectedIlceObj?.coordinates && selectedIlceObj.coordinates.length >= 3) {
      const ilcePoly = L.polygon(selectedIlceObj.coordinates, {
        color: '#0284C7',
        weight: 2,
        dashArray: '4, 4',
        fillColor: '#0EA5E9',
        fillOpacity: selectedMahalleObj ? 0.04 : 0.1,
      });
      group.addLayer(ilcePoly);
      deepestBounds = ilcePoly.getBounds();
    }

    if (selectedMahalleObj?.coordinates && selectedMahalleObj.coordinates.length >= 3) {
      const mahPoly = L.polygon(selectedMahalleObj.coordinates, {
        color: '#D97706',
        weight: 2.2,
        dashArray: '5, 3',
        fillColor: '#F59E0B',
        fillOpacity: 0.12,
      });
      group.addLayer(mahPoly);
      deepestBounds = mahPoly.getBounds();
    }

    // Only fit to administrative boundary if no active parcel result is currently zoomed in
    if (!result && deepestBounds && deepestBounds.isValid()) {
      map.fitBounds(deepestBounds, { padding: [28, 28], maxZoom: 15 });
    }
  }, [selectedIlObj, selectedIlceObj, selectedMahalleObj, result]);

  // Draw queried TKGM parcel polygon & picked coordinate marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = queryLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();

    if (pickedPoint && !result) {
      const marker = L.circleMarker(pickedPoint, {
        radius: 7,
        color: '#DC2626',
        weight: 2.5,
        fillColor: '#F87171',
        fillOpacity: 0.7,
      });
      marker.bindTooltip(`Seçilen Nokta: ${pickedPoint[0].toFixed(5)}, ${pickedPoint[1].toFixed(5)}`);
      group.addLayer(marker);
    }

    if (result && result.coordinates && result.coordinates.length >= 3) {
      const parcelPoly = L.polygon(result.coordinates, {
        color: '#DC2626',
        weight: 3.5,
        fillColor: '#EF4444',
        fillOpacity: 0.28,
      });

      const locLine = [result.il, result.ilce, result.mahalle].filter(Boolean).map(escapeHtml).join(' / ');
      const popupHtml = `
        <div class="p-1.5 min-w-[210px] font-sans text-xs">
          <div class="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1.5">
            Ada ${escapeHtml(result.ada)} / Parsel ${escapeHtml(result.parselNo)}
          </div>
          ${locLine ? `<div class="text-slate-600 mb-0.5 text-[11px]">${locLine}</div>` : ''}
          <div class="text-slate-700 mb-0.5">Yüzölçümü: <strong>${escapeHtml(formatArea(result.alanM2))}</strong></div>
          <div class="text-slate-700 mb-0.5">Nitelik: <strong>${escapeHtml(result.nitelik)}</strong></div>
          ${result.pafta ? `<div class="text-slate-600">Pafta: <strong>${escapeHtml(result.pafta)}</strong></div>` : ''}
        </div>
      `;
      parcelPoly.bindPopup(popupHtml);
      group.addLayer(parcelPoly);

      const bounds = parcelPoly.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
      }
    } else if (result && result.center) {
      map.setView(result.center, 16);
    }
  }, [result, pickedPoint]);

  const handleAdaParselSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessBanner(null);
    setResult(null);

    if (!selectedMahalleId) {
      setErrorMsg('Lütfen sırasıyla İl, İlçe ve Mahalle / Köy seçimi yapınız.');
      return;
    }

    const rawAda = adaNo.trim();
    const normalizedAda = rawAda === '' || rawAda === '-' ? '0' : rawAda;
    const cleanParsel = parselNo.trim();

    if (!/^\d+$/.test(normalizedAda) || !/^\d+$/.test(cleanParsel)) {
      setErrorMsg('Ada ve Parsel numaraları geçerli tam sayı olmalıdır (Ada yoksa 0 yazınız).');
      return;
    }

    setSearching(true);
    try {
      const data = await queryTkgmParcelByAdaParsel(
        Number(selectedMahalleId),
        normalizedAda,
        cleanParsel
      );
      setResult(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'TKGM parsel sorgusu başarısız oldu.');
    } finally {
      setSearching(false);
    }
  };

  const handleCoordinateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = Number(latInput.replace(',', '.').trim());
    const lng = Number(lngInput.replace(',', '.').trim());
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < 34 ||
      lat > 44 ||
      lng < 25 ||
      lng > 46
    ) {
      setErrorMsg('Lütfen Türkiye sınırları içinde geçerli Enlem ve Boylam değeri giriniz.');
      return;
    }
    setPickedPoint([lat, lng]);
    await runCoordQuery(lat, lng);
  };

  const handleClearSelection = () => {
    setSelectedIlId('');
    setSelectedIlceId('');
    setSelectedMahalleId('');
    setIlFilter('');
    setIlceFilter('');
    setMahalleFilter('');
    setAdaNo('');
    setParselNo('');
    setLatInput('');
    setLngInput('');
    setPickedPoint(null);
    setResult(null);
    setErrorMsg(null);
    setSuccessBanner(null);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([39.0, 35.2], 6);
    }
  };

  const handleAddQueriedParcel = (replaceExisting = false) => {
    if (!result) return;
    const safePrice = Math.max(0, Number(birimFiyatTL) || 0);

    if (replaceExisting && existingDuplicate) {
      const merged = mergeParcelWithTkgm(
        { ...existingDuplicate, birimFiyatTL: safePrice },
        result
      );
      onUpdateParcels(parcels.map((p) => (p.id === merged.id ? merged : p)));
      setSuccessBanner(
        `Ada ${merged.ada} / Parsel ${merged.parselNo} TKGM verisi ile güncellendi.`
      );
      return;
    }

    const newParcel = createParcelFromTkgm(result, safePrice);
    onUpdateParcels([...parcels, newParcel]);
    setSuccessBanner(
      `Ada ${newParcel.ada} / Parsel ${newParcel.parselNo} (${formatArea(newParcel.alanM2)}) portföye eklendi.`
    );
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessBanner(null);

    const parsedArea = parseFloat(manualForm.alanM2.replace(',', '.'));
    const parsedUnit = parseFloat(manualForm.birimFiyatTL.replace(',', '.')) || 0;
    const cleanParsel = manualForm.parselNo.trim();
    const cleanAda = manualForm.ada.trim() === '' ? '0' : manualForm.ada.trim();

    if (!cleanParsel) {
      setErrorMsg('Parsel numarası zorunludur.');
      return;
    }
    if (!Number.isFinite(parsedArea) || parsedArea <= 0) {
      setErrorMsg('Lütfen geçerli bir yüzölçümü (m²) değeri giriniz.');
      return;
    }

    const center: [number, number] = pickedPoint || [39.9208, 32.8541];
    const d = 0.00045;
    const coords: [number, number][] = [
      [center[0] - d, center[1] - d],
      [center[0] + d, center[1] - d],
      [center[0] + d, center[1] + d],
      [center[0] - d, center[1] + d],
    ];

    const newParcel: Parcel = {
      id: 'p_' + Math.random().toString(36).substring(2, 9),
      il: manualForm.il.trim() || undefined,
      ilce: manualForm.ilce.trim() || undefined,
      mahalle: manualForm.mahalle.trim() || undefined,
      ada: cleanAda,
      parselNo: cleanParsel,
      pafta: manualForm.pafta.trim() || undefined,
      mevkii: manualForm.mevkii.trim() || 'Belirtilmemiş',
      alanM2: Math.round(parsedArea * 100) / 100,
      nitelik: manualForm.nitelik.trim() || 'Tarla',
      birimFiyatTL: Math.max(0, parsedUnit),
      toplamDegerTL: Math.round(parsedArea * Math.max(0, parsedUnit)),
      coordinates: coords,
      center,
      subUsageAreas: [],
    };

    onUpdateParcels([...parcels, newParcel]);
    setSuccessBanner(
      `Manuel giriş: Ada ${newParcel.ada} / Parsel ${newParcel.parselNo} portföye eklendi.`
    );
    setManualForm((prev) => ({
      ...prev,
      ada: '',
      parselNo: '',
      pafta: '',
      mevkii: '',
      alanM2: '',
    }));
  };

  const handleFitMap = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const targetGroup =
      queryLayerRef.current && queryLayerRef.current.getLayers().length > 0
        ? queryLayerRef.current
        : adminLayerRef.current && adminLayerRef.current.getLayers().length > 0
        ? adminLayerRef.current
        : portfolioLayerRef.current;

    if (!targetGroup) return;
    const layers = targetGroup.getLayers() as L.Polygon[];
    const boundsList: L.LatLngBounds[] = [];
    layers.forEach((l) => {
      if (typeof (l as any).getBounds === 'function') {
        const b = (l as any).getBounds();
        if (b && b.isValid()) boundsList.push(b);
      }
    });

    if (boundsList.length > 0) {
      const combined = boundsList[0];
      for (let i = 1; i < boundsList.length; i++) combined.extend(boundsList[i]);
      map.fitBounds(combined, { padding: [36, 36], maxZoom: 18 });
    } else {
      map.setView([39.0, 35.2], 6);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Parsel Ekleme (TKGM Parsel Sorgu)
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            İl, İlçe, Mahalle, Ada ve Parsel bilgisiyle TKGM servisinden tapu verilerini ve parsel sınırlarını çekip portföye ekleyin.
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateToParcels}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shrink-0"
        >
          <span>Kayıtlı Parseller</span>
          <span className="font-mono tabular-nums px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
            {parcels.length}
          </span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Split Grid: Left Query Panel + Right Interactive Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Query & Result Panel */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {/* Mode Switcher Tabs */}
            <div className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
              <button
                type="button"
                onClick={() => {
                  setMode('ada_parsel');
                  setErrorMsg(null);
                  setSuccessBanner(null);
                }}
                className={`py-2.5 px-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
                  mode === 'ada_parsel'
                    ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Ada / Parsel</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('koordinat');
                  setErrorMsg(null);
                  setSuccessBanner(null);
                }}
                className={`py-2.5 px-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
                  mode === 'koordinat'
                    ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Koordinat</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('manuel');
                  setErrorMsg(null);
                  setSuccessBanner(null);
                  setResult(null);
                }}
                className={`py-2.5 px-2 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 transition ${
                  mode === 'manuel'
                    ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Manuel</span>
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Error & Success Feedback */}
              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
              )}

              {successBanner && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 flex items-start justify-between gap-2 text-xs text-emerald-800 dark:text-emerald-200">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="leading-relaxed font-medium">{successBanner}</span>
                  </div>
                  <button
                    type="button"
                    onClick={onNavigateToParcels}
                    className="shrink-0 underline font-semibold text-emerald-800 dark:text-emerald-300 hover:text-emerald-950"
                  >
                    Listeye Git
                  </button>
                </div>
              )}

              {/* MODE 1: ADA / PARSEL */}
              {mode === 'ada_parsel' && (
                <form onSubmit={handleAdaParselSearch} className="space-y-3.5">
                  {/* İl */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        İl
                      </label>
                      <div className="flex items-center gap-2">
                        {loadingIller && (
                          <span className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Yükleniyor
                          </span>
                        )}
                        {!loadingIller && iller.length === 0 && (
                          <button
                            type="button"
                            onClick={loadProvinces}
                            className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                          >
                            <RefreshCw className="w-3 h-3" /> Yenile
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={ilFilter}
                      onChange={(e) => setIlFilter(e.target.value)}
                      placeholder="İl ara..."
                      className="w-full mb-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                    <select
                      value={selectedIlId}
                      onChange={(e) => setSelectedIlId(e.target.value)}
                      disabled={loadingIller}
                      className="w-full px-2.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    >
                      <option value="">
                        {loadingIller
                          ? 'İller yükleniyor...'
                          : `-- İl Seçiniz (${filteredIller.length}) --`}
                      </option>
                      {filteredIller.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.text}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* İlçe */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        İlçe
                      </label>
                      {loadingIlceler && (
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Yükleniyor
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={ilceFilter}
                      onChange={(e) => setIlceFilter(e.target.value)}
                      placeholder="İlçe ara..."
                      disabled={!selectedIlId || loadingIlceler}
                      className="w-full mb-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                    <select
                      value={selectedIlceId}
                      onChange={(e) => setSelectedIlceId(e.target.value)}
                      disabled={!selectedIlId || loadingIlceler}
                      className="w-full px-2.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    >
                      <option value="">
                        {!selectedIlId
                          ? '-- Önce İl Seçiniz --'
                          : loadingIlceler
                          ? 'İlçeler yükleniyor...'
                          : `-- İlçe Seçiniz (${filteredIlceler.length}) --`}
                      </option>
                      {filteredIlceler.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.text}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Mahalle / Köy */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Mahalle / Köy
                      </label>
                      {loadingMahalleler && (
                        <span className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Yükleniyor
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      value={mahalleFilter}
                      onChange={(e) => setMahalleFilter(e.target.value)}
                      placeholder="Mahalle veya köy ara..."
                      disabled={!selectedIlceId || loadingMahalleler}
                      className="w-full mb-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                    <select
                      value={selectedMahalleId}
                      onChange={(e) => setSelectedMahalleId(e.target.value)}
                      disabled={!selectedIlceId || loadingMahalleler}
                      className="w-full px-2.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    >
                      <option value="">
                        {!selectedIlceId
                          ? '-- Önce İlçe Seçiniz --'
                          : loadingMahalleler
                          ? 'Mahalleler yükleniyor...'
                          : `-- Mahalle Seçiniz (${filteredMahalleler.length}) --`}
                      </option>
                      {filteredMahalleler.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.text}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Ada & Parsel Inputs */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Ada No
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={adaNo}
                        onChange={(e) => setAdaNo(e.target.value)}
                        placeholder="Yoksa 0"
                        className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Parsel No <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={parselNo}
                        onChange={(e) => setParselNo(e.target.value)}
                        placeholder="Örn: 43"
                        required
                        className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Köy ve kırsal parsellerde ada numarası yoksa Ada alanını boş bırakabilir veya <span className="font-mono font-semibold">0</span> yazabilirsiniz.
                  </p>

                  {/* Query & Clear Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={searching || !selectedMahalleId}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {searching ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sorgulanıyor...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4" />
                          <span>TKGM&apos;den Sorgula</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleClearSelection}
                      title="Seçimi Temizle"
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Temizle</span>
                    </button>
                  </div>
                </form>
              )}

              {/* MODE 2: KOORDINAT SORGU */}
              {mode === 'koordinat' && (
                <form onSubmit={handleCoordinateSubmit} className="space-y-3.5">
                  <div className="p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/60 text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
                    Sağdaki haritada parselin üzerine doğrudan tıklayarak veya aşağıya enlem/boylam girerek TKGM kaydını getirebilirsiniz.
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Enlem (Latitude)
                      </label>
                      <input
                        type="text"
                        value={latInput}
                        onChange={(e) => setLatInput(e.target.value)}
                        placeholder="Örn: 39.925533"
                        className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Boylam (Longitude)
                      </label>
                      <input
                        type="text"
                        value={lngInput}
                        onChange={(e) => setLngInput(e.target.value)}
                        placeholder="Örn: 32.866287"
                        className="w-full px-2.5 py-2 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={searching || !latInput.trim() || !lngInput.trim()}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition"
                    >
                      {searching ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Sorgulanıyor...</span>
                        </>
                      ) : (
                        <>
                          <Compass className="w-4 h-4" />
                          <span>Koordinattan Sorgula</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Temizle</span>
                    </button>
                  </div>
                </form>
              )}

              {/* MODE 3: MANUEL GIRIS */}
              {mode === 'manuel' && (
                <form onSubmit={handleManualSubmit} className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        İl
                      </label>
                      <input
                        type="text"
                        value={manualForm.il}
                        onChange={(e) => setManualForm({ ...manualForm, il: e.target.value })}
                        placeholder="İl"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        İlçe
                      </label>
                      <input
                        type="text"
                        value={manualForm.ilce}
                        onChange={(e) => setManualForm({ ...manualForm, ilce: e.target.value })}
                        placeholder="İlçe"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Mahalle/Köy
                      </label>
                      <input
                        type="text"
                        value={manualForm.mahalle}
                        onChange={(e) => setManualForm({ ...manualForm, mahalle: e.target.value })}
                        placeholder="Mahalle"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Ada No
                      </label>
                      <input
                        type="text"
                        value={manualForm.ada}
                        onChange={(e) => setManualForm({ ...manualForm, ada: e.target.value })}
                        placeholder="0"
                        className="w-full px-2 py-1.5 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Parsel No <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={manualForm.parselNo}
                        onChange={(e) => setManualForm({ ...manualForm, parselNo: e.target.value })}
                        placeholder="Örn: 124"
                        className="w-full px-2 py-1.5 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Pafta
                      </label>
                      <input
                        type="text"
                        value={manualForm.pafta}
                        onChange={(e) => setManualForm({ ...manualForm, pafta: e.target.value })}
                        placeholder="Opsiyonel"
                        className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Nitelik
                      </label>
                      <input
                        type="text"
                        value={manualForm.nitelik}
                        onChange={(e) => setManualForm({ ...manualForm, nitelik: e.target.value })}
                        placeholder="Tarla, Arsa, Bahçe"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Mevkii
                      </label>
                      <input
                        type="text"
                        value={manualForm.mevkii}
                        onChange={(e) => setManualForm({ ...manualForm, mevkii: e.target.value })}
                        placeholder="Mevkii adı"
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Yüzölçümü (m²) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={manualForm.alanM2}
                        onChange={(e) => setManualForm({ ...manualForm, alanM2: e.target.value })}
                        placeholder="Örn: 2500"
                        className="w-full px-2 py-1.5 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Birim Değer (TL/m²)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={manualForm.birimFiyatTL}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, birimFiyatTL: e.target.value })
                        }
                        className="w-full px-2 py-1.5 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {pickedPoint
                      ? `Harita konumu seçildi: ${pickedPoint[0].toFixed(5)}, ${pickedPoint[1].toFixed(5)}`
                      : 'İsterseniz haritaya tıklayarak parsel merkez noktasını işaretleyebilirsiniz.'}
                  </div>

                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Manuel Parseli Portföye Ekle</span>
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* TKGM Result Preview Card */}
          {result && (
            <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/70 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-emerald-50/70 dark:bg-emerald-950/40 border-b border-emerald-200/70 dark:border-emerald-900/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                    TKGM Tapu & Kadastro Kaydı
                  </span>
                </div>
                <span className="text-[11px] font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                  {result.coordinates.length} köşe noktası
                </span>
              </div>

              <div className="p-4 space-y-3.5">
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="col-span-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      İdari Konum
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {[result.il, result.ilce, result.mahalle].filter(Boolean).join(' / ') || '—'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Ada / Parsel
                    </div>
                    <div className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {result.ada || '0'} / {result.parselNo}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Yüzölçümü
                    </div>
                    <div className="font-mono tabular-nums font-bold text-blue-700 dark:text-blue-400 mt-0.5">
                      {formatArea(result.alanM2)}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Tapu Niteliği
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {result.nitelik || '—'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Pafta / Mevkii
                    </div>
                    <div className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                      {[result.pafta, result.mevkii].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                </div>

                {/* Valuation Input */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-end justify-between gap-3">
                  <div className="flex-1">
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Birim Rayiç Değer (TL/m²)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={birimFiyatTL}
                      onChange={(e) => setBirimFiyatTL(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Toplam Değer
                    </div>
                    <div className="text-sm font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {formatCurrency(Math.round(result.alanM2 * birimFiyatTL))}
                    </div>
                  </div>
                </div>

                {existingDuplicate && (
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-200">
                    Bu parsel (Ada {existingDuplicate.ada} / {existingDuplicate.parselNo}) portföyünüzde zaten kayıtlı. Mevcut kaydı güncelleyebilir veya yeni kayıt olarak ekleyebilirsiniz.
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  {existingDuplicate && (
                    <button
                      type="button"
                      onClick={() => handleAddQueriedParcel(true)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Mevcut Parseli Güncelle</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAddQueriedParcel(false)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Portföye Ekle</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Interactive Map Column */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-2.5">
          <div className="relative w-full h-[540px] sm:h-[620px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900">
            <div ref={mapContainerRef} className="w-full h-full z-0" />

            {/* Top Right Layer & Fit Controls */}
            <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-1 px-1">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={activeTile}
                  onChange={(e) => setActiveTile(e.target.value as TileProvider)}
                  className="text-xs font-medium text-slate-800 dark:text-slate-200 bg-transparent border-0 focus:ring-0 py-1 pl-1 pr-5 cursor-pointer"
                >
                  <option value="google_hybrid">Google Hibrit (Uydu + Yol)</option>
                  <option value="esri_satellite">Esri Uydu</option>
                  <option value="osm_streets">Sokak Haritası (OSM)</option>
                </select>
              </div>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

              <button
                type="button"
                onClick={handleFitMap}
                title="Sınırlara Odaklan"
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Bottom Left Legend */}
            <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 flex flex-wrap items-center gap-3 shadow-sm">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-500/70 border border-red-600" />
                <span>Sorgulanan Parsel</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/40 border border-blue-600 border-dashed" />
                <span>Portföy Parselleri ({parcels.length})</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/30 border border-amber-600 border-dashed" />
                <span>İdari Sınır</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
