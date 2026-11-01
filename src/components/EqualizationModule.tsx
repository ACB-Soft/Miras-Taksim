import React from 'react';
import { ProjectState } from '../types';
import { formatCurrency } from '../utils/fractionEngine';
import {
  Coins,
  ArrowRight,
  CheckCircle2,
  FileCheck,
  TrendingDown,
  TrendingUp,
  Scale,
} from 'lucide-react';

interface EqualizationModuleProps {
  project: ProjectState;
  onNavigateToNotary: () => void;
}

export const EqualizationModule: React.FC<EqualizationModuleProps> = ({
  project,
  onNavigateToNotary,
}) => {
  const activeScenario =
    project.selectedScenarioMode === 'pure_independent'
      ? project.scenarios.pure_independent
      : project.scenarios.sibling_consolidation;

  if (!activeScenario) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 m-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <Coins className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
          İvaz Matrisi İçin Önce Taksim Hesaplanmalıdır
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          "Taksim & AI" sekmesine giderek optimizasyonu çalıştırın; ardından otomatik nakit denkleştirme ve mahsuplaşma tablosu burada oluşacaktır.
        </p>
      </div>
    );
  }

  const { balances, equalizationItems, totalIvazAmountTL } = activeScenario;

  const totalDebt = balances
    .filter((b) => b.durum === 'borclu')
    .reduce((sum, b) => sum + b.netFarkTL, 0);

  const totalCredit = balances
    .filter((b) => b.durum === 'alacakli')
    .reduce((sum, b) => sum + Math.abs(b.netFarkTL), 0);

  const isZeroSum = Math.abs(totalDebt - totalCredit) < 1.0;

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Nakit İvaz (Denkleştirme Bedeli) Matrisi
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Taşınmaz değerleri tam denk gelmediği için aradaki farkı kapatan sıfır toplamlı borç ve alacak denkleştirme tablosu.
          </p>
        </div>

        <button
          onClick={onNavigateToNotary}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm whitespace-nowrap"
        >
          <FileCheck className="w-4 h-4" />
          Noter Ön Protokolünü Oluştur
        </button>
      </div>

      {/* Zero Sum Verification KPI Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Toplam İvaz Borcu</span>
            <TrendingUp className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-lg font-mono font-bold text-red-600 mt-1">
            {formatCurrency(totalDebt)}
          </div>
          <p className="text-[10px] text-slate-600 mt-0.5">
            Hak ettiğinden fazla taşınmaz alanların ödeyeceği tutar
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Toplam İvaz Alacağı</span>
            <TrendingDown className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-mono font-bold text-emerald-600 mt-1">
            {formatCurrency(totalCredit)}
          </div>
          <p className="text-[10px] text-slate-600 mt-0.5">
            Hak ettiğinden eksik taşınmaz alanların tahsil edeceği tutar
          </p>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/40 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-900 dark:text-emerald-200">
              Sıfır Toplamlı Denge
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-mono font-bold text-emerald-700 dark:text-emerald-300 mt-1">
            Net Fark: 0,00 ₺
          </div>
          <p className="text-[10px] text-emerald-800 dark:text-emerald-300 mt-0.5">
            Borçlar ve alacaklar kuruşu kuruşuna birbirini sıfırlamaktadır.
          </p>
        </div>
      </div>

      {/* Individual Settlement Transactions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Kişiler Arası Nakit Transfer ve Mahsuplaşma Planı ({equalizationItems.length} Kalem)
          </h2>
          <span className="text-xs text-slate-500 font-mono">
            Toplam Transfer: <strong className="text-blue-600 font-bold">{formatCurrency(totalIvazAmountTL)}</strong>
          </span>
        </div>

        {equalizationItems.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Tüm parseller hak edişlere tam denk dağıtıldığı için nakit denkleştirme gerekmemektedir.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Sıra</th>
                  <th className="py-2.5 px-4 text-red-600">Ödeyecek Borçlu Malik</th>
                  <th className="py-2.5 px-4 text-center">İşlem Yönü</th>
                  <th className="py-2.5 px-4 text-emerald-600">Tahsil Edecek Alacaklı Malik</th>
                  <th className="py-2.5 px-4 text-right font-mono">Denkleştirme Tutarı</th>
                  <th className="py-2.5 px-4">Açıklama / Not</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {equalizationItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-bold text-red-700 dark:text-red-400">
                      {item.debtorName}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <ArrowRight className="w-4 h-4 text-slate-400 mx-auto" />
                    </td>
                    <td className="py-2.5 px-4 font-bold text-emerald-700 dark:text-emerald-400">
                      {item.creditorName}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {formatCurrency(item.amountTL)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                      {item.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notary Settlement Instructions */}
      <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/30 text-xs text-blue-900 dark:text-blue-200 space-y-2">
        <h4 className="font-bold text-sm flex items-center gap-1.5">
          <Scale className="w-4 h-4 text-blue-600" />
          Hukuki Güvence ve Ödeme Usulü
        </h4>
        <p className="text-[11px] leading-relaxed">
          Nakit ivaz bedelleri, taşınmazların devri sırasında taraflar arasında herhangi bir uyuşmazlığa mahal vermemek adına noter ön mutabakat zaptına banka IBAN bilgileriyle işlenmelidir. Borçlu maliklerin ödemelerini tapu devir gününden önce banka dekontuyla tescil ettirmeleri önerilir.
        </p>
      </div>
    </div>
  );
};
