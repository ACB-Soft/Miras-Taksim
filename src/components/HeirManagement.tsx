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
  Network,
  Table as TableIcon,
  Plus,
  UserCheck,
  Settings,
  Shield,
  Layers,
} from 'lucide-react';

interface HeirManagementProps {
  heirs: Heir[];
  branches: HeirBranch[];
  parcels: Parcel[];
  rootOwnerName?: string;
  rootOwnerTitle?: string;
  generationNames?: Record<number, string>;
  onUpdateHeirs: (heirs: Heir[]) => void;
  onUpdateBranches: (branches: HeirBranch[]) => void;
  onUpdateRootOwner?: (name: string, title?: string) => void;
  onUpdateGenerationNames?: (names: Record<number, string>) => void;
}

export const HeirManagement: React.FC<HeirManagementProps> = ({
  heirs,
  branches,
  parcels,
  rootOwnerName = '1. Kuşak Mülk Sahibi',
  rootOwnerTitle = '1. Kuşak · Kök Malik',
  generationNames = {
    1: '1. Kuşak (İlk Mülk Sahibi)',
    2: '2. Kuşak (Veraset Kolları)',
    3: '3. Kuşak (Mirasçılar)',
    4: '4. Kuşak (Mirasçılar)',
  },
  onUpdateHeirs,
  onUpdateBranches,
  onUpdateRootOwner,
  onUpdateGenerationNames,
}) => {
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingHeir, setEditingHeir] = useState<Heir | null>(null);

  // Root Owner Edit Modal State
  const [isEditRootModalOpen, setIsEditRootModalOpen] = useState(false);
  const [rootFormName, setRootFormName] = useState(rootOwnerName);
  const [rootFormTitle, setRootFormTitle] = useState(rootOwnerTitle);

  // Generation Names Configuration Modal State
  const [isGenModalOpen, setIsGenModalOpen] = useState(false);
  const [genInputs, setGenInputs] = useState<Record<number, string>>({
    1: generationNames[1] || '1. Kuşak (İlk Mülk Sahibi)',
    2: generationNames[2] || '2. Kuşak (Veraset Kolları)',
    3: generationNames[3] || '3. Kuşak (Mirasçılar)',
    4: generationNames[4] || '4. Kuşak (Mirasçılar)',
    5: generationNames[5] || '5. Kuşak (Mirasçılar)',
  });

  // Branch Edit Modal State
  const [editingBranch, setEditingBranch] = useState<HeirBranch | null>(null);

  // Helper to get formatted generation label
  const getGenerationLabel = (kusak: number): string => {
    return generationNames[kusak] || `${kusak}. Kuşak`;
  };

  // New Heir Form State
  const [formData, setFormData] = useState<Partial<Heir>>({
    adSoyad: '',
    tcKimlik: '',
    telefon: '',
    kusak: 3,
    kokMurisKolId: branches[0]?.id || 'Kol-1',
    hisseOrani: '1/9',
  });

  // Calculate Fraction Statistics & Dynamic Entitlements
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
    return matchesSearch;
  });

  // Open add modal pre-selecting a specific branch
  const handleOpenAddForBranch = (branchId: string) => {
    setFormData({
      adSoyad: '',
      tcKimlik: '',
      telefon: '',
      kusak: 3,
      kokMurisKolId: branchId,
      hisseOrani: '1/9',
    });
    setIsAddModalOpen(true);
  };

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
      kokMurisKolId: formData.kokMurisKolId || branches[0]?.id || 'Kol-1',
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

  // Add a new branch (Veraset Kolu)
  const handleAddBranch = () => {
    const bNum = branches.length + 1;
    const newBranch: HeirBranch = {
      id: `Kol-${bNum}`,
      adSoyad: `${bNum}. Veraset Kolu`,
      kokHisseOrani: '1/3',
    };
    onUpdateBranches([...branches, newBranch]);
  };

  // Save Branch Edit
  const handleSaveBranchEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;

    const updated = branches.map((b) => (b.id === editingBranch.id ? editingBranch : b));
    onUpdateBranches(updated);
    setEditingBranch(null);
  };

  // Remove a branch if no heirs attached
  const handleDeleteBranch = (branchId: string) => {
    const heirsInBranch = heirs.filter((h) => h.kokMurisKolId === branchId);
    if (heirsInBranch.length > 0) {
      alert(`Bu kolda ${heirsInBranch.length} kayıtlı mirasçı bulunmaktadır. Önce mirasçıları silmeli veya başka kola taşımalısınız.`);
      return;
    }
    if (confirm('Bu veraset kolunu silmek istediğinizden emin misiniz?')) {
      onUpdateBranches(branches.filter((b) => b.id !== branchId));
    }
  };

  // Save Root Owner Info
  const handleSaveRootOwner = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateRootOwner) {
      onUpdateRootOwner(rootFormName.trim() || '1. Kuşak Mülk Sahibi', rootFormTitle.trim());
    }
    setIsEditRootModalOpen(false);
  };

  // Save Generation Names
  const handleSaveGenerationNames = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateGenerationNames) {
      onUpdateGenerationNames(genInputs);
    }
    setIsGenModalOpen(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Network className="w-5 h-5 text-blue-600" />
            Mirasçı Soyağacı ve Veraset Kütüğü
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            1. Kuşak mülk sahibinden sonraki kuşaklara intikal eden hisseleri soyağacı düzeninde inceleyin ve yönetin.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Generation Names Config Button */}
          <button
            onClick={() => {
              setGenInputs({
                1: generationNames[1] || '1. Kuşak (İlk Mülk Sahibi)',
                2: generationNames[2] || '2. Kuşak (Veraset Kolları)',
                3: generationNames[3] || '3. Kuşak (Mirasçılar)',
                4: generationNames[4] || '4. Kuşak (Mirasçılar)',
                5: generationNames[5] || '5. Kuşak (Mirasçılar)',
              });
              setIsGenModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
            title="Kuşaklara dilediğiniz özel isimleri verin"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            Kuşak İsimlerini Düzenle
          </button>

          {/* View Toggle */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('tree')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition ${
                viewMode === 'tree'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              Soyağacı
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Cetvel / Tablo
            </button>
          </div>

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

      {/* Search Bar & Branch Action */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Mirasçı adı veya T.C. Kimlik ile filtrele..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
          />
        </div>

        <button
          onClick={handleAddBranch}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition whitespace-nowrap"
        >
          <GitBranch className="w-3.5 h-3.5 text-blue-600" />
          + Yeni Veraset Kolu Ekle
        </button>
      </div>

      {/* VIEW 1: SOYAĞACI (FAMILY TREE) VIEW */}
      {viewMode === 'tree' && (
        <div className="bg-slate-50/50 dark:bg-slate-900/40 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-8 overflow-x-auto">
          {/* ROOT LEVEL: 1. KUŞAK İLK MÜLK SAHİBİ */}
          <div className="flex flex-col items-center">
            <div className="relative z-10 bg-gradient-to-b from-blue-900 to-indigo-950 text-white px-6 py-4 rounded-2xl shadow-lg border border-blue-800 text-center max-w-md w-full group">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 block text-left">
                  {rootOwnerTitle || getGenerationLabel(1)}
                </span>
                <button
                  onClick={() => {
                    setRootFormName(rootOwnerName);
                    setRootFormTitle(rootOwnerTitle);
                    setIsEditRootModalOpen(true);
                  }}
                  className="p-1 text-blue-300 hover:text-white rounded hover:bg-blue-800/60 transition"
                  title="1. Kuşak İlk Mülk Sahibi Bilgilerini Düzenle"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>

              <h2 className="text-base font-extrabold tracking-tight mt-0.5">
                {rootOwnerName}
              </h2>

              <div className="mt-2 pt-2 border-t border-blue-800/80 flex items-center justify-around text-xs font-mono">
                <div>
                  <span className="text-[10px] text-blue-300 block">Toplam Tereke</span>
                  <strong>{formatCurrency(totalPortfolioTL)}</strong>
                </div>
                <div className="w-px h-6 bg-blue-800" />
                <div>
                  <span className="text-[10px] text-blue-300 block">Toplam Malik</span>
                  <strong>{heirs.length} Mirasçı</strong>
                </div>
                <div className="w-px h-6 bg-blue-800" />
                <div>
                  <span className="text-[10px] text-blue-300 block">Kök Hissesi</span>
                  <strong>1/1 (Tam)</strong>
                </div>
              </div>
            </div>

            {/* Vertical connector from Root */}
            <div className="w-0.5 h-8 bg-blue-300 dark:bg-blue-700" />
          </div>

          {/* LEVEL 2: 2. KUŞAK VERASET KOLLARI VE ONLARA BAĞLI MİRASÇILAR */}
          <div className="relative">
            {/* Horizontal distributor bar across branches */}
            {branches.length > 1 && (
              <div className="hidden lg:block absolute top-0 left-12 right-12 h-0.5 bg-blue-200 dark:bg-blue-800 -mt-0.5" />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {branches.map((branch, bIdx) => {
                const branchHeirs = filteredHeirs.filter(
                  (h) => h.kokMurisKolId === branch.id
                );
                const branchTotalTL = branchHeirs.reduce(
                  (acc, h) => acc + (h.hakEdilenTL || 0),
                  0
                );

                return (
                  <div
                    key={branch.id}
                    className="flex flex-col items-center space-y-4"
                  >
                    {/* Branch Header Card (2. Kuşak Veraset Kolu) */}
                    <div className="w-full bg-white dark:bg-slate-900 rounded-xl p-4 border border-blue-200 dark:border-blue-900 shadow-sm text-center relative group">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                          {getGenerationLabel(2)} · Kol {bIdx + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingBranch(branch)}
                            className="p-1 text-slate-400 hover:text-blue-600 transition"
                            title="Bu veraset kolunun adını ve hissesini düzenle"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          {branchHeirs.length === 0 && (
                            <button
                              onClick={() => handleDeleteBranch(branch.id)}
                              className="text-slate-400 hover:text-red-500 p-1 transition"
                              title="Bu boş veraset kolunu sil"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {branch.adSoyad}
                      </h3>

                      <div className="mt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center justify-around bg-slate-50 dark:bg-slate-800/60 py-1.5 rounded-lg">
                        <span>{branchHeirs.length} Mirasçı</span>
                        <span>·</span>
                        <span className="font-bold text-blue-700 dark:text-blue-300">
                          {formatCurrency(branchTotalTL)}
                        </span>
                      </div>

                      {/* Add heir to this branch button */}
                      <button
                        onClick={() => handleOpenAddForBranch(branch.id)}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-semibold transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Bu Kola Mirasçı Ekle
                      </button>
                    </div>

                    {/* Connector line down to heirs */}
                    <div className="w-0.5 h-4 bg-slate-300 dark:bg-slate-700" />

                    {/* Heirs Cards under this branch */}
                    <div className="w-full space-y-3">
                      {branchHeirs.length === 0 ? (
                        <div className="p-4 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                          Bu kolda henüz mirasçı bulunmuyor.
                        </div>
                      ) : (
                        branchHeirs.map((heir) => (
                          <div
                            key={heir.id}
                            className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition relative"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="inline-block text-[10px] font-semibold text-slate-500 uppercase">
                                  {getGenerationLabel(heir.kusak)}
                                </span>
                                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                  {heir.adSoyad}
                                </h4>
                                {heir.tcKimlik && (
                                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                    T.C.: {heir.tcKimlik}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
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
                              </div>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
                              <div>
                                <span className="text-[10px] text-slate-400 block font-sans">
                                  Hisse Oranı
                                </span>
                                <span className="font-bold text-blue-700 dark:text-blue-400">
                                  {heir.hisseOrani}
                                </span>
                              </div>

                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 block font-sans">
                                  Hak Ediş Tutarı
                                </span>
                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                  {formatCurrency(heir.hakEdilenTL || 0)}
                                </span>
                              </div>
                            </div>

                            <div className="mt-1 text-[10px] text-slate-500 font-mono text-right">
                              Eşdeğer Alan: {formatArea(heir.hakEdilenM2 || 0)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: TABULAR / CETVEL VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Mirasçı Kütüğü ve Hak Ediş Cetveli ({filteredHeirs.length})
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
                    <th className="py-2.5 px-4">Veraset Kolu</th>
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
                          {getGenerationLabel(heir.kusak)}
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
      )}

      {/* Modal 1: 1. Kuşak İlk Mülk Sahibi Düzenleme Modalı */}
      {isEditRootModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSaveRootOwner}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600" />
                1. Kuşak Mülk Sahibi Bilgileri
              </h3>
              <button
                type="button"
                onClick={() => setIsEditRootModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                1. Kuşak Mülk Sahibi Adı
              </label>
              <input
                type="text"
                placeholder="Örn: Ahmet Yılmaz, İlk Mülk Sahibi"
                value={rootFormName}
                onChange={(e) => setRootFormName(e.target.value)}
                className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold"
                required
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                Soyağacının tepesinde yer alacak 1. kuşak mülk sahibinin ismi.
              </span>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Kuşak Başlığı / Etiketi
              </label>
              <input
                type="text"
                placeholder="Örn: 1. Kuşak · Kök Malik"
                value={rootFormTitle}
                onChange={(e) => setRootFormTitle(e.target.value)}
                className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditRootModalOpen(false)}
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

      {/* Modal 2: Kuşak İsimlerini Düzenleme Modalı */}
      {isGenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSaveGenerationNames}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Kuşak İsimlerini Özelleştir
              </h3>
              <button
                type="button"
                onClick={() => setIsGenModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Her kuşağa özel bir isim veya tanım belirleyebilirsiniz. Tanımladığınız isimler soyağacı, tablolar ve formlarda otomatik görünecektir.
            </p>

            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((kNum) => (
                <div key={kNum} className="flex items-center gap-3">
                  <span className="w-20 text-xs font-bold text-slate-700 dark:text-slate-300">
                    {kNum}. Kuşak:
                  </span>
                  <input
                    type="text"
                    value={genInputs[kNum] || ''}
                    placeholder={`${kNum}. Kuşak`}
                    onChange={(e) =>
                      setGenInputs({
                        ...genInputs,
                        [kNum]: e.target.value,
                      })
                    }
                    className="flex-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsGenModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
              >
                İptal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Kuşak İsimlerini Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal 3: Veraset Kolu Düzenleme Modalı */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleSaveBranchEdit}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Veraset Kolunu Düzenle
              </h3>
              <button
                type="button"
                onClick={() => setEditingBranch(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Veraset Kolu Adı
              </label>
              <input
                type="text"
                placeholder="Örn: 1. Veraset Kolu, Ahmet Kolu"
                value={editingBranch.adSoyad}
                onChange={(e) =>
                  setEditingBranch({ ...editingBranch, adSoyad: e.target.value })
                }
                className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                required
              />
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingBranch(null)}
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

      {/* Modal 4: Yeni Mirasçı Ekle Modalı */}
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
                  <option value={2}>{getGenerationLabel(2)}</option>
                  <option value={3}>{getGenerationLabel(3)}</option>
                  <option value={4}>{getGenerationLabel(4)}</option>
                  <option value={5}>{getGenerationLabel(5)}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Veraset Kolu
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
                  placeholder="Örn: 1/9, 3/72, 1/12, 1/3, 2/3"
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

      {/* Modal 5: Mirasçı Bilgilerini Düzenle Modalı */}
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
                  <option value={2}>{getGenerationLabel(2)}</option>
                  <option value={3}>{getGenerationLabel(3)}</option>
                  <option value={4}>{getGenerationLabel(4)}</option>
                  <option value={5}>{getGenerationLabel(5)}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Veraset Kolu
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
