import React, { useRef, useState } from 'react';
import { Parcel, Heir, SubUsageArea } from '../types';
import { parseKMLToParcels, parseKMLToSubUsageAreas } from '../utils/kmlParser';
import { formatCurrency, formatArea } from '../utils/fractionEngine';
import { MapModule } from './MapModule';
import {
  Upload,
  Plus,
  Trash2,
  Edit2,
  Layers,
  FileText,
  CheckCircle,
  X,
  Compass,
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

  // Master KML Upload Handler
  const handleMasterKmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseKMLToParcels(text, file.name);

      if (parsed.length === 0) {
        alert('KML dosyasında geçerli parsel poligonu bulunamadı. Lütfen geçerli bir KML dosyası seçiniz.');
        return;
      }

      const updated = [...parcels, ...parsed];
      onUpdateParcels(updated);
      setSelectedParcelId(parsed[0].id);
      alert(`${parsed.length} adet taşınmaz parseli başarıyla yüklendi!`);
    } catch (err: any) {
      alert('KML okuma hatası: ' + err.message);
    } finally {
      if (masterKmlInputRef.current) masterKmlInputRef.current.value = '';
    }
  };

  // Sub KML Upload Handler (For In-Parcel Fiili Taksim)
  const handleSubKmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !subKmlModalParcel) return;

    try {
      const text = await file.text();
      const subAreas = parseKMLToSubUsageAreas(text);

      if (subAreas.length === 0) {
        alert('Alt KML dosyasında poligon alanı tespit edilemedi.');
        return;
      }

      // Attach to modal parcel
      const updatedParcel: Parcel = {
        ...subKmlModalParcel,
        subUsageAreas: subAreas,
      };

      setSubKmlModalParcel(updatedParcel);

      // Update in main parcels list
      const updatedList = parcels.map((p) =>
        p.id === updatedParcel.id ? updatedParcel : p
      );
      onUpdateParcels(updatedList);
      alert(`${subAreas.length} adet fiili alt kullanım bölümü tanımlandı! Şimdi her bölüm için hak sahibi mirasçıyı seçebilirsiniz.`);
    } catch (err: any) {
      alert('Alt KML okuma hatası: ' + err.message);
    } finally {
      if (subKmlInputRef.current) subKmlInputRef.current.value = '';
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

        <div className="flex items-center gap-2">
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
            onClick={handleAddManualParcel}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            + Yeni Parsel Ekle
          </button>
        </div>
      </div>

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
                        {parcel.ada} / {parcel.parselNo}
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
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Parsel Kadastro Bilgilerini Düzenle
                </h3>
                <p className="text-[11px] text-slate-500">
                  KML'den otomatik tespit edilen veya elle girilen kadastro kayıtları
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingParcel(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

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
      {subKmlModalParcel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Parsel İçi Fiili Kullanım Sınırları ve Alt KML
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ada {subKmlModalParcel.ada} / Parsel {subKmlModalParcel.parselNo} ({formatArea(subKmlModalParcel.alanM2)})
                </p>
              </div>
              <button
                onClick={() => setSubKmlModalParcel(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Hidden Input for Sub KML */}
            <input
              ref={subKmlInputRef}
              type="file"
              accept=".kml,.xml"
              onChange={handleSubKmlUpload}
              className="hidden"
            />

            <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-lg border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 flex items-start justify-between gap-4">
              <div>
                <strong>Müstakil ifrazı mümkün olmayan ortak parseller için:</strong><br />
                Bu parsel içerisindeki bölünmüş kullanım sınırlarını içeren alt KML dosyasını yükleyin. Her bir kullanım bölgesini bir mirasçıya tahsis ederek noter onayına hazır <em>"Fiili Taksim ve Kullanım Sözleşmesi"</em> oluşturabilirsiniz.
              </div>
              <button
                onClick={() => subKmlInputRef.current?.click()}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 transition"
              >
                <Upload className="w-3.5 h-3.5" />
                Alt KML Seç
              </button>
            </div>

            {/* Sub Usage Areas List */}
            <div className="flex-1 overflow-y-auto space-y-3 min-h-[160px]">
              {(!subKmlModalParcel.subUsageAreas || subKmlModalParcel.subUsageAreas.length === 0) ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  Bu parsel için henüz alt KML yüklenmedi.<br />
                  Yukarıdaki <strong>"Alt KML Seç"</strong> butonunu kullanarak parsel içi poligonları ekleyebilirsiniz.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tanımlı Fiili Kullanım Bölümleri ({subKmlModalParcel.subUsageAreas.length})
                  </div>
                  {subKmlModalParcel.subUsageAreas.map((sub, idx) => (
                    <div
                      key={sub.id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: sub.color || '#3B82F6' }}
                        />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {sub.name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Yüzölçümü: {formatArea(sub.alanM2)}
                          </div>
                        </div>
                      </div>

                      {/* Heir Selector */}
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-[11px] text-slate-500 shrink-0">Tahsis Edilen:</span>
                        <select
                          value={sub.assignedHeirId || ''}
                          onChange={(e) => handleAssignHeirToSubArea(sub.id, e.target.value)}
                          className="p-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex-1 sm:w-48"
                        >
                          <option value="">-- Henüz Tahsis Edilmedi --</option>
                          {heirs.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.adSoyad} ({h.hisseOrani})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              {onNavigateToNotary && subKmlModalParcel.subUsageAreas && subKmlModalParcel.subUsageAreas.length > 0 ? (
                <button
                  onClick={() => {
                    setSubKmlModalParcel(null);
                    onNavigateToNotary();
                  }}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Noter Fiili Taksim Sözleşmesini Gör
                </button>
              ) : <div />}

              <button
                onClick={() => setSubKmlModalParcel(null)}
                className="px-4 py-1.5 text-xs font-semibold rounded bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90"
              >
                Tamamla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
