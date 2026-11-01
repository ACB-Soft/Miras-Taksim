import React, { useRef } from 'react';
import { ProjectState } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { useOnlineStatus } from '../hooks/usePWAInstall';
import { exportProjectToZip, importProjectFromZip } from '../utils/zipArchive';
import { Archive, Upload, WifiOff, FileCheck2 } from 'lucide-react';

interface HeaderProps {
  project: ProjectState;
  onProjectUpdate: (newProject: ProjectState) => void;
  activeModuleTitle: string;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  onProjectUpdate,
  activeModuleTitle,
}) => {
  const isOnline = useOnlineStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleZipDownload = async () => {
    try {
      await exportProjectToZip(project);
    } catch (err: any) {
      alert('ZIP indirme hatası: ' + err.message);
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imported = await importProjectFromZip(file);
      onProjectUpdate(imported);
      alert(`Proje başarıyla yüklendi! (${imported.parcels.length} parsel, ${imported.heirs.length} mirasçı)`);
    } catch (err: any) {
      alert('Yedek yüklenirken hata oluştu: ' + err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between gap-8 shrink-0 no-print">
      {/* Zone 1: Single-line Brand & Project Context */}
      <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
        <a href="/" className="text-base font-extrabold tracking-tight text-blue-900 dark:text-blue-400">
          MirasTaksim
        </a>
        <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">/</span>
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 max-w-xs truncate">
          {project.projectName || 'Miras Taksim Projesi'}
        </span>
      </div>

      {/* Zone 2: Active Module indicator */}
      <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
        <FileCheck2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        <span className="font-medium text-slate-900 dark:text-slate-100">{activeModuleTitle}</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums font-mono">{project.parcels.length} Parsel</span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums font-mono">{project.heirs.length} Malik</span>
      </div>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
        {!isOnline && (
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-900">
            <WifiOff className="w-3 h-3" />
            <span>Çevrimdışı (Yerel)</span>
          </div>
        )}

        {/* Hidden ZIP file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleZipUpload}
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          title="Bilgisayardan daha önce kaydedilmiş .zip proje yedeğini yükle"
        >
          <Upload className="w-3.5 h-3.5 text-slate-500" />
          Dosyadan ZIP Yükle
        </button>

        <button
          onClick={handleZipDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 hover:bg-blue-100 transition"
          title="Tüm verileri, KML'leri ve noter taslaklarını .zip olarak indir"
        >
          <Archive className="w-3.5 h-3.5 text-blue-600" />
          Projeyi .ZIP İndir
        </button>

        <PWAInstallButton />
      </div>
    </header>
  );
};
