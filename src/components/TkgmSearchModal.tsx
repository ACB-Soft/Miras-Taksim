import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Compass,
  Loader2,
  MapPin,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Parcel, TkgmAdminItem, TkgmParcelResult } from '../types';
import {
  createParcelFromTkgm,
  fetchTkgmIlceler,
  fetchTkgmIller,
  fetchTkgmMahalleler,
  queryTkgmParcelByAdaParsel,
  queryTkgmParcelByCoords,
} from '../services/tkgmService';
import { formatArea, formatCurrency } from '../utils/fractionEngine';

interface TkgmSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddParcel: (parcel: Parcel) => void;
}

type SearchTab = 'ada_parsel' | 'koordinat';

export const TkgmSearchModal: React.FC<TkgmSearchModalProps> = ({
  isOpen,
  onClose,
  onAddParcel,
}) => {
  const [activeTab, setActiveTab] = useState<SearchTab>('ada_parsel');

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

  // Coordinate tab states
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');

  // Loading & error states
  const [loadingIller, setLoadingIller] = useState(false);
  const [loadingIlceler, setLoadingIlceler] = useState(false);
  const [loadingMahalleler, setLoadingMahalleler] = useState(false);
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Result preview & valuation state
  const [result, setResult] = useState<TkgmParcelResult | null>(null);
  const [birimFiyatTL, setBirimFiyatTL] = useState<number>(500);

  // Load provinces when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    if (iller.length > 0) return;

    let cancelled = false;
    setLoadingIller(true);
    fetchTkgmIller()
      .then((items) => {
        if (!cancelled) setIller(items);
      })
      .catch((err: any) => {
        if (!cancelled) setErrorMsg(err?.message || 'İl listesi yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setLoadingIller(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, iller.length]);

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

  if (!isOpen) return null;

  const handleAdaParselSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResult(null);

    if (!selectedMahalleId) {
      setErrorMsg('Lütfen İl, İlçe ve Mahalle / Köy seçimi yapınız.');
      return;
    }
    const normalizedAda = adaNo.trim() === '' || adaNo.trim() === '-' ? '0' : adaNo.trim();
    if (!/^\d+$/.test(normalizedAda) || !/^\d+$/.test(parselNo.trim())) {
      setErrorMsg('Ada ve Parsel numaraları geçerli tam sayı olmalıdır (Ada yoksa 0 yazınız).');
      return;
    }

    setSearching(true);
    try {
      const data = await queryTkgmParcelByAdaParsel(
        Number(selectedMahalleId),
        normalizedAda,
        parselNo.trim()
      );
      setResult(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Parsel sorgulanırken bir hata oluştu.');
    } finally {
      setSearching(false);
    }
  };

  const handleCoordSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResult(null);

    const lat = Number(latInput.replace(',', '.').trim());
    const lng = Number(lngInput.replace(',', '.').trim());
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      setErrorMsg('Geçerli enlem (-90..90) ve boylam (-180..180) değeri giriniz.');
      return;
    }

    setSearching(true);
    try {
      const data = await queryTkgmParcelByCoords(lat, lng);
      setResult(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Koordinat ile parsel sorgulanırken bir hata oluştu.');
    } finally {
      setSearching(false);
    }
  };

  const handleConfirmAdd = () => {
    if (!result) return;
    const newParcel = createParcelFromTkgm(result, birimFiyatTL);
    onAddParcel(newParcel);
    setResult(null);
    onClose();
  };

  const totalValuePreview = result
    ? Math.round((Number(result.alanM2) || 0) * (Number(birimFiyatTL) || 0))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Compass className="w-4 h-4 text-blue-600" />
              TKGM Parsel Sorgula ve Portföye Ekle
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              KML dosyası olmadan il/ilçe/mahalle/ada/parsel veya koordinat ile tapu ve sınır verisini çekin
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
            aria-label="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="px-6 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 bg-slate-50/70 dark:bg-slate-950/40">
          <button
            type="button"
            onClick={() => {
              setActiveTab('ada_parsel');
              setErrorMsg(null);
            }}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'ada_parsel'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Ada / Parsel ile Sorgula
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('koordinat');
              setErrorMsg(null);
            }}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'koordinat'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Koordinat (Enlem / Boylam) ile Sorgula
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-800 dark:text-red-300 flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              {iller.length === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setLoadingIller(true);
                    fetchTkgmIller()
                      .then((items) => setIller(items))
                      .catch((err: any) => setErrorMsg(err?.message || 'İl listesi yüklenemedi.'))
                      .finally(() => setLoadingIller(false));
                  }}
                  className="px-2 py-1 text-[11px] font-semibold rounded bg-red-600 text-white hover:bg-red-700 shrink-0"
                >
                  Tekrar Dene
                </button>
              )}
            </div>
          )}

          {activeTab === 'ada_parsel' ? (
            <form onSubmit={handleAdaParselSearch} className="space-y-3.5">
              {/* Cascading Selectors with quick text filter */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* İl */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>İl</span>
                    {loadingIller && <Loader2 className="w-3 h-3 animate-spin text-blue-600" />}
                  </label>
                  <input
                    type="text"
                    value={ilFilter}
                    onChange={(e) => setIlFilter(e.target.value)}
                    placeholder="İl ara..."
                    className="w-full px-2.5 py-1.5 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  />
                  <select
                    value={selectedIlId}
                    onChange={(e) => setSelectedIlId(e.target.value)}
                    disabled={loadingIller}
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- İl Seçin ({filteredIller.length}) --</option>
                    {filteredIller.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.text}
                      </option>
                    ))}
                  </select>
                </div>

                {/* İlçe */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>İlçe</span>
                    {loadingIlceler && <Loader2 className="w-3 h-3 animate-spin text-blue-600" />}
                  </label>
                  <input
                    type="text"
                    value={ilceFilter}
                    onChange={(e) => setIlceFilter(e.target.value)}
                    placeholder="İlçe ara..."
                    disabled={!selectedIlId}
                    className="w-full px-2.5 py-1.5 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 disabled:opacity-50"
                  />
                  <select
                    value={selectedIlceId}
                    onChange={(e) => setSelectedIlceId(e.target.value)}
                    disabled={!selectedIlId || loadingIlceler}
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                  >
                    <option value="">
                      {selectedIlId
                        ? `-- İlçe Seçin (${filteredIlceler.length}) --`
                        : 'Önce İl seçin'}
                    </option>
                    {filteredIlceler.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.text}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mahalle */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Mahalle / Köy</span>
                    {loadingMahalleler && (
                      <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                    )}
                  </label>
                  <input
                    type="text"
                    value={mahalleFilter}
                    onChange={(e) => setMahalleFilter(e.target.value)}
                    placeholder="Mahalle ara..."
                    disabled={!selectedIlceId}
                    className="w-full px-2.5 py-1.5 text-[11px] rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 disabled:opacity-50"
                  />
                  <select
                    value={selectedMahalleId}
                    onChange={(e) => setSelectedMahalleId(e.target.value)}
                    disabled={!selectedIlceId || loadingMahalleler}
                    className="w-full p-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50"
                  >
                    <option value="">
                      {selectedIlceId
                        ? `-- Mahalle Seçin (${filteredMahalleler.length}) --`
                        : 'Önce İlçe seçin'}
                    </option>
                    {filteredMahalleler.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.text}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ada / Parsel inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Ada No <span className="font-normal text-slate-400">(yoksa 0)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={adaNo}
                    onChange={(e) => setAdaNo(e.target.value)}
                    placeholder="Örn: 124 veya 0"
                    className="w-full mt-1 p-2 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Parsel No
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={parselNo}
                    onChange={(e) => setParselNo(e.target.value)}
                    placeholder="Örn: 15"
                    className="w-full mt-1 p-2 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching || !selectedMahalleId}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {searching ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Sorgulanıyor...
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      TKGM&apos;den Sorgula
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCoordSearch} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Enlem (Latitude)
                  </label>
                  <input
                    type="text"
                    value={latInput}
                    onChange={(e) => setLatInput(e.target.value)}
                    placeholder="Örn: 39.92077"
                    className="w-full mt-1 p-2 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                    Boylam (Longitude)
                  </label>
                  <input
                    type="text"
                    value={lngInput}
                    onChange={(e) => setLngInput(e.target.value)}
                    placeholder="Örn: 32.85411"
                    className="w-full mt-1 p-2 text-xs font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {searching ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Sorgulanıyor...
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      Koordinattan Bul
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Result Preview Card */}
          {result && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-emerald-200/70 dark:border-emerald-900/60">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  TKGM Parsel Kaydı Bulundu
                </div>
                <span className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
                  {result.coordinates.length} Sınır Köşe Noktası
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">
                    İl / İlçe / Mahalle
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                    {[result.il, result.ilce, result.mahalle].filter(Boolean).join(' / ') || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">
                    Ada / Parsel
                  </div>
                  <div className="font-mono font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {result.ada} / {result.parselNo}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">
                    Yüzölçümü
                  </div>
                  <div className="font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                    {formatArea(result.alanM2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Nitelik</div>
                  <div className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                    {result.nitelik || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Pafta</div>
                  <div className="font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                    {result.pafta || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Mevkii</div>
                  <div className="text-slate-800 dark:text-slate-200 mt-0.5">
                    {result.mevkii || '-'}
                  </div>
                </div>
              </div>

              {/* Valuation Input */}
              <div className="pt-2 border-t border-emerald-200/70 dark:border-emerald-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    Birim Değer (TL/m²):
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={birimFiyatTL}
                    onChange={(e) => setBirimFiyatTL(parseFloat(e.target.value) || 0)}
                    className="w-28 p-1.5 text-xs font-mono font-bold tabular-nums rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-right"
                  />
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  Tahmini Değer:{' '}
                  <strong className="font-mono tabular-nums text-blue-700 dark:text-blue-400">
                    {formatCurrency(totalValuePreview)}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/70 dark:bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Kapat
          </button>
          <button
            type="button"
            disabled={!result}
            onClick={handleConfirmAdd}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Portföye Ekle
          </button>
        </div>
      </div>
    </div>
  );
};
