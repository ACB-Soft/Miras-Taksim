import React, { useState } from 'react';
import { Parcel, Heir, TaksimScenario, ProjectState } from '../types';
import { runTaksimOptimization } from '../utils/binPacking';
import { formatCurrency, formatArea } from '../utils/fractionEngine';
import {
  Scale,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Users2,
  Home,
  RefreshCw,
  FileText,
  AlertCircle,
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
  const { parcels, heirs, scenarios, selectedScenarioMode } = project;

  const [activeTab, setActiveTab] = useState<'pure_independent' | 'sibling_consolidation'>(
    selectedScenarioMode || 'pure_independent'
  );
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const pureScenario = scenarios.pure_independent;
  const siblingScenario = scenarios.sibling_consolidation;
  const currentScenario = activeTab === 'pure_independent' ? pureScenario : siblingScenario;

  // Run Optimization for both scenarios
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

      // Update active scenario with AI text
      const updatedScenario: TaksimScenario = {
        ...currentScenario,
        aiJustification: reportText,
      };

      const updatedScenarios = {
        ...scenarios,
        [activeTab]: updatedScenario,
      };

      onUpdateScenarios(updatedScenarios, activeTab);
    } catch {
      // Fallback for offline / static GitHub Pages environment
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

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Yapay Zeka ve Taksim Optimizasyonu
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Parselleri bölmeden (Bin-Packing) mirasçıların net hak edişine en uygun şekilde paylaştırın ve iki temel stratejiyi karşılaştırın.
          </p>
        </div>

        <button
          onClick={handleRunOptimization}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm whitespace-nowrap"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Taksim Optimizasyonunu Hesapla
        </button>
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
            Her parsel tek bir müstakil malike verilir. Sıfır hisseli tapu hedeflenir, değer farkları tamamen nakit ivazla kapatılır.
          </p>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-mono text-xs">
            <span className="text-slate-500 text-[11px]">Toplam İvaz Yükü:</span>
            <strong className="text-blue-700 dark:text-blue-400">
              {pureScenario ? formatCurrency(pureScenario.totalIvazAmountTL) : 'Hesaplanmadı'}
            </strong>
          </div>
        </div>

        {/* Card B: Kardeş Ortaklı */}
        <div
          onClick={() => handleSelectModeAsActive('sibling_consolidation')}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            activeTab === 'sibling_consolidation'
              ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/30 ring-1 ring-blue-600 shadow-sm'
              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users2 className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                2. Senaryo: Kardeş Ortaklı Taksim
              </h3>
            </div>
            {project.selectedScenarioMode === 'sibling_consolidation' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-600 text-white">
                Seçili Proje Modu
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Yetersiz parsel veya yüksek değer durumunda aynı koldan gelen kardeşler bir parsele ortak edilir, nakit ivaz borcu minimize edilir.
          </p>

          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between font-mono text-xs">
            <span className="text-slate-500 text-[11px]">Toplam İvaz Yükü:</span>
            <strong className="text-indigo-700 dark:text-indigo-400">
              {siblingScenario ? formatCurrency(siblingScenario.totalIvazAmountTL) : 'Hesaplanmadı'}
            </strong>
          </div>
        </div>
      </div>

      {/* Main Results Container */}
      {!currentScenario ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Scale className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Taksim Hesabı Henüz Yapılmadı
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Yukarıdaki <strong>"Taksim Optimizasyonunu Hesapla"</strong> butonuna basarak her iki senaryonun matematiksel dağılımını oluşturun.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Scenario Metrics Summary Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-500 text-[10px] uppercase block">Aktif Senaryo</span>
              <strong className="text-slate-900 dark:text-slate-100 text-sm font-sans font-bold">
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
                Toplam Portföy: <strong className="text-blue-700 dark:text-blue-400 font-bold">{formatCurrency(parcels.reduce((sum, p) => sum + (Number(p.toplamDegerTL) || 0), 0))}</strong>
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
                Yapay zeka analizini çalıştırmak ve dağıtım adaleti, kök kol coğrafi bütünlüğü ile hukuki tavsiyeleri içeren raporu almak için <strong>"Yapay Zeka Analizini Başlat"</strong> butonuna tıklayın.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
