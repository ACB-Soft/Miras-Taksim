import React, { useEffect, useRef, useState } from 'react';
import { Parcel, Heir, SubUsageArea } from '../types';
import { parseKMLToParcels, parseKMLToSubUsageAreas } from '../utils/kmlParser';
import { calculatePolygonCentroid } from '../utils/polygonMath';
import { formatCurrency, formatArea } from '../utils/fractionEngine';
import {
  mergeParcelWithTkgm,
  queryTkgmParcelByCoords,
} from '../services/tkgmService';
import { MapModule } from './MapModule';
import { TkgmSearchModal } from './TkgmSearchModal';
import {
  Upload,
  Plus,
  Trash2,
  Edit2,
  Layers,
  FileText,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Scale,
  RefreshCw,
  X,
  Compass,
  Loader2,
  Search,
} from 'lucide-react';

interface ParcelManagementProps {
  parcels: Parcel[];
  heirs: Heir[];
  onUpdateParcels: (parcels: Parcel[]) => void;
  onNavigateToNotary?: () => void;
}

export const ParcelManagement: React.FC<ParcelManagementProps> = ({
  parcels,
  heirs,
  onUpdateParcels,
  onNavigateToNotary,
}) => {
  const masterKmlInputRef = useRef<HTMLInputElement>(null);
  const subKmlInputRef = useRef<HTMLInputElement>(null);

  const [selectedParcelId, setSelectedParcelId] = useState<string | undefined>(
    parcels[0]?.id
  );
  const [editingParcel, setEditingParcel] = useState<Parcel | null>(null);
  const [subKmlModalParcel, setSubKmlModalParcel] = useState<Parcel | null>(null);

  // TKGM Integration states
  const [showTkgmModal, setShowTkgmModal] = useState(false);
  const [matchingParcelIds, setMatchingParcelIds] = useState<Record<string, boolean>>({});
  const [parcelTkgmErrors, setParcelTkgmErrors] = useState<Record<string, string>>({});
  const [batchState, setBatchState] = useState<{
    running: boolean;
    current: number;
    total: number;
    successCount: number;
    failCount: number;
    summaryMsg?: string;
  } | null>(null);
  const batchCancelRef = useRef(false);
  const [editingTkgmLoading, setEditingTkgmLoading] = useState(false);
  const [editingTkgmMsg, setEditingTkgmMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [uploadBannerMsg, setUploadBannerMsg] = useState<string | null>(null);

  // Always keep latest parcels reference for sequential async updates
  const parcelsRef = useRef<Parcel[]>(parcels);
  useEffect(() => {
    parcelsRef.current = parcels;
  }, [parcels]);

  const getParcelQueryPoint = (parcel: Parcel): [number, number] | null => {
    if (
      parcel.center &&
      Number.isFinite(parcel.center[0]) &&
      Number.isFinite(parcel.center[1])
    ) {
      return parcel.center;
    }
    if (parcel.coordinates && parcel.coordinates.length >= 3) {
      return calculatePolygonCentroid(parcel.coordinates);
    }
    return null;
  };

  // Match single parcel with TKGM using its center coordinates
  const handleMatchSingleParcelTkgm = async (parcel: Parcel) => {
    const point = getParcelQueryPoint(parcel);
    if (!point) {
      setParcelTkgmErrors((prev) => ({
        ...prev,
        [parcel.id]: 'Parselin harita koordinatı bulunamadı.',
      }));
      return;
    }

    setMatchingParcelIds((prev) => ({ ...prev, [parcel.id]: true }));
    setParcelTkgmErrors((prev) => {
      const next = { ...prev };
      delete next[parcel.id];
      return next;
    });

    try {
      const tkgm = await queryTkgmParcelByCoords(point[0], point[1]);
      const latestList = parcelsRef.current;
      const currentTarget = latestList.find((p) => p.id === parcel.id) || parcel;
      const merged = mergeParcelWithTkgm(currentTarget, tkgm);
      const nextList = latestList.map((p) => (p.id === merged.id ? merged : p));
      parcelsRef.current = nextList;
      onUpdateParcels(nextList);
      setSelectedParcelId(merged.id);
    } catch (err: any) {
      setParcelTkgmErrors((prev) => ({
        ...prev,
        [parcel.id]: err?.message || 'TKGM eşleştirmesi başarısız oldu.',
      }));
    } finally {
      setMatchingParcelIds((prev) => {
        const next = { ...prev };
        delete next[parcel.id];
        return next;
      });
    }
  };

  // Batch match parcels sequentially with polite rate limiting (350ms delay)
  const handleBatchMatchTkgm = async (onlyUnmatched: boolean) => {
    if (batchState?.running) return;
    const targets = parcelsRef.current.filter((p) =>
      onlyUnmatched ? !p.tkgmSorguTarihi : true
    );
    if (targets.length === 0) return;

    batchCancelRef.current = false;
    let successCount = 0;
    let failCount = 0;

    setBatchState({
      running: true,
      current: 0,
      total: targets.length,
      successCount: 0,
      failCount: 0,
    });

    for (let i = 0; i < targets.length; i++) {
      if (batchCancelRef.current) break;

      const target = targets[i];
      setBatchState((prev) =>
        prev ? { ...prev, current: i + 1, successCount, failCount } : null
      );

      const point = getParcelQueryPoint(target);
      if (!point) {
        failCount++;
        setParcelTkgmErrors((prev) => ({
          ...prev,
          [target.id]: 'Parselin harita koordinatı bulunamadı.',
        }));
      } else {
        setMatchingParcelIds((prev) => ({ ...prev, [target.id]: true }));
        try {
          const tkgm = await queryTkgmParcelByCoords(point[0], point[1]);
          const latestList = parcelsRef.current;
          const freshTarget = latestList.find((p) => p.id === target.id) || target;
          const merged = mergeParcelWithTkgm(freshTarget, tkgm);
          const nextList = latestList.map((p) => (p.id === merged.id ? merged : p));
          parcelsRef.current = nextList;
          onUpdateParcels(nextList);

          setParcelTkgmErrors((prev) => {
            const next = { ...prev };
            delete next[target.id];
            return next;
          });
          successCount++;
        } catch (err: any) {
          failCount++;
          setParcelTkgmErrors((prev) => ({
            ...prev,
            [target.id]: err?.message || 'TKGM eşleştirmesi başarısız oldu.',
          }));
        } finally {
          setMatchingParcelIds((prev) => {
            const next = { ...prev };
            delete next[target.id];
            return next;
          });
        }
      }

      if (i < targets.length - 1 && !batchCancelRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }

    const cancelled = batchCancelRef.current;
    setBatchState({
      running: false,
      current: targets.length,
      total: targets.length,
      successCount,
      failCount,
      summaryMsg: cancelled
        ? `Toplu eşleştirme durduruldu: ${successCount} parsel güncellendi, ${failCount} hata.`
        : `TKGM eşleştirmesi tamamlandı: ${successCount} parsel güncellendi${
            failCount > 0 ? `, ${failCount} parselde uyarı oluştu` : ''
          }.`,
    });
  };

  // Refresh currently opened edit modal parcel from TKGM
  const handleMatchEditingParcelTkgm = async () => {
    if (!editingParcel || editingTkgmLoading) return;
    const point = getParcelQueryPoint(editingParcel);
    if (!point) {
      setEditingTkgmMsg({
        type: 'error',
        text: 'Bu parsel için harita koordinatı bulunamadığından TKGM sorgusu yapılamıyor.',
      });
      return;
    }

    setEditingTkgmLoading(true);
    setEditingTkgmMsg(null);
    try {
      const tkgm = await queryTkgmParcelByCoords(point[0], point[1]);
      const merged = mergeParcelWithTkgm(editingParcel, tkgm);
      setEditingParcel(merged);
      setEditingTkgmMsg({
        type: 'success',
        text: 'Tapu öznitelikleri ve sınır geometrisi TKGM kaydından güncellendi. Kaydetmek için "Değişiklikleri Kaydet" butonuna basın.',
      });
    } catch (err: any) {
      setEditingTkgmMsg({
        type: 'error',
        text: err?.message || 'TKGM sorgusu başarısız oldu.',
      });
    } finally {
      setEditingTkgmLoading(false);
    }
  };

  // Master KML Upload Handler
  const handleMasterKmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseKMLToParcels(text, file.name);

      if (parsed.length === 0) {
        setUploadBannerMsg(
          'KML dosyasında geçerli parsel poligonu bulunamadı. Lütfen geçerli bir KML dosyası seçiniz.'
        );
        return;
      }

      const updated = [...parcelsRef.current, ...parsed];
      parcelsRef.current = updated;
      onUpdateParcels(updated);
      setSelectedParcelId(parsed[0].id);
      setUploadBannerMsg(
        `${parsed.length} adet taşınmaz parseli KML dosyasından yüklendi. İsterseniz aşağıdaki butonla TKGM üzerinden tapu ve sınır bilgilerini eşleştirebilirsiniz.`
      );
    } catch (err: any) {
      setUploadBannerMsg('KML okuma hatası: ' + err.message);
    } finally {
      if (masterKmlInputRef.current) masterKmlInputRef.current.value = '';
    }
  };

  // Sub KML Upload Handler (For In-Parcel Fiili Taksim)
  // Supports selecting 2 or more KML files simultaneously or multi-polygon KML files
  const handleSubKmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !subKmlModalParcel) return;

    try {
      const parsedSubAreas: SubUsageArea[] = [];
      for (const file of files) {
        const text = await file.text();
        const subAreas = parseKMLToSubUsageAreas(text, file.name);
        parsedSubAreas.push(...subAreas);
      }

      if (parsedSubAreas.length === 0) {
        alert('Seçilen KML dosyasında/dosyalarında geçerli poligon alanı tespit edilemedi.');
        return;
      }

      // Append new sub-areas to existing ones
      const existing = subKmlModalParcel.subUsageAreas || [];
      const combined = [...existing, ...parsedSubAreas];

      const updatedParcel: Parcel = {
        ...subKmlModalParcel,
        subUsageAreas: combined,
      };

      setSubKmlModalParcel(updatedParcel);

      const updatedList = parcels.map((p) =>
        p.id === updatedParcel.id ? updatedParcel : p
      );
      onUpdateParcels(updatedList);

      const parcelArea = Number(subKmlModalParcel.alanM2) || 0;
      const totalArea = combined.reduce((sum, s) => sum + (Number(s.alanM2) || 0), 0);
      const diff = Math.round((totalArea - parcelArea) * 100) / 100;

      if (combined.length < 2) {
        alert(
          `Yüklenen KML bölüm sayısı: ${combined.length} adet.\n\n⚠️ Kural Uyarısı: Fiili kullanım taksimi için en az 2 adet KML alanı yüklenmelidir. Lütfen diğer hissedarlara ait KML dosyasını da ekleyin.`
        );
      } else if (Math.abs(diff) > 1) {
        alert(
          `Toplam ${combined.length} adet fiili kullanım bölümü yüklendi.\n\n⚠️ Alan Uyuşmazlığı:\n• Yüklenen KML Alanları Toplamı: ${formatArea(totalArea)}\n• Parsel Kadastro Alanı: ${formatArea(parcelArea)}\n• Fark: ${diff > 0 ? `+${formatArea(diff)} (Fazla)` : `${formatArea(Math.abs(diff))} (Eksik)`}.\n\nPenceredeki "Parsel Büyüklüğüne Eşitle (Orantıla)" butonunu kullanarak alanları otomatik olarak eşitleyebilir veya elle düzeltebilirsiniz.`
        );
      } else {
        alert(
          `${combined.length} adet fiili kullanım alanı başarıyla yüklendi ve parsel alanı (${formatArea(parcelArea)}) ile tam eşit! Şimdi her bölüm için hak sahibi mirasçıyı seçebilirsiniz.`
        );
      }
    } catch (err: any) {
      alert('Alt KML okuma hatası: ' + err.message);
    } finally {
      if (subKmlInputRef.current) subKmlInputRef.current.value = '';
    }
  };

  // Automatically calibrate & proportion sub-areas to equal the parcel's alanM2 exactly
  const handleAutoProportionSubAreas = () => {
    if (!subKmlModalParcel || !subKmlModalParcel.subUsageAreas || subKmlModalParcel.subUsageAreas.length === 0) return;
    const parcelArea = Number(subKmlModalParcel.alanM2) || 0;
    if (parcelArea <= 0) {
      alert('Parsel büyüklüğü (m²) sıfırdan büyük olmalıdır.');
      return;
    }

    const currentTotal = subKmlModalParcel.subUsageAreas.reduce(
      (sum, s) => sum + (Number(s.alanM2) || 0),
      0
    );
    if (currentTotal <= 0) return;

    let runningSum = 0;
    const count = subKmlModalParcel.subUsageAreas.length;
    const calibrated = subKmlModalParcel.subUsageAreas.map((sub, idx) => {
      if (idx === count - 1) {
        // Last sub-area absorbs any 0.01 floating point rounding to guarantee exact equality
        const lastArea = Math.round((parcelArea - runningSum) * 100) / 100;
        return { ...sub, alanM2: Math.max(lastArea, 0) };
      }
      const scaled = Math.round(((Number(sub.alanM2) || 0) / currentTotal) * parcelArea * 100) / 100;
      runningSum += scaled;
      return { ...sub, alanM2: scaled };
    });

    const updatedParcel = { ...subKmlModalParcel, subUsageAreas: calibrated };
    setSubKmlModalParcel(updatedParcel);
    const updatedList = parcels.map((p) => (p.id === updatedParcel.id ? updatedParcel : p));
    onUpdateParcels(updatedList);
  };

  // Update sub-area name or area
  const handleUpdateSubArea = (subAreaId: string, updates: Partial<SubUsageArea>) => {
    if (!subKmlModalParcel || !subKmlModalParcel.subUsageAreas) return;

    const updatedSubAreas = subKmlModalParcel.subUsageAreas.map((sub) => {
      if (sub.id === subAreaId) {
        return { ...sub, ...updates };
      }
      return sub;
    });

    const updatedParcel: Parcel = {
      ...subKmlModalParcel,
      subUsageAreas: updatedSubAreas,
    };

    setSubKmlModalParcel(updatedParcel);
    const updatedList = parcels.map((p) =>
      p.id === updatedParcel.id ? updatedParcel : p
    );
    onUpdateParcels(updatedList);
  };

  // Delete single sub-area
  const handleDeleteSubArea = (subAreaId: string) => {
    if (!subKmlModalParcel || !subKmlModalParcel.subUsageAreas) return;
    const updatedSubAreas = subKmlModalParcel.subUsageAreas.filter((s) => s.id !== subAreaId);
    const updatedParcel: Parcel = {
      ...subKmlModalParcel,
      subUsageAreas: updatedSubAreas,
    };
    setSubKmlModalParcel(updatedParcel);
    const updatedList = parcels.map((p) =>
      p.id === updatedParcel.id ? updatedParcel : p
    );
    onUpdateParcels(updatedList);
  };

  // Clear all sub-areas
  const handleClearAllSubAreas = () => {
    if (!subKmlModalParcel) return;
    if (confirm('Bu parsele ait tüm alt KML kullanım alanlarını kaldırmak istediğinize emin misiniz?')) {
      const updatedParcel: Parcel = {
        ...subKmlModalParcel,
        subUsageAreas: [],
      };
      setSubKmlModalParcel(updatedParcel);
      const updatedList = parcels.map((p) =>
        p.id === updatedParcel.id ? updatedParcel : p
      );
      onUpdateParcels(updatedList);
    }
  };

  // Assign Heir to Sub Usage Area
  const handleAssignHeirToSubArea = (subAreaId: string, heirId: string) => {
    if (!subKmlModalParcel || !subKmlModalParcel.subUsageAreas) return;

    const heir = heirs.find((h) => h.id === heirId);
    const updatedSubAreas = subKmlModalParcel.subUsageAreas.map((sub) => {
      if (sub.id === subAreaId) {
        return {
          ...sub,
          assignedHeirId: heirId || undefined,
          assignedHeirName: heir ? heir.adSoyad : undefined,
        };
      }
      return sub;
    });

    const updatedParcel: Parcel = {
      ...subKmlModalParcel,
      subUsageAreas: updatedSubAreas,
    };

    setSubKmlModalParcel(updatedParcel);
    const updatedList = parcels.map((p) =>
      p.id === updatedParcel.id ? updatedParcel : p
    );
    onUpdateParcels(updatedList);
  };

  // Validate and Complete Sub KML Modal
  const handleCompleteSubKmlModal = () => {
    if (!subKmlModalParcel) return;
    const subAreas = subKmlModalParcel.subUsageAreas || [];

    if (subAreas.length === 0) {
      setSubKmlModalParcel(null);
      return;
    }

    if (subAreas.length < 2) {
      alert(
        '⚠️ Kural Hatası: Parsel için fiili kullanımı göstermek için yüklenen KML dosyası / alanı en az 2 tane olmalıdır!\n\nLütfen ikinci kullanım alanını da yükleyin veya ekleyin.'
      );
      return;
    }

    const parcelArea = Number(subKmlModalParcel.alanM2) || 0;
    const totalSubArea = subAreas.reduce((sum, s) => sum + (Number(s.alanM2) || 0), 0);
    const diff = Math.round((totalSubArea - parcelArea) * 100) / 100;

    if (Math.abs(diff) > 1) {
      alert(
        `⚠️ Kural Hatası: KML dosyalarının alan toplamı (${formatArea(totalSubArea)}), parselin toplam büyüklüğüne (${formatArea(parcelArea)}) eşit olmalıdır!\n\nŞu anki fark: ${diff > 0 ? `+${formatArea(diff)} FAZLA` : `${formatArea(Math.abs(diff))} EKSİK`}.\n\nLütfen "Parsel Büyüklüğüne Eşitle (Orantıla)" butonuna tıklayarak alanları eşitleyin veya alanları elle düzeltin.`
      );
      return;
    }

    alert('Fiili kullanım alanları başarıyla doğrulandı ve kaydedildi!');
    setSubKmlModalParcel(null);
  };

  // Delete Parcel
  const handleDeleteParcel = (id: string) => {
    if (confirm('Bu parseli silmek istediğinizden emin misiniz?')) {
      const updated = parcels.filter((p) => p.id !== id);
      onUpdateParcels(updated);
      if (selectedParcelId === id) {
        setSelectedParcelId(updated[0]?.id);
      }
    }
  };

  // Add New Parcel & Automatically Open Edit Modal
  const handleAddManualParcel = () => {
    const newP: Parcel = {
      id: 'p_' + Math.random().toString(36).substring(2, 9),
      ada: '',
      parselNo: String(parcels.length + 1),
      mevkii: '',
      alanM2: 1000,
      nitelik: 'Tarla',
      birimFiyatTL: 1000,
      toplamDegerTL: 1000000,
      coordinates: [
        [39.925, 32.85],
        [39.928, 32.855],
        [39.924, 32.858],
        [39.921, 32.853],
      ],
      subUsageAreas: [],
    };
    onUpdateParcels([...parcels, newP]);
    setSelectedParcelId(newP.id);
    setEditingParcel(newP); // Automatically open edit modal!
  };

  // Save Edited Parcel
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParcel) return;

    const unitPrice = Number(editingParcel.birimFiyatTL) || 0;
    const area = Number(editingParcel.alanM2) || 0;
    const updated: Parcel = {
      ...editingParcel,
      birimFiyatTL: unitPrice,
      alanM2: area,
      toplamDegerTL: Math.round(unitPrice * area),
    };

    const updatedList = parcels.map((p) => (p.id === updated.id ? updated : p));
    onUpdateParcels(updatedList);
    setEditingParcel(null);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Parsel ve Harita Yönetimi
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Dosyadan KML yükleyerek kadastro parsellerinizi ekleyin ve müstakil ifrazı olmayan parseller için alt kullanım krokisi oluşturun.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden File Input for Master KML */}
          <input
            ref={masterKmlInputRef}
            type="file"
            accept=".kml,.xml"
            onChange={handleMasterKmlUpload}
            className="hidden"
          />

          <button
            onClick={() => masterKmlInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm whitespace-nowrap"
            title="Masaüstünden parsel sınırlarını içeren KML dosyasını seçin"
          >
            <Upload className="w-4 h-4" />
            Dosyadan KML Yükle
          </button>

          <button
            onClick={() => setShowTkgmModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition whitespace-nowrap"
            title="KML olmadan il/ilçe/mahalle/ada/parsel veya koordinat ile TKGM üzerinden parsel ekleyin"
          >
            <Search className="w-3.5 h-3.5" />
            TKGM&apos;den Parsel Sorgula
          </button>

          <button
            onClick={handleAddManualParcel}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            + Yeni Parsel Ekle
          </button>
        </div>
      </div>

      {/* Upload / TKGM Batch Bar */}
      {(uploadBannerMsg || parcels.length > 0) && (() => {
        const unmatchedCount = parcels.filter((p) => !p.tkgmSorguTarihi).length;
        const matchedCount = parcels.length - unmatchedCount;
        return (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1">
              {uploadBannerMsg ? (
                <div className="flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{uploadBannerMsg}</span>
                  <button
                    type="button"
                    onClick={() => setUploadBannerMsg(null)}
                    className="text-slate-400 hover:text-slate-600 ml-1"
                    title="Kapat"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="text-xs text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    TKGM Tapu ve Sınır Doğrulama
                  </span>
                  <span>·</span>
                  <span className="font-mono tabular-nums">
                    {matchedCount} / {parcels.length} parsel eşleştirildi
                  </span>
                </div>
              )}

              {batchState?.running && (
                <div className="flex items-center gap-2 text-[11px] text-blue-700 dark:text-blue-400 font-mono tabular-nums">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>
                    {batchState.current} / {batchState.total} parsel sorgulanıyor... ({batchState.successCount} başarılı
                    {batchState.failCount > 0 ? `, ${batchState.failCount} uyarı` : ''})
                  </span>
                </div>
              )}

              {!batchState?.running && batchState?.summaryMsg && (
                <div className="flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{batchState.summaryMsg}</span>
                  <button
                    type="button"
                    onClick={() => setBatchState(null)}
                    className="text-slate-400 hover:text-slate-600"
                    title="Kapat"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {parcels.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {batchState?.running ? (
                  <button
                    type="button"
                    onClick={() => {
                      batchCancelRef.current = true;
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                    Durdur
                  </button>
                ) : (
                  <>
                    {unmatchedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleBatchMatchTkgm(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
                        title="Henüz TKGM ile eşleştirilmemiş parselleri sırayla sorgular"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Eşleşmemişleri TKGM ile Eşleştir ({unmatchedCount})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleBatchMatchTkgm(false)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                      title="Listedeki tüm parsellerin tapu bilgilerini ve sınırlarını TKGM ile günceller"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Tümünü TKGM ile Eşleştir
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Interactive Map View */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-blue-600" />
            Coğrafi Kadastro ve Fiili Kullanım Haritası
          </div>
          <span className="text-[11px] text-slate-500">
            {parcels.length} Parsel Çizili · Google Hibrit & Esri Uydu
          </span>
        </div>

        <MapModule
          parcels={parcels}
          heirs={heirs}
          selectedParcelId={selectedParcelId}
          onSelectParcel={(id) => setSelectedParcelId(id)}
          heightClass="h-[420px]"
        />
      </div>

      {/* Parcels Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Taşınmaz Listesi ve Değerleme Matrisi ({parcels.length})
          </h2>
          <span className="text-xs text-slate-500">
            Toplam Portföy: <strong className="text-blue-600 font-mono tabular-nums">{formatCurrency(parcels.reduce((a, b) => a + (Number(b.toplamDegerTL) || 0), 0))}</strong>
          </span>
        </div>

        {parcels.length === 0 ? (
          <div className="p-8 text-center">
            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Henüz Parsel Kaydı Bulunmuyor
            </p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
              Yukarıdaki <strong>"Dosyadan KML Yükle"</strong> butonuna tıklayarak bilgisayarınızdaki KML dosyasını seçebilir veya manuel parsel ekleyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Ada / Parsel</th>
                  <th className="py-2.5 px-4">İl / İlçe / Mahalle</th>
                  <th className="py-2.5 px-4">Pafta / Mevkii</th>
                  <th className="py-2.5 px-4">Nitelik</th>
                  <th className="py-2.5 px-4 text-right">Yüzölçümü (m²)</th>
                  <th className="py-2.5 px-4 text-right">Birim Değer (TL/m²)</th>
                  <th className="py-2.5 px-4 text-right">Toplam Değer (TL)</th>
                  <th className="py-2.5 px-4 text-center">Fiili Kullanım</th>
                  <th className="py-2.5 px-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {parcels.map((parcel) => {
                  const isSelected = parcel.id === selectedParcelId;
                  const subCount = parcel.subUsageAreas?.length || 0;
                  const isMatching = Boolean(matchingParcelIds[parcel.id]);
                  const tkgmErr = parcelTkgmErrors[parcel.id];

                  const locationStr = [parcel.il, parcel.ilce, parcel.mahalle].filter(Boolean).join(' / ') || '-';
                  const paftaMevkiiStr = [parcel.pafta ? `P: ${parcel.pafta}` : '', parcel.mevkii].filter(Boolean).join(' · ') || '-';

                  return (
                    <tr
                      key={parcel.id}
                      onClick={() => setSelectedParcelId(parcel.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-50/80 dark:bg-blue-950/40'
                          : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <span>{parcel.ada} / {parcel.parselNo}</span>
                          {parcel.tkgmSorguTarihi && !tkgmErr && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-sans font-semibold text-emerald-600 dark:text-emerald-400"
                              title={`TKGM ile eşleştirildi (${new Date(parcel.tkgmSorguTarihi).toLocaleString('tr-TR')})`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              TKGM
                            </span>
                          )}
                          {tkgmErr && (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-sans font-medium text-red-600 dark:text-red-400"
                              title={tkgmErr}
                            >
                              <AlertCircle className="w-3 h-3" />
                              Hata
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300">
                        {locationStr}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 text-[11px]">
                        {paftaMevkiiStr}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 font-medium">
                        {parcel.nitelik}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        {formatArea(parcel.alanM2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {Number(parcel.birimFiyatTL).toLocaleString('tr-TR')} ₺
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-blue-700 dark:text-blue-400">
                        {formatCurrency(parcel.toplamDegerTL)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {subCount > 0 ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSubKmlModalParcel(parcel);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium hover:underline"
                            title="Alt kullanım sınırlarını düzenle"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {subCount} Bölüm
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSubKmlModalParcel(parcel);
                            }}
                            className="text-[11px] text-slate-600 hover:text-blue-600 font-medium"
                            title="Bu parsel içerisine fiili kullanım KML'i yükle"
                          >
                            + Alt KML Ekle
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMatchSingleParcelTkgm(parcel);
                          }}
                          disabled={isMatching || Boolean(batchState?.running)}
                          className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-50 transition"
                          title="TKGM ile Eşleştir (Tapu ve Sınır Güncelle)"
                        >
                          {isMatching ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTkgmMsg(null);
                            setEditingParcel(parcel);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 transition"
                          title="Parsel Bilgilerini Düzenle"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteParcel(parcel.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 transition"
                          title="Parseli Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Parcel Modal */}
      {editingParcel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Parsel Kadastro Bilgilerini Düzenle
                </h3>
                <p className="text-[11px] text-slate-500">
                  KML&apos;den otomatik tespit edilen, TKGM&apos;den çekilen veya elle girilen kayıtlar
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleMatchEditingParcelTkgm}
                  disabled={editingTkgmLoading}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 disabled:opacity-50 transition"
                  title="Parselin harita koordinatından TKGM tapu ve sınır verisini yenile"
                >
                  {editingTkgmLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  TKGM&apos;den Güncelle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingParcel(null);
                    setEditingTkgmMsg(null);
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {editingTkgmMsg && (
              <div
                className={`p-2.5 rounded-lg border text-[11px] flex items-start gap-2 ${
                  editingTkgmMsg.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                    : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300'
                }`}
              >
                {editingTkgmMsg.type === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600" />
                )}
                <span>{editingTkgmMsg.text}</span>
              </div>
            )}

            {/* İl / İlçe / Mahalle */}
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">İl</label>
                <input
                  type="text"
                  placeholder="Örn: Ankara"
                  value={editingParcel.il || ''}
                  onChange={(e) => setEditingParcel({ ...editingParcel, il: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">İlçe</label>
                <input
                  type="text"
                  placeholder="Örn: Çankaya"
                  value={editingParcel.ilce || ''}
                  onChange={(e) => setEditingParcel({ ...editingParcel, ilce: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Mahalle / Köy</label>
                <input
                  type="text"
                  placeholder="Örn: Beytepe"
                  value={editingParcel.mahalle || ''}
                  onChange={(e) => setEditingParcel({ ...editingParcel, mahalle: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
            </div>

            {/* Ada / Parsel / Pafta */}
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Ada No</label>
                <input
                  type="text"
                  placeholder="Örn: 124"
                  value={editingParcel.ada}
                  onChange={(e) => setEditingParcel({ ...editingParcel, ada: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Parsel No</label>
                <input
                  type="text"
                  placeholder="Örn: 15"
                  value={editingParcel.parselNo}
                  onChange={(e) => setEditingParcel({ ...editingParcel, parselNo: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Pafta No</label>
                <input
                  type="text"
                  placeholder="Örn: F29-D-12-C"
                  value={editingParcel.pafta || ''}
                  onChange={(e) => setEditingParcel({ ...editingParcel, pafta: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>
            </div>

            {/* Mevkii / Nitelik */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Mevkii</label>
                <input
                  type="text"
                  placeholder="Örn: Bağlaraltı / Köy İçi"
                  value={editingParcel.mevkii || ''}
                  onChange={(e) => setEditingParcel({ ...editingParcel, mevkii: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Nitelik / Cinsi</label>
                <input
                  type="text"
                  placeholder="Örn: Tarla, Bağ, Zeytinlik, Arsa"
                  value={editingParcel.nitelik}
                  onChange={(e) => setEditingParcel({ ...editingParcel, nitelik: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  required
                />
              </div>
            </div>

            {/* Yüzölçümü & Birim Değer */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Yüzölçümü (m²)</label>
                <input
                  type="number"
                  step="any"
                  value={editingParcel.alanM2}
                  onChange={(e) => setEditingParcel({ ...editingParcel, alanM2: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Birim Değer (TL/m²)</label>
                <input
                  type="number"
                  value={editingParcel.birimFiyatTL}
                  onChange={(e) => setEditingParcel({ ...editingParcel, birimFiyatTL: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
                  required
                />
              </div>
            </div>

            {/* Calculated Total Değer Banner */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg border border-blue-200 dark:border-blue-900 flex items-center justify-between text-xs">
              <span className="text-blue-900 dark:text-blue-300 font-medium">Hesaplanan Toplam Rayiç Değer:</span>
              <strong className="text-sm font-mono text-blue-700 dark:text-blue-400">
                {formatCurrency((Number(editingParcel.alanM2) || 0) * (Number(editingParcel.birimFiyatTL) || 0))}
              </strong>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingParcel(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                İptal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Değişiklikleri Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sub-KML Modal (Fiili Taksim & Kullanım Sınırları) */}
      {subKmlModalParcel && (() => {
        const subAreas = subKmlModalParcel.subUsageAreas || [];
        const parcelArea = Number(subKmlModalParcel.alanM2) || 0;
        const totalSubArea = Math.round(subAreas.reduce((sum, s) => sum + (Number(s.alanM2) || 0), 0) * 100) / 100;
        const diffArea = Math.round((totalSubArea - parcelArea) * 100) / 100;
        const isCountValid = subAreas.length >= 2;
        const isAreaEqual = Math.abs(diffArea) <= 1;
        const isReadyToComplete = subAreas.length === 0 || (isCountValid && isAreaEqual);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[92vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    Parsel İçi Fiili Kullanım Sınırları ve Alt KML
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ada {subKmlModalParcel.ada} / Parsel {subKmlModalParcel.parselNo} — Kadastro Yüzölçümü:{' '}
                    <strong className="text-blue-700 dark:text-blue-400 font-bold">{formatArea(parcelArea)}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setSubKmlModalParcel(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Hidden Input for Multi-file Sub KML */}
              <input
                ref={subKmlInputRef}
                type="file"
                accept=".kml,.xml"
                multiple
                onChange={handleSubKmlUpload}
                className="hidden"
              />

              {/* Information & Action Box */}
              <div className="bg-blue-50 dark:bg-blue-950/40 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900 text-xs text-blue-950 dark:text-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-blue-600" />
                    Fiili Taksim Kuralları (Müstakil ifrazı mümkün olmayan ortak parseller için):
                  </div>
                  <ul className="text-[11px] text-blue-900/80 dark:text-blue-300/80 list-disc list-inside space-y-0.5">
                    <li><strong>1. Kural:</strong> En az <strong>2 adet</strong> KML kullanım alanı yüklenmelidir (çoklu seçim yapabilirsiniz).</li>
                    <li><strong>2. Kural:</strong> Yüklenen KML alanlarının toplamı parselin kadastro alanına (<strong>{formatArea(parcelArea)}</strong>) eşit olmalıdır.</li>
                  </ul>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => subKmlInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm text-xs whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    + Alt KML Dosyaları Seç
                  </button>
                  {subAreas.length > 0 && (
                    <button
                      onClick={handleClearAllSubAreas}
                      className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-900 transition whitespace-nowrap"
                      title="Tüm alt kullanım bölümlerini siler"
                    >
                      Temizle
                    </button>
                  )}
                </div>
              </div>

              {/* Real-time Validation Status Panel (En az 2 alan + Alan Toplamı Eşitliği) */}
              {subAreas.length > 0 && (
                <div className="space-y-2 p-3.5 rounded-xl border bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5" />
                    Zorunlu Kural Doğrulama Durumu
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {/* Badge 1: Kural 1 (En az 2 KML alanı) */}
                    <div
                      className={`p-2.5 rounded-lg border flex items-center gap-2 text-xs ${
                        isCountValid
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {isCountValid ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      )}
                      <div>
                        <strong>1. Kural: Bölüm Sayısı</strong>
                        <div className="text-[11px]">
                          {isCountValid
                            ? `En az 2 alan kuralı sağlandı (${subAreas.length} Bölüm)`
                            : `Yetersiz! En az 2 alan yüklenmelidir (${subAreas.length}/2)`}
                        </div>
                      </div>
                    </div>

                    {/* Badge 2: Kural 2 (Alan Toplamı Eşitliği) */}
                    <div
                      className={`p-2.5 rounded-lg border flex flex-col justify-between gap-1.5 text-xs ${
                        isAreaEqual
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                          : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {isAreaEqual ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <strong>2. Kural: Alan Toplamı Eşitliği</strong>
                          <div className="text-[11px] font-mono">
                            KML Toplamı: <strong>{formatArea(totalSubArea)}</strong> / Parsel:{' '}
                            <strong>{formatArea(parcelArea)}</strong>
                          </div>
                          {!isAreaEqual && (
                            <div className="text-[11px] font-bold text-red-700 dark:text-red-300 mt-0.5">
                              Fark: {diffArea > 0 ? `+${formatArea(diffArea)} FAZLA` : `${formatArea(Math.abs(diffArea))} EKSİK`}
                            </div>
                          )}
                        </div>
                      </div>

                      {!isAreaEqual && (
                        <button
                          onClick={handleAutoProportionSubAreas}
                          className="mt-1 flex items-center justify-center gap-1.5 px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white font-semibold text-[11px] transition shadow-xs"
                          title="Alanları parsel büyüklüğüne göre orantılayarak tam eşitler"
                        >
                          <Sparkles className="w-3 h-3" />
                          Parsel Büyüklüğüne Eşitle (Orantıla)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sub Usage Areas List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 min-h-[160px] pr-1">
                {subAreas.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-500 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    Bu parsel için henüz alt KML yüklenmedi.<br />
                    Yukarıdaki <strong>"+ Alt KML Dosyaları Seç"</strong> butonuna basarak en az 2 adet KML dosyasını aynı anda seçebilirsiniz.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 px-1">
                      <span>Tanımlı Fiili Kullanım Bölümleri ({subAreas.length})</span>
                      <span className="text-[11px] font-mono text-slate-500">
                        Toplam: <strong className={isAreaEqual ? 'text-emerald-600' : 'text-red-600'}>{formatArea(totalSubArea)}</strong> / {formatArea(parcelArea)}
                      </span>
                    </div>

                    {subAreas.map((sub, idx) => {
                      const pct = parcelArea > 0 ? ((Number(sub.alanM2) || 0) / parcelArea) * 100 : 0;

                      return (
                        <div
                          key={sub.id}
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0 w-full md:w-auto">
                            <span
                              className="w-4 h-4 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: sub.color || '#3B82F6' }}
                            />
                            {/* Editable Name */}
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={sub.name}
                                onChange={(e) => handleUpdateSubArea(sub.id, { name: e.target.value })}
                                placeholder="Bölüm Adı"
                                className="w-full p-1 text-xs font-bold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                              />
                            </div>
                          </div>

                          {/* Editable Area (m²) and Percentage */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-slate-500 font-medium">Alan:</span>
                            <div className="relative">
                              <input
                                type="number"
                                step="0.01"
                                value={sub.alanM2}
                                onChange={(e) =>
                                  handleUpdateSubArea(sub.id, {
                                    alanM2: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-28 p-1 text-xs font-mono font-bold rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-right pr-6"
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-mono">
                                m²
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              %{pct.toFixed(1)}
                            </span>
                          </div>

                          {/* Heir Selector */}
                          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                            <span className="text-[11px] text-slate-500 shrink-0">Tahsis Edilen:</span>
                            <select
                              value={sub.assignedHeirId || ''}
                              onChange={(e) => handleAssignHeirToSubArea(sub.id, e.target.value)}
                              className="p-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex-1 md:w-44 font-medium"
                            >
                              <option value="">-- Tahsis Yapılmadı --</option>
                              {heirs.map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.adSoyad} ({h.hisseOrani})
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => handleDeleteSubArea(sub.id)}
                              className="p-1 text-slate-400 hover:text-red-600 transition"
                              title="Bu bölümü sil"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                {onNavigateToNotary && subAreas.length > 0 ? (
                  <button
                    onClick={() => {
                      if (!isReadyToComplete) {
                        alert('Lütfen önce 2 zorunlu kuralı sağlayınız: En az 2 bölüm olmalı ve alan toplamı parsel alanına eşit olmalıdır.');
                        return;
                      }
                      setSubKmlModalParcel(null);
                      onNavigateToNotary();
                    }}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Noter Fiili Taksim Sözleşmesini Gör
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSubKmlModalParcel(null)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleCompleteSubKmlModal}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg transition shadow-sm ${
                      isReadyToComplete
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Doğrula ve Tamamla
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Direct TKGM Lookup Modal */}
      <TkgmSearchModal
        isOpen={showTkgmModal}
        onClose={() => setShowTkgmModal(false)}
        onAddParcel={(newParcel) => {
          const nextList = [...parcelsRef.current, newParcel];
          parcelsRef.current = nextList;
          onUpdateParcels(nextList);
          setSelectedParcelId(newParcel.id);
          setUploadBannerMsg(
            `${newParcel.ada}/${newParcel.parselNo} parseli TKGM üzerinden portföye eklendi.`
          );
        }}
      />
    </div>
  );
};
