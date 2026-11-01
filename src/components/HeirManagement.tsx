import React, { useState } from 'react';
import { Heir, HeirBranch, Parcel } from '../types';
import {
  calculateTotalShares,
  computeHeirEntitlements,
  formatCurrency,
  formatArea,
} from '../utils/fractionEngine';
import {
  Users,
  UserPlus,
  Trash2,
  Edit3,
  Search,
  AlertTriangle,
  CheckCircle2,
  X,
  GitBranch,
} from 'lucide-react';

interface HeirManagementProps {
  heirs: Heir[];
  branches: HeirBranch[];
  parcels: Parcel[];
  onUpdateHeirs: (heirs: Heir[]) => void;
  onUpdateBranches: (branches: HeirBranch[]) => void;
}

export const HeirManagement: React.FC<HeirManagementProps> = ({
  heirs,
  branches,
  parcels,
  onUpdateHeirs,
  onUpdateBranches,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHeir, setEditingHeir] = useState<Heir | null>(null);

  // New Heir Form State
  const [formData, setFormData] = useState<Partial<Heir>>({
    adSoyad: '',
    tcKimlik: '',
    telefon: '',
    kusak: 3,
    kokMurisKolId: branches[0]?.id || 'Kol-1',
    hisseOrani: '1/9',
  });

  // Calculate Fraction Statistics
  const shareStats = calculateTotalShares(heirs);
  const { totalPortfolioTL, totalPortfolioM2, updatedHeirs } = computeHeirEntitlements(
    heirs,
    parcels
  );

  // Filtered Heirs
  const filteredHeirs = updatedHeirs.filter((h) => {
    const matchesSearch =
      h.adSoyad.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (h.tcKimlik && h.tcKimlik.includes(searchQuery));
    const matchesBranch =
      selectedBranchFilter === 'ALL' || h.kokMurisKolId === selectedBranchFilter;
    return matchesSearch && matchesBranch;
  });

  // Save New Heir
  const handleCreateHeir = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.adSoyad || !formData.hisseOrani) return;

    const newHeir: Heir = {
      id: 'h_' + Math.random().toString(36).substring(2, 9),
      adSoyad: formData.adSoyad.trim(),
      tcKimlik: formData.tcKimlik?.trim() || '',
      telefon: formData.telefon?.trim() || '',
      kusak: Number(formData.kusak) || 3,
      kokMurisKolId: formData.kokMurisKolId || 'Kol-1',
      hisseOrani: formData.hisseOrani.trim(),
    };

    onUpdateHeirs([...heirs, newHeir]);
    setIsAddModalOpen(false);
    setFormData({
      adSoyad: '',
      tcKimlik: '',
      telefon: '',
      kusak: 3,
      kokMurisKolId: branches[0]?.id || 'Kol-1',
      hisseOrani: '1/9',
    });
  };

  // Save Edit Heir
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHeir) return;

    const updated = heirs.map((h) => (h.id === editingHeir.id ? editingHeir : h));
    onUpdateHeirs(updated);
    setEditingHeir(null);
  };

  // Delete Heir
  const handleDeleteHeir = (id: string) => {
    if (confirm('Bu mirasçıyı silmek istediğinizden emin misiniz?')) {
      onUpdateHeirs(heirs.filter((h) => h.id !== id));
    }
  };

  // Add Branch
  const handleAddBranch = () => {
    const bNum = branches.length + 1;
    const newBranch: HeirBranch = {
      id: `Kol-${bNum}`,
      adSoyad: `${bNum}. Kardeş Kolu`,
      kokHisseOrani: '1/3',
    };
    onUpdateBranches([...branches, newBranch]);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Veraset ve Mirasçı Kütüğü
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Sınırsız sayıda mirasçı ekleyebilir, kök kollarını belirleyebilir ve fraction.js ile sıfır yuvarlama hatasıyla hisseleri doğrulayabilirsiniz.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            Yeni Mirasçı Ekle
          </button>
        </div>
      </div>

      {/* Fraction Status Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs ${
          shareStats.isComplete
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
        }`}
      >
        <div className="flex items-start gap-2.5">
          {shareStats.isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-bold text-sm">
              {shareStats.isComplete
                ? 'Hisse Dağılımı Tam ve Doğrulanmış (1/1 = %100)'
                : `Hisse Toplamı: ${shareStats.totalString} (%${shareStats.percentage})`}
            </div>
            <div className="text-[11px] mt-0.5 opacity-90">
              {shareStats.isComplete
                ? 'Tüm mirasçıların rasyonel hisse toplamı tam 1/1 (bütün) etmekte, matematiksel yuvarlama hatası bulunmamaktadır.'
                : `Hisse toplamı 1 tam etmemektedir. Kalan/Fark: ${shareStats.differenceFraction.toFraction(true)}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0 font-mono text-xs">
          <div>
            <span className="text-[10px] block opacity-75 uppercase">Toplam Malik</span>
            <strong className="text-base">{heirs.length} Kişi</strong>
          </div>
          <div>
            <span className="text-[10px] block opacity-75 uppercase">Toplam Portföy</span>
            <strong className="text-base">{formatCurrency(totalPortfolioTL)}</strong>
          </div>
        </div>
      </div>

      {/* Branches List */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
            <GitBranch className="w-4 h-4 text-blue-600" />
            2. Kuşak Kök Muris Kolları (Kardeşler)
          </div>
          <button
            onClick={handleAddBranch}
            className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
          >
            + Yeni Kök Kol Ekle
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {branches.map((b) => {
            const count = heirs.filter((h) => h.kokMurisKolId === b.id).length;
            return (
              <div
                key={b.id}
                className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {b.adSoyad}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    Kök Hisse: {b.kokHisseOrani} · {count} Mirasçı
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="İsim veya T.C. ile ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-[11px] text-slate-500 shrink-0">Kök Kol Filtresi:</span>
          <select
            value={selectedBranchFilter}
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
            className="p-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full sm:w-44"
          >
            <option value="ALL">Tüm Kollar</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.adSoyad}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Heirs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Mirasçı Listesi ve Hak Ediş Cetveli ({filteredHeirs.length})
          </h2>
        </div>

        {filteredHeirs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            {heirs.length === 0
              ? 'Henüz mirasçı kaydı bulunmuyor. "Yeni Mirasçı Ekle" butonunu kullanarak ekleyebilirsiniz.'
              : 'Arama kriterlerine uygun mirasçı bulunamadı.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Adı Soyadı</th>
                  <th className="py-2.5 px-4">T.C. Kimlik</th>
                  <th className="py-2.5 px-4">Kuşak</th>
                  <th className="py-2.5 px-4">Kök Kol</th>
                  <th className="py-2.5 px-4 text-center font-mono">Hisse Oranı</th>
                  <th className="py-2.5 px-4 text-right font-mono">Eşdeğer Alan (m²)</th>
                  <th className="py-2.5 px-4 text-right font-mono">Hak Edilen Değer (TL)</th>
                  <th className="py-2.5 px-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredHeirs.map((heir) => {
                  const branch = branches.find((b) => b.id === heir.kokMurisKolId);

                  return (
                    <tr
                      key={heir.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                        {heir.adSoyad}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                        {heir.tcKimlik || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                        {heir.kusak}. Kuşak
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                        {branch ? branch.adSoyad : heir.kokMurisKolId}
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-blue-700 dark:text-blue-400">
                        {heir.hisseOrani}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {formatArea(heir.hakEdilenM2 || 0)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(heir.hakEdilenTL || 0)}
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => setEditingHeir(heir)}
                          className="p-1 text-slate-400 hover:text-blue-600 transition"
                          title="Düzenle"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteHeir(heir.id)}
                          className="p-1 text-slate-400 hover:text-red-600 transition"
                          title="Sil"
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

      {/* Add Heir Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleCreateHeir}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Yeni Mirasçı Ekle
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Adı Soyadı
              </label>
              <input
                type="text"
                placeholder="Örn: Ahmet Yılmaz"
                value={formData.adSoyad}
                onChange={(e) => setFormData({ ...formData, adSoyad: e.target.value })}
                className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  T.C. Kimlik No
                </label>
                <input
                  type="text"
                  maxLength={11}
                  placeholder="11 haneli T.C."
                  value={formData.tcKimlik}
                  onChange={(e) => setFormData({ ...formData, tcKimlik: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Kuşak
                </label>
                <select
                  value={formData.kusak}
                  onChange={(e) => setFormData({ ...formData, kusak: Number(e.target.value) })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value={2}>2. Kuşak (Kardeş)</option>
                  <option value={3}>3. Kuşak (Çocuk / Torun)</option>
                  <option value={4}>4. Kuşak (Torun Çocuğu)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Kök Muris Kolu
                </label>
                <select
                  value={formData.kokMurisKolId}
                  onChange={(e) => setFormData({ ...formData, kokMurisKolId: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.adSoyad}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Hisse Oranı (Kesir)
                </label>
                <input
                  type="text"
                  placeholder="Örn: 1/9, 3/72, 1/12"
                  value={formData.hisseOrani}
                  onChange={(e) => setFormData({ ...formData, hisseOrani: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
                  required
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                İptal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Mirasçıyı Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Heir Modal */}
      {editingHeir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Mirasçı Bilgilerini Düzenle
              </h3>
              <button
                type="button"
                onClick={() => setEditingHeir(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Adı Soyadı
              </label>
              <input
                type="text"
                value={editingHeir.adSoyad}
                onChange={(e) => setEditingHeir({ ...editingHeir, adSoyad: e.target.value })}
                className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  T.C. Kimlik No
                </label>
                <input
                  type="text"
                  maxLength={11}
                  value={editingHeir.tcKimlik || ''}
                  onChange={(e) => setEditingHeir({ ...editingHeir, tcKimlik: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Kuşak
                </label>
                <select
                  value={editingHeir.kusak}
                  onChange={(e) => setEditingHeir({ ...editingHeir, kusak: Number(e.target.value) })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value={2}>2. Kuşak (Kardeş)</option>
                  <option value={3}>3. Kuşak (Çocuk / Torun)</option>
                  <option value={4}>4. Kuşak (Torun Çocuğu)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Kök Muris Kolu
                </label>
                <select
                  value={editingHeir.kokMurisKolId}
                  onChange={(e) => setEditingHeir({ ...editingHeir, kokMurisKolId: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.adSoyad}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Hisse Oranı (Kesir)
                </label>
                <input
                  type="text"
                  value={editingHeir.hisseOrani}
                  onChange={(e) => setEditingHeir({ ...editingHeir, hisseOrani: e.target.value })}
                  className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold"
                  required
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingHeir(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                İptal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Kaydet
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
