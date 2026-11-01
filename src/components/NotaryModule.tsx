import React, { useState } from 'react';
import { ProjectState } from '../types';
import {
  generateTaksimAccordProtocol,
  generateConditionalNotaryPowerOfAttorney,
  generateFiiliTaksimSozlesmesi,
} from '../utils/notaryDocGenerator';
import { saveAs } from 'file-saver';
import {
  FileText,
  Printer,
  Copy,
  Check,
  Download,
  ShieldCheck,
  Compass,
} from 'lucide-react';

interface NotaryModuleProps {
  project: ProjectState;
}

type DocumentTab = 'protocol' | 'poa' | 'fiili_taksim';

export const NotaryModule: React.FC<NotaryModuleProps> = ({ project }) => {
  const { heirs, parcels, scenarios, selectedScenarioMode } = project;

  const activeScenario =
    selectedScenarioMode === 'pure_independent'
      ? scenarios.pure_independent
      : scenarios.sibling_consolidation;

  const [activeTab, setActiveTab] = useState<DocumentTab>('protocol');
  const [selectedHeirId, setSelectedHeirId] = useState<string>(heirs[0]?.id || '');
  const [selectedParcelId, setSelectedParcelId] = useState<string>(
    parcels.find((p) => p.subUsageAreas && p.subUsageAreas.length > 0)?.id || parcels[0]?.id || ''
  );
  const [copied, setCopied] = useState(false);

  // Generate Current Document Text
  let documentTitle = '';
  let documentContent = '';

  if (activeTab === 'protocol') {
    documentTitle = 'Miras Taksimi Nihai Ön Mutabakat Zaptı ve Paylaşım Protokolü';
    if (!activeScenario) {
      documentContent = 'Lütfen önce Taksim & AI sekmesinden bir taksim senaryosu hesaplayınız.';
    } else {
      documentContent = generateTaksimAccordProtocol(
        project.projectName,
        heirs,
        parcels,
        activeScenario
      );
    }
  } else if (activeTab === 'poa') {
    const selectedHeir = heirs.find((h) => h.id === selectedHeirId) || heirs[0];
    documentTitle = `Şarta Bağlı Özel Yetkili Noter Vekâletname Taslağı (${selectedHeir?.adSoyad || 'Malik'})`;

    if (!selectedHeir || !activeScenario) {
      documentContent = 'Vekaletname oluşturmak için mirasçı ve taksim senaryosu gereklidir.';
    } else {
      const pIds = activeScenario.assignments[selectedHeir.id] || [];
      const heirParcels = parcels.filter((p) => pIds.includes(p.id));
      documentContent = generateConditionalNotaryPowerOfAttorney(selectedHeir, heirParcels);
    }
  } else if (activeTab === 'fiili_taksim') {
    const targetParcel = parcels.find((p) => p.id === selectedParcelId) || parcels[0];
    documentTitle = `Taşınmaz Fiili Kullanım ve Rızai Taksim Sözleşmesi (Ada ${targetParcel?.ada || '-'} / Parsel ${targetParcel?.parselNo || '-'})`;

    if (!targetParcel) {
      documentContent = 'Sözleşme oluşturmak için parsel bulunamadı.';
    } else {
      documentContent = generateFiiliTaksimSozlesmesi(
        targetParcel,
        targetParcel.subUsageAreas || [],
        heirs
      );
    }
  }

  // Handle Copy to Clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(documentContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Metin kopyalanamadı.');
    }
  };

  // Handle Download as Text File
  const handleDownloadTxt = () => {
    const safeTitle = documentTitle.replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ_ -]/g, '_');
    const blob = new Blob([documentContent], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, `${safeTitle}.txt`);
  };

  // Handle Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Header - Hidden in Print */}
      <div className="no-print flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Hukuki Noter Taslakları ve Ön Mutabakat Metinleri
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Güvensizlik krizini çözen şarta bağlı vekaletname, tüm paydaşların imzalayacağı ön mutabakat zaptı ve alt KML fiili kullanım sözleşmesi.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Kopyalandı!' : 'Metni Kopyala'}
          </button>

          <button
            onClick={handleDownloadTxt}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition"
          >
            <Download className="w-3.5 h-3.5" />
            .TXT İndir
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            Yazdır / PDF
          </button>
        </div>
      </div>

      {/* Document Tabs - Hidden in Print */}
      <div className="no-print flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('protocol')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition ${
            activeTab === 'protocol'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          1. Nihai Ön Mutabakat Zaptı
        </button>

        <button
          onClick={() => setActiveTab('poa')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition ${
            activeTab === 'poa'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          2. Şarta Bağlı Özel Vekâletname
        </button>

        <button
          onClick={() => setActiveTab('fiili_taksim')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg transition ${
            activeTab === 'fiili_taksim'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          3. Fiili Kullanım ve Rızai Taksim Sözleşmesi
        </button>
      </div>

      {/* Sub-selector for POA or Fiili Taksim - Hidden in Print */}
      {activeTab === 'poa' && (
        <div className="no-print bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Vekâletname Veren Mirasçı:
          </span>
          <select
            value={selectedHeirId}
            onChange={(e) => setSelectedHeirId(e.target.value)}
            className="p-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          >
            {heirs.map((h) => (
              <option key={h.id} value={h.id}>
                {h.adSoyad} (Hisse: {h.hisseOrani})
              </option>
            ))}
          </select>
        </div>
      )}

      {activeTab === 'fiili_taksim' && (
        <div className="no-print bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Sözleşme Tanzim Edilecek Parsel:
          </span>
          <select
            value={selectedParcelId}
            onChange={(e) => setSelectedParcelId(e.target.value)}
            className="p-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          >
            {parcels.map((p) => {
              const count = p.subUsageAreas?.length || 0;
              return (
                <option key={p.id} value={p.id}>
                  Ada {p.ada} / Parsel {p.parselNo} - {p.mevkii || 'Mevkii'} ({count} Alt Kullanım Bölümü)
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Document Preview Paper Canvas */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-md p-8 min-h-[500px]">
        <div className="max-w-4xl mx-auto space-y-4 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap select-text">
          {documentContent}
        </div>
      </div>
    </div>
  );
};
