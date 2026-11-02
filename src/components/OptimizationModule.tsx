import React, { useState, useMemo } from 'react';
import { Parcel, Heir, HeirBranch, TaksimScenario, ProjectState } from '../types';
import {
  runTaksimOptimization,
  calculateScenarioBalancesAndIvaz,
  assignParcelToHeir,
  assignParcelToBranch,
} from '../utils/binPacking';
import { formatCurrency, formatArea, parseFraction } from '../utils/fractionEngine';
import {
  Scale,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Users2,
  Home,
  RefreshCw,
  AlertCircle,
  Search,
  RotateCcw,
  UserCheck,
  Building2,
  Layers,
  ArrowRightLeft,
  Sliders,
} from 'lucide-react';
import { generateLocalTaksimReport } from '../utils/aiReportFallback';

interface OptimizationModuleProps {
  project: ProjectState;
  onUpdateScenarios: (
    scenarios: {
      pure_independent?: TaksimScenario;
      sibling_consolidation?: TaksimScenario;
    },
    activeMode: 'pure_independent' | 'sibling_consolidation'
  ) => void;
  onNavigateToEqualization: () => void;
}

export const OptimizationModule: React.FC<OptimizationModuleProps> = ({
  project,
  onUpdateScenarios,
  onNavigateToEqualization,
}) => {
  const { parcels, heirs, branches, scenarios, selectedScenarioMode } = project;

  const [activeTab, setActiveTab] = useState<'pure_independent' | 'sibling_consolidation'>(
    selectedScenarioMode || 'pure_independent'
  );
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const pureScenario = scenarios.pure_independent;
  const siblingScenario = scenarios.sibling_consolidation;
  const currentScenario = activeTab === 'pure_independent' ? pureScenario : siblingScenario;

  // Ensure branches list is populated (fallback to unique kokMurisKolId in heirs)
  const availableBranches: HeirBranch[] = useMemo(() => {
    if (branches && branches.length > 0) return branches;
    const uniqueBranchIds = Array.from(new Set(heirs.map((h) => h.kokMurisKolId || '1. Veraset Kolu')));
    return uniqueBranchIds.map((bId) => ({
      id: bId,
      adSoyad: bId,
      kokHisseOrani: '',
    }));
  }, [branches, heirs]);

  // Run or Reset Optimization for both scenarios
  const handleRunOptimization = () => {
    if (parcels.length === 0 || heirs.length === 0) {
      alert('Optimizasyon yapabilmek için en az 1 parsel ve 1 mirasçı girilmelidir.');
      return;
    }

    const newPure = runTaksimOptimization(parcels, heirs, 'pure_independent');
    const newSibling = runTaksimOptimization(parcels, heirs, 'sibling_consolidation');

    onUpdateScenarios(
      {
        pure_independent: newPure,
        sibling_consolidation: newSibling,
      },
      activeTab
    );
  };

  // Reset active scenario to recommended automated distribution
  const handleResetActiveToRecommended = () => {
    if (parcels.length === 0 || heirs.length === 0) return;
    const recommended = runTaksimOptimization(parcels, heirs, activeTab);
    onUpdateScenarios(
      {
        ...scenarios,
        [activeTab]: recommended,
      },
      activeTab
    );
  };

  // Clear all parcel assignments in the current scenario
  const handleClearAssignments = () => {
    if (parcels.length === 0 || heirs.length === 0) return;
    const emptyScenario = calculateScenarioBalancesAndIvaz(
      parcels,
      heirs,
      activeTab,
      {},
      {},
      {},
      currentScenario
    );
    onUpdateScenarios(
      {
        ...scenarios,
        [activeTab]: emptyScenario,
      },
      activeTab
    );
  };

  // User decides which HEIR receives a parcel in Tam Müstakil Taksim
  const handleAssignParcelToHeir = (parcelId: string, heirId: string) => {
    const baseScenario =
      currentScenario ||
      calculateScenarioBalancesAndIvaz(parcels, heirs, 'pure_independent', {}, {}, {});

    const updatedAssignments = assignParcelToHeir(
      parcelId,
      heirId || null,
      baseScenario.assignments || {},
      heirs
    );

    const updatedScenario = calculateScenarioBalancesAndIvaz(
      parcels,
      heirs,
      'pure_independent',
      updatedAssignments,
      {},
      {},
      baseScenario
    );

    onUpdateScenarios(
      {
        ...scenarios,
        pure_independent: updatedScenario,
      },
      'pure_independent'
    );
  };

  // User decides which VERASEt KOLU (Branch) receives a parcel in Veraset Kolu Ortaklı Taksim
  const handleAssignParcelToBranch = (parcelId: string, branchId: string) => {
    const baseScenario =
      currentScenario ||
      calculateScenarioBalancesAndIvaz(parcels, heirs, 'sibling_consolidation', {}, {}, {});

    const { assignments, jointParcels, branchAssignments } = assignParcelToBranch(
      parcelId,
      branchId || null,
      heirs,
      baseScenario.assignments || {},
      baseScenario.jointParcels || {},
      baseScenario.branchAssignments || {}
    );

    const updatedScenario = calculateScenarioBalancesAndIvaz(
      parcels,
      heirs,
      'sibling_consolidation',
      assignments,
      jointParcels,
      branchAssignments,
      baseScenario
    );

    onUpdateScenarios(
      {
        ...scenarios,
        sibling_consolidation: updatedScenario,
      },
      'sibling_consolidation'
    );
  };

  // Trigger Gemini AI Justification (with static GitHub Pages fallback)
  const handleFetchAiJustification = async () => {
    if (!currentScenario) {
      alert('Lütfen önce taksim hesaplamasını çalıştırın.');
      return;
    }

    setIsAiLoading(true);
    setAiError(null);

    try {
      const response = await fetch('/api/gemini/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcels,
          heirs,
          scenarioMode: activeTab,
          assignments: currentScenario.assignments,
          equalizationData: currentScenario.equalizationItems,
        }),
      });

      let reportText = '';
      if (response.ok) {
        const data = await response.json();
        reportText = data.report;
      } else {
        // Fallback for GitHub Pages static hosting where /api is not running
        reportText = generateLocalTaksimReport(parcels, heirs, currentScenario);
      }

      const updatedScenario: TaksimScenario = {
        ...currentScenario,
        aiJustification: reportText,
      };

      onUpdateScenarios(
        {
          ...scenarios,
          [activeTab]: updatedScenario,
        },
        activeTab
      );
    } catch {
      const reportText = generateLocalTaksimReport(parcels, heirs, currentScenario);
      const updatedScenario: TaksimScenario = {
        ...currentScenario,
        aiJustification: reportText,
      };
      onUpdateScenarios({ ...scenarios, [activeTab]: updatedScenario }, activeTab);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Switch Active Scenario Mode
  const handleSelectModeAsActive = (mode: 'pure_independent' | 'sibling_consolidation') => {
    setActiveTab(mode);
    onUpdateScenarios(scenarios, mode);
  };

  // Filtered Parcels for interactive assignment
  const filteredParcels = useMemo(() => {
    if (!searchTerm.trim()) return parcels;
    const q = searchTerm.toLowerCase();
    return parcels.filter(
      (p) =>
        p.ada.toLowerCase().includes(q) ||
        p.parselNo.toLowerCase().includes(q) ||
        (p.mevkii && p.mevkii.toLowerCase().includes(q)) ||
        (p.mahalle && p.mahalle.toLowerCase().includes(q)) ||
        (p.nitelik && p.nitelik.toLowerCase().includes(q))
    );
  }, [parcels, searchTerm]);

  // Total portfolio value
  const totalPortfolioTL = useMemo(() => {
    return parcels.reduce((sum, p) => sum + (Number(p.toplamDegerTL) || 0), 0);
  }, [parcels]);

  // Branch statistics for Sibling Consolidation
  const branchSummaries = useMemo(() => {
    if (!currentScenario || activeTab !== 'sibling_consolidation') return [];

    return availableBranches.map((b) => {
      const branchHeirs = heirs.filter((h) => h.kokMurisKolId === b.id);
      const branchHakEdilenTL = branchHeirs.reduce(
        (sum, h) => sum + (Number(h.hakEdilenTL) || 0),
        0
      );

      // Find all parcels assigned to this branch
      const assignedParcelIds = parcels
        .filter((p) => currentScenario.branchAssignments?.[p.id] === b.id)
        .map((p) => p.id);

      const assignedParcels = parcels.filter((p) => assignedParcelIds.includes(p.id));
      const branchAldigiDegerTL = assignedParcels.reduce(
        (sum, p) => sum + (Number(p.toplamDegerTL) || 0),
        0
      );

      const netFarkTL = Math.round((branchAldigiDegerTL - branchHakEdilenTL) * 100) / 100;
      let durum: 'borclu' | 'alacakli' | 'denk' = 'denk';
      if (netFarkTL > 0.05) durum = 'borclu';
      else if (netFarkTL < -0.05) durum = 'alacakli';

      return {
        branch: b,
        branchHeirs,
        assignedParcels,
        branchHakEdilenTL,
        branchAldigiDegerTL,
        netFarkTL,
        durum,
      };
    });
  }, [availableBranches, heirs, parcels, currentScenario, activeTab]);

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Scale className="w-5 h-5 text-blue-600" />
            Yapay Zeka ve Taksim Optimizasyonu
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Parselleri kullanıcı kararına veya otomatik algoritmaya göre paylaştırın. Değer denkleştirmeleri ve nakit ivazlar anında hesaplanır.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunOptimization}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Otomatik Dağıtımı Hesapla
          </button>
        </div>
      </div>

      {/* Mode Comparison Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card A: Tam Müstakil */}
        <div
          onClick={() => handleSelectModeAsActive('pure_independent')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeTab === 'pure_independent'
              ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 ring-1 ring-blue-600 shadow-sm'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Home className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                1. Senaryo: Tam Müstakil Taksim
              </h3>
            </div>
            {project.selectedScenarioMode === 'pure_independent' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-600 text-white">
                Seçili Proje Modu
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Her parsel kullanıcının belirlediği tek bir müstakil malike verilir. Sıfır hisseli tapu hedeflenir, değer farkları tamamen nakit ivazla kapatılır.
          </p>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-mono text-xs">
            <span className="text-slate-500 text-[11px]">Toplam İvaz Yükü:</span>
            <strong className="text-blue-700 dark:text-blue-400">
              {pureScenario ? formatCurrency(pureScenario.totalIvazAmountTL) : 'Hesaplanmadı'}
            </strong>
          </div>
        </div>

        {/* Card B: Veraset Kolu Ortaklı */}
        <div
          onClick={() => handleSelectModeAsActive('sibling_consolidation')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeTab === 'sibling_consolidation'
              ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-600 shadow-sm'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users2 className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                2. Senaryo: Veraset Kolu Ortaklı Taksim
              </h3>
            </div>
            {project.selectedScenarioMode === 'sibling_consolidation' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-600 text-white">
                Seçili Proje Modu
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Her parsel kullanıcının belirlediği üst veraset koluna ait olur. Parsel o koldaki paydaşlara hisseleri oranında ortak edilir, nakit ivaz yükü minimize edilir.
          </p>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-mono text-xs">
            <span className="text-slate-500 text-[11px]">Toplam İvaz Yükü:</span>
            <strong className="text-indigo-700 dark:text-indigo-400">
              {siblingScenario ? formatCurrency(siblingScenario.totalIvazAmountTL) : 'Hesaplanmadı'}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Results or Initial Prompt */}
      {!currentScenario ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Scale className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Taksim Hesabı Henüz Başlatılmadı
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto mb-4">
            Aşağıdaki butona tıklayarak algoritmanın tavsiye ettiği dağıtımı oluşturabilir veya doğrudan parselleri mirasçılara / veraset kollarına kendiniz atamaya başlayabilirsiniz.
          </p>
          <button
            onClick={handleRunOptimization}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Otomatik Taksim Dağıtımını Başlat
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Scenario Metrics Summary Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-500 text-[10px] uppercase block">Aktif Senaryo</span>
              <strong className="text-slate-900 dark:text-slate-100 text-sm font-sans font-bold flex items-center gap-1.5">
                {activeTab === 'pure_independent' ? (
                  <Home className="w-4 h-4 text-blue-600" />
                ) : (
                  <Users2 className="w-4 h-4 text-indigo-600" />
                )}
                {currentScenario.name}
              </strong>
            </div>

            <div>
              <span className="text-slate-500 text-[10px] uppercase block">Toplam Nakit İvaz</span>
              <strong className="text-blue-700 dark:text-blue-400 text-sm">
                {formatCurrency(currentScenario.totalIvazAmountTL)}
              </strong>
            </div>

            <div>
              <span className="text-slate-500 text-[10px] uppercase block">İvaz İşlem Sayısı</span>
              <strong className="text-slate-900 dark:text-slate-100 text-sm">
                {currentScenario.equalizationItems.length} Mahsuplaşma
              </strong>
            </div>

            <button
              onClick={onNavigateToEqualization}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-sans text-xs font-medium"
            >
              İvaz Matrisini Gör
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Interactive User Decision Section: Hangi parseli kimin alacağına kullanıcı karar versin */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
              <div>
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {activeTab === 'pure_independent'
                      ? 'Taşınmaz Dağıtım Tercihleri (Kullanıcı Kararı: Müstakil Malik Ataması)'
                      : 'Taşınmaz Dağıtım Tercihleri (Kullanıcı Kararı: Üst Veraset Kolu Ataması)'}
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {activeTab === 'pure_independent'
                    ? 'Her taşınmazın hangi mirasçıya müstakil olarak verileceğine doğrudan karar verin. Seçiminiz anında tablolara ve nakit ivazlara yansır.'
                    : 'Her taşınmazın hangi üst veraset koluna ait olacağına doğrudan karar verin. Parsel o koldaki mirasçılara payları oranında paylaştırılır.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleResetActiveToRecommended}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  title="Algoritmanın önerdiği dengeli dağıtımı tekrar uygula"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Önerilen Dağıtımı Uygula
                </button>
                <button
                  onClick={handleClearAssignments}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
                  title="Tüm parsel atamalarını kaldırarak sıfırdan dağıtın"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Temizle
                </button>
              </div>
            </div>

            {/* Filter Search */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Ada, parsel no veya mevkii ara..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {filteredParcels.length} / {parcels.length} Taşınmaz
              </span>
            </div>

            {/* Parcels Assignment Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Taşınmaz (Ada / Parsel)</th>
                    <th className="py-2.5 px-3">Konum & Nitelik</th>
                    <th className="py-2.5 px-3 text-right font-mono">Alan</th>
                    <th className="py-2.5 px-3 text-right font-mono">Taşınmaz Değeri (TL)</th>
                    <th className="py-2.5 px-4">
                      {activeTab === 'pure_independent'
                        ? 'Parseli Alan Mirasçı (Müstakil Malik)'
                        : 'Parselin Ait Olduğu Üst Kol (Veraset Kolu)'}
                    </th>
                    <th className="py-2.5 px-4">Tahsis Durumu / Paydaşlar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredParcels.map((parcel) => {
                    const pVal = Number(parcel.toplamDegerTL) || 0;

                    if (activeTab === 'pure_independent') {
                      // Find which heir currently has this parcel
                      const assignedHeir = heirs.find(
                        (h) => currentScenario.assignments[h.id]?.includes(parcel.id)
                      );

                      return (
                        <tr
                          key={parcel.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-1.5 font-mono">
                              <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>
                                {parcel.ada}/{parcel.parselNo}
                              </span>
                            </div>
                            {parcel.mevkii && (
                              <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                                {parcel.mevkii}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                            <div>
                              {[parcel.il, parcel.ilce, parcel.mahalle].filter(Boolean).join(', ') || '-'}
                            </div>
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mt-0.5">
                              {parcel.nitelik || 'Arsa/Tarla'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                            {formatArea(parcel.alanM2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-blue-700 dark:text-blue-400">
                            {formatCurrency(pVal)}
                          </td>
                          <td className="py-3 px-4 min-w-[220px]">
                            <select
                              value={assignedHeir ? assignedHeir.id : ''}
                              onChange={(e) => handleAssignParcelToHeir(parcel.id, e.target.value)}
                              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                            >
                              <option value="">-- Atanmadı (Boşta) --</option>
                              {heirs.map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.adSoyad} ({h.hisseOrani} Hisse - Hak: {formatCurrency(h.hakEdilenTL || 0)})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            {assignedHeir ? (
                              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium text-[11px]">
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>{assignedHeir.adSoyad}</span>
                                <span className="text-[10px] opacity-75">({assignedHeir.hisseOrani})</span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                Atanmadı
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    } else {
                      // Veraset Kolu Ortaklı Taksim
                      const assignedBranchId = currentScenario.branchAssignments?.[parcel.id];
                      const assignedBranch = availableBranches.find((b) => b.id === assignedBranchId);
                      const branchHeirs = assignedBranchId
                        ? heirs.filter((h) => h.kokMurisKolId === assignedBranchId)
                        : [];

                      return (
                        <tr
                          key={parcel.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-1.5 font-mono">
                              <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span>
                                {parcel.ada}/{parcel.parselNo}
                              </span>
                            </div>
                            {parcel.mevkii && (
                              <div className="text-[10px] text-slate-500 font-sans mt-0.5">
                                {parcel.mevkii}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                            <div>
                              {[parcel.il, parcel.ilce, parcel.mahalle].filter(Boolean).join(', ') || '-'}
                            </div>
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mt-0.5">
                              {parcel.nitelik || 'Arsa/Tarla'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                            {formatArea(parcel.alanM2)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400">
                            {formatCurrency(pVal)}
                          </td>
                          <td className="py-3 px-4 min-w-[220px]">
                            <select
                              value={assignedBranchId || ''}
                              onChange={(e) => handleAssignParcelToBranch(parcel.id, e.target.value)}
                              className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                            >
                              <option value="">-- Atanmadı (Boşta) --</option>
                              {availableBranches.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.adSoyad} {b.kokHisseOrani ? `(${b.kokHisseOrani} Kök Pay)` : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            {assignedBranch ? (
                              <div className="space-y-1">
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold text-[11px]">
                                  <Users2 className="w-3.5 h-3.5" />
                                  <span>{assignedBranch.adSoyad}</span>
                                </div>
                                {branchHeirs.length > 0 && (
                                  <div className="text-[10px] text-slate-600 dark:text-slate-400">
                                    {branchHeirs.map((bh) => bh.adSoyad).join(', ')} (
                                    {branchHeirs.length} Paydaş Ortak)
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                Atanmadı
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sibling Consolidation Mode: Veraset Kolları Bazında Bakiye ve Denge Özeti */}
          {activeTab === 'sibling_consolidation' && branchSummaries.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Veraset Kolları Bazında Denge ve İvaz Özeti
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  {branchSummaries.length} Veraset Kolu
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {branchSummaries.map((bs) => (
                  <div
                    key={bs.branch.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                        {bs.branch.adSoyad}
                      </div>
                      {bs.branch.kokHisseOrani && (
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          {bs.branch.kokHisseOrani} Kök Pay
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-[11px] font-mono">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Kol Hak Edişi:</span>
                        <strong className="text-slate-900 dark:text-slate-100">
                          {formatCurrency(bs.branchHakEdilenTL)}
                        </strong>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Verilen Taşınmazlar:</span>
                        <strong className="text-indigo-700 dark:text-indigo-400">
                          {formatCurrency(bs.branchAldigiDegerTL)}
                        </strong>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                        <span className="font-sans font-medium text-slate-700 dark:text-slate-300">
                          Kol Dengesi:
                        </span>
                        {bs.durum === 'borclu' && (
                          <strong className="text-red-600 dark:text-red-400">
                            +{formatCurrency(bs.netFarkTL)} BORÇLU
                          </strong>
                        )}
                        {bs.durum === 'alacakli' && (
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            -{formatCurrency(Math.abs(bs.netFarkTL))} ALACAKLI
                          </strong>
                        )}
                        {bs.durum === 'denk' && (
                          <strong className="text-slate-500">0,00 ₺ (DENK)</strong>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px] text-slate-500">
                      <strong>Atanan Taşınmazlar ({bs.assignedParcels.length}):</strong>{' '}
                      {bs.assignedParcels.length > 0
                        ? bs.assignedParcels.map((p) => `${p.ada}/${p.parselNo}`).join(', ')
                        : 'Henüz atanmadı'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Allocation Matrix Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Mirasçı Başına Parsel Tahsis ve Değer Tablosu
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Her mirasçının veraset hissesine göre hak edişi, aldığı taşınmaz değeri ve oluşan nakit ivaz borç/alacak durumu
                </p>
              </div>
              <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                Toplam Portföy:{' '}
                <strong className="text-blue-700 dark:text-blue-400 font-bold">
                  {formatCurrency(totalPortfolioTL)}
                </strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Mirasçı</th>
                    <th className="py-3 px-4">Kök Kol</th>
                    <th className="py-3 px-4 text-center font-mono">Hisse Oranı</th>
                    <th className="py-3 px-4 text-right font-mono">Hak Edilen Değer (TL)</th>
                    <th className="py-3 px-4">Tahsis Edilen Taşınmaz(lar)</th>
                    <th className="py-3 px-4 text-right font-mono">Verilen Taşınmaz Değeri</th>
                    <th className="py-3 px-4 text-right font-mono">Net İvaz (Denkleştirme) Durumu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currentScenario.balances.map((b) => {
                    const isDebtor = b.durum === 'borclu';
                    const isCreditor = b.durum === 'alacakli';

                    return (
                      <tr
                        key={b.heirId}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                          {b.heirName}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {b.kokMurisKolId}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-blue-700 dark:text-blue-400">
                          {b.hisseOrani}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                          {formatCurrency(b.hakEdilenTL)}
                        </td>
                        <td className="py-3 px-4">
                          {b.aldigiParselAdlari.length > 0 ? (
                            <span className="font-mono text-xs text-blue-900 dark:text-blue-300 font-medium">
                              {b.aldigiParselAdlari.join(', ')}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">
                              Taşınmaz verilmedi (Tamamı nakit ivaz alacaklısı)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                          {formatCurrency(b.aldigiParsellerDegeriTL)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {isDebtor && (
                            <div className="inline-flex flex-col items-end">
                              <span className="text-red-700 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded border border-red-200 dark:border-red-900">
                                +{formatCurrency(b.netFarkTL)} BORÇLU
                              </span>
                              <span className="text-[10px] text-red-600 font-sans mt-0.5">
                                (Hak edişinden fazla taşınmaz aldı, ivaz ödeyecek)
                              </span>
                            </div>
                          )}
                          {isCreditor && (
                            <div className="inline-flex flex-col items-end">
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900">
                                -{formatCurrency(Math.abs(b.netFarkTL))} ALACAKLI
                              </span>
                              <span className="text-[10px] text-emerald-600 font-sans mt-0.5">
                                (Hak edişinden eksik taşınmaz aldı, ivaz tahsil edecek)
                              </span>
                            </div>
                          )}
                          {!isDebtor && !isCreditor && (
                            <span className="text-slate-500 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                              0,00 ₺ (TAM DENK)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Justification Section */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Google AI Studio (Gemini 3.8 Flash) Taksim Adalet Raporu
                </h3>
              </div>

              <button
                onClick={handleFetchAiJustification}
                disabled={isAiLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isAiLoading ? 'Analiz Hazırlanıyor...' : 'Yapay Zeka Analizini Başlat'}
              </button>
            </div>

            {aiError && (
              <div className="p-3 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            {currentScenario.aiJustification ? (
              <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed text-slate-700 dark:text-slate-300 space-y-2 whitespace-pre-line bg-slate-50 dark:bg-slate-800/40 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                {currentScenario.aiJustification}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">
                Yapay zeka analizini çalıştırmak ve dağıtım adaleti, kök kol coğrafi bütünlüğü ile tavsiyeleri içeren raporu almak için <strong>"Yapay Zeka Analizini Başlat"</strong> butonuna tıklayın.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
