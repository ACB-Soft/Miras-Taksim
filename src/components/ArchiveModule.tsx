import React, { useRef, useState } from 'react';
import { ProjectState } from '../types';
import { exportProjectToZip, importProjectFromZip } from '../utils/zipArchive';
import { clearProjectStorage } from '../utils/storage';
import {
  Archive,
  Upload,
  Download,
  Trash2,
  HardDrive,
  CheckCircle,
  FileText,
  AlertTriangle,
} from 'lucide-react';

interface ArchiveModuleProps {
  project: ProjectState;
  onUpdateProject: (project: ProjectState) => void;
}

export const ArchiveModule: React.FC<ArchiveModuleProps> = ({
  project,
  onUpdateProject,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Export to ZIP
  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportProjectToZip(project);
    } catch (err: any) {
      alert('ZIP indirme hatası: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Import from ZIP
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const imported = await importProjectFromZip(file);
      onUpdateProject(imported);
      alert('Arşiv başarıyla geri yüklendi!');
    } catch (err: any) {
      alert('Arşiv yüklenirken hata oluştu: ' + err.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Reset Project
  const handleReset = async () => {
    if (
      confirm(
        'Tüm proje verilerini silmek ve sıfırdan boş bir proje başlatmak istediğinize emin misiniz? (Öncesinde .ZIP yedeği almanız önerilir)'
      )
    ) {
      await clearProjectStorage();
      onUpdateProject({
        projectName: 'Miras Taksim Projesi',
        parcels: [],
        branches: [
          { id: 'Kol-1', adSoyad: '1. Kardeş Kolu', kokHisseOrani: '1/3' },
          { id: 'Kol-2', adSoyad: '2. Kardeş Kolu', kokHisseOrani: '1/3' },
          { id: 'Kol-3', adSoyad: '3. Kardeş Kolu', kokHisseOrani: '1/3' },
        ],
        heirs: [],
        selectedScenarioMode: 'pure_independent',
        scenarios: {},
      });
      alert('Proje sıfırlandı.');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Proje Arşivi ve Yerel Depolama Yönetimi
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Tüm verileriniz tarayıcınızın yerel IndexedDB belleğinde gizlilikle saklanır. İstediğiniz an tek tuşla tam .ZIP yedeği alabilir veya daha önce kaydettiğiniz yedeği geri yükleyebilirsiniz.
        </p>
      </div>

      {/* Project Metadata Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
          Proje Bilgileri
        </h3>

        <div>
          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            Proje Adı
          </label>
          <input
            type="text"
            value={project.projectName}
            onChange={(e) => onUpdateProject({ ...project, projectName: e.target.value })}
            className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
            Açıklama / Miras Notları
          </label>
          <textarea
            rows={3}
            value={project.aciklama || ''}
            onChange={(e) => onUpdateProject({ ...project, aciklama: e.target.value })}
            placeholder="Miras bırakan muris, aile meclisi kararları veya özel notlar..."
            className="w-full mt-1 p-2 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Backup and Restore Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Export ZIP */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Projeyi .ZIP Olarak Dışa Aktar
            </h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Parseller, KML poligonları, 100+ mirasçı kütüğü, taksim senaryoları ve noter taslaklarını tek bir arşiv dosyasında toplar ve bilgisayarınıza indirir.
          </p>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Arşiv Hazırlanıyor...' : 'Projeyi .ZIP Olarak İndir'}
          </button>
        </div>

        {/* Import ZIP */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Dosyadan .ZIP Arşivi Yükle
            </h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Daha önce indirdiğiniz proje .zip dosyasını seçerek tüm harita poligonları ve mirasçı paylarıyla kaldığınız yerden devam edin.
          </p>

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleImport}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            {isImporting ? 'Arşiv Yükleniyor...' : 'Dosyadan .ZIP Arşivi Seç'}
          </button>
        </div>
      </div>

      {/* Storage Status & Statistics */}
      <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
          <HardDrive className="w-4 h-4 text-blue-600" />
          Mevcut Proje Durumu ve Depolama
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 font-mono">
          <div>
            <span className="text-[10px] text-slate-500 block">Kayıtlı Parsel</span>
            <strong>{project.parcels.length} Adet</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Kayıtlı Malik</span>
            <strong>{project.heirs.length} Kişi</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Fiili Bölüm</span>
            <strong>
              {project.parcels.reduce((acc, p) => acc + (p.subUsageAreas?.length || 0), 0)} Alan
            </strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Son Kayıt</span>
            <span className="text-[11px] text-slate-600 dark:text-slate-400">
              {project.lastSaved ? new Date(project.lastSaved).toLocaleTimeString('tr-TR') : 'Otomatik'}
            </span>
          </div>
        </div>
      </div>

      {/* Dangerous Reset Area */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Tüm verileri temizleyip sıfırdan başlamak için:
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Tüm Projeyi Sıfırla
        </button>
      </div>
    </div>
  );
};
