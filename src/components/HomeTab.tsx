import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileArchive,
  FilePlus2,
  FolderOpen,
  MapPin,
  Pencil,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { ProjectState } from '../types';
import { formatCurrency } from '../utils/fractionEngine';

interface HomeTabProps {
  savedProjects: ProjectState[];
  currentProject: ProjectState;
  onNewProject: (projectName: string, rootOwnerName?: string) => void;
  onOpenProject: (project: ProjectState) => void;
  onRenameProject: (projectId: string, newName: string) => Promise<void> | void;
  onDeleteProject: (projectId: string) => Promise<void> | void;
  onImportProjectFile: (file: File) => Promise<void>;
  onExportProjectZip: (project: ProjectState) => Promise<void>;
}

function formatSavedDate(iso?: string): string {
  if (!iso) return 'Henüz kaydedilmedi';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getProjectTotalValue(p: ProjectState): number {
  return (p.parcels || []).reduce((sum, item) => sum + (Number(item.toplamDegerTL) || 0), 0);
}

export const HomeTab: React.FC<HomeTabProps> = ({
  savedProjects,
  currentProject,
  onNewProject,
  onOpenProject,
  onRenameProject,
  onDeleteProject,
  onImportProjectFile,
  onExportProjectZip,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newRootOwnerName, setNewRootOwnerName] = useState('');

  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [importingFile, setImportingFile] = useState(false);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr');
    if (!q) return savedProjects;
    return savedProjects.filter((p) => {
      const nameMatch = (p.projectName || '').toLocaleLowerCase('tr').includes(q);
      const ownerMatch = (p.rootOwnerName || '').toLocaleLowerCase('tr').includes(q);
      return nameMatch || ownerMatch;
    });
  }, [savedProjects, searchQuery]);

  const handleStartCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = newProjectName.trim() || `Taksim Projesi (${savedProjects.length + 1})`;
    const finalRoot = newRootOwnerName.trim() || undefined;
    onNewProject(finalName, finalRoot);
    setNewProjectName('');
    setNewRootOwnerName('');
    setIsNewModalOpen(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setModalError(null);
    setImportingFile(true);
    try {
      await onImportProjectFile(file);
      setIsLoadModalOpen(false);
    } catch (err: any) {
      setModalError(err?.message || 'Proje dosyası okunamadı.');
    } finally {
      setImportingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleStartRename = (p: ProjectState, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!p.id) return;
    setDeletingProjectId(null);
    setEditingProjectId(p.id);
    setEditingName(p.projectName || '');
  };

  const handleSaveRename = async (projectId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const trimmed = editingName.trim();
    if (!trimmed) return;
    await onRenameProject(projectId, trimmed);
    setEditingProjectId(null);
    setEditingName('');
  };

  const handleCancelRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingProjectId(null);
    setEditingName('');
  };

  const handleStartDelete = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProjectId(null);
    setDeletingProjectId(projectId);
  };

  const handleConfirmDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await onDeleteProject(projectId);
    setDeletingProjectId(null);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingProjectId(null);
  };

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      {/* Hidden File Input for .zip / .json restore */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,.json,application/json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Hero Welcome Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-6 sm:p-10 border border-slate-700/60 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Miras Taksim ve Fiili Kullanım Yönetimine Hoş Geldiniz
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Kadastro parsellerini KML dosyası üzerinden aktarın, kuşak bazlı veraset soyağacı ve hisse oranlarını tanımlayın; müstakil veya veraset kolu ortaklı taksim senaryolarını oluşturup ivaz denkleştirme ve noter taslakları hazırlayın.
          </p>
        </div>

        {/* Subtle Cadastral Grid Pattern Background */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 pointer-events-none hidden md:block">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="home-cadastral-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#home-cadastral-grid)" />
          </svg>
        </div>
      </div>

      {/* Main Action Cards (Yeni Proje Oluştur & Eski Projelere Devam Et) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: Yeni Proje Oluştur */}
        <button
          type="button"
          onClick={() => {
            setNewProjectName('');
            setNewRootOwnerName('');
            setIsNewModalOpen(true);
          }}
          className="group text-left bg-white dark:bg-slate-900 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200/70 dark:border-blue-900 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FilePlus2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                Yeni Proje Oluştur
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Sıfırdan yeni bir miras taksim çalışması başlatın ve doğrudan parsel / harita yönetimi sayfasına geçiş yapın.
              </p>
            </div>
          </div>

          <div className="pt-6 flex items-center text-xs font-bold text-blue-600 dark:text-blue-400">
            <span>Yeni Çalışma Başlat</span>
            <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Card 2: Eski Projelere Devam Et */}
        <button
          type="button"
          onClick={() => {
            setModalError(null);
            setSearchQuery('');
            setIsLoadModalOpen(true);
          }}
          className="group text-left bg-white dark:bg-slate-900 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="space-y-4 w-full">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-900 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                  Eski Projelere Devam Et
                </h2>
                {savedProjects.length > 0 && (
                  <span className="text-xs font-mono tabular-nums font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                    {savedProjects.length} Kayıtlı
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                Tarayıcıda kayıtlı eski projelerinizi açın veya bilgisayarınızdan daha önce indirdiğiniz .zip / .json yedeğini yükleyerek devam edin.
              </p>
            </div>
          </div>

          <div className="pt-6 flex items-center text-xs font-bold text-emerald-700 dark:text-emerald-400">
            <span>Projeleri İncele ve Devam Et</span>
            <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      </div>

      {/* Recent Saved Projects Section (Direct Access on Home Screen) */}
      {savedProjects.length > 0 && (
        <section className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Son Kaydedilen Projeler</span>
            </h3>
            <button
              type="button"
              onClick={() => {
                setModalError(null);
                setSearchQuery('');
                setIsLoadModalOpen(true);
              }}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap"
            >
              Tümünü Yönet ({savedProjects.length})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedProjects.slice(0, 3).map((p, index) => {
              const pId = p.id || `idx_${index}`;
              const isCurrent = Boolean(currentProject.id && p.id === currentProject.id);
              const totalValue = getProjectTotalValue(p);

              if (deletingProjectId === pId) {
                return (
                  <div
                    key={pId}
                    className="p-4 rounded-xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30 flex flex-col justify-between space-y-3"
                  >
                    <p className="text-xs font-semibold text-red-800 dark:text-red-300">
                      &ldquo;{p.projectName}&rdquo; projesini silmek istiyor musunuz?
                    </p>
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        type="button"
                        onClick={handleCancelDelete}
                        className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-200 text-[11px] font-medium rounded-md border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                      >
                        Vazgeç
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleConfirmDelete(pId, e)}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded-md transition cursor-pointer"
                      >
                        Evet, Sil
                      </button>
                    </div>
                  </div>
                );
              }

              if (editingProjectId === pId) {
                return (
                  <div
                    key={pId}
                    className="p-4 rounded-xl border border-blue-400 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/30 flex flex-col justify-between space-y-2.5"
                  >
                    <div>
                      <label className="text-[10px] font-bold text-blue-800 dark:text-blue-300 block mb-1">
                        Proje İsmini Düzenle
                      </label>
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveRename(pId);
                          if (e.key === 'Escape') handleCancelRename();
                        }}
                        className="w-full bg-white dark:bg-slate-800 border border-blue-400 dark:border-blue-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        type="button"
                        onClick={handleCancelRename}
                        className="px-2 py-1 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 text-[11px] font-medium rounded transition cursor-pointer"
                      >
                        İptal
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleSaveRename(pId, e)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-md transition cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Kaydet</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={pId}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 bg-slate-50/60 dark:bg-slate-950/40 hover:bg-white dark:hover:bg-slate-900 transition-colors flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <h4
                          className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate"
                          title={p.projectName}
                        >
                          {p.projectName}
                        </h4>
                        {p.id && (
                          <button
                            type="button"
                            onClick={(e) => handleStartRename(p, e)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded transition shrink-0 cursor-pointer"
                            title="Proje ismini düzenle"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {isCurrent && (
                        <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 shrink-0 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Aktif
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
                      Son kayıt: {formatSavedDate(p.lastSaved || p.createdAt)}
                    </div>
                    {totalValue > 0 && (
                      <div className="text-[11px] font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 mt-1">
                        Portföy: {formatCurrency(totalValue)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 pt-2.5 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 font-mono tabular-nums text-[11px]">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        {p.parcels?.length || 0} Parsel
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        {p.heirs?.length || 0} Malik
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {p.id && (
                        <button
                          type="button"
                          onClick={(e) => handleStartDelete(pId, e)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                          title="Projeyi sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenProject(p)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold rounded-md transition cursor-pointer whitespace-nowrap"
                      >
                        Devam Et
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* New Project Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4">
          <form
            onSubmit={handleStartCreateProject}
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FilePlus2 className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Yeni Proje Oluştur
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Proje Adı
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder={`Örn: Taksim Projesi (${savedProjects.length + 1})`}
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  1. Kuşak İlk Mülk Sahibi (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={newRootOwnerName}
                  onChange={(e) => setNewRootOwnerName(e.target.value)}
                  placeholder="Örn: Ahmet Yılmaz (Daha sonra da değiştirilebilir)"
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                İptal
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5"
              >
                <span>Projeyi Oluştur ve Başla</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Eski Projelere Devam Et / Proje Yükle Modal */}
      {isLoadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[86vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 flex items-center justify-center">
                  <FolderOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Eski Projelere Devam Et
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Kayıtlı projelerden seçin veya bilgisayarınızdan .zip / .json yedeği yükleyin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLoadModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5">
              {modalError && (
                <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-xs text-red-800 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Option 1: Bilgisayardan Dosya Seç (.zip / .json) */}
              <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                    <FileArchive className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Bilgisayardan Proje Yedeği Seç (.zip / .json)
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Daha önce indirdiğiniz arşiv dosyasını doğrudan uygulamaya yükleyin
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={importingFile}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{importingFile ? 'Yükleniyor...' : 'Dosya Seç'}</span>
                </button>
              </div>

              {/* Divider */}
              <div className="relative text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                </div>
                <span className="relative bg-white dark:bg-slate-900 px-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Kayıtlı Projeler ({savedProjects.length})
                </span>
              </div>

              {/* Search bar if multiple projects */}
              {savedProjects.length > 3 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Proje adı veya mülk sahibi adına göre filtrele..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}

              {/* Option 2: Kayıtlı Projeler Listesi */}
              <div className="space-y-2.5">
                {filteredProjects.length === 0 ? (
                  <div className="text-center py-10 px-4 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
                    <FolderOpen className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      {savedProjects.length === 0
                        ? 'Henüz Kayıtlı Proje Yok'
                        : 'Aramanızla Eşleşen Proje Bulunamadı'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                      Yeni bir proje başlattığınızda veya dışarıdan .zip arşivi yüklediğinizde projeleriniz burada otomatik olarak listelenir.
                    </p>
                  </div>
                ) : (
                  filteredProjects.map((p, index) => {
                    const pId = p.id || `modal_idx_${index}`;
                    const isCurrent = Boolean(currentProject.id && p.id === currentProject.id);
                    const totalValue = getProjectTotalValue(p);

                    if (deletingProjectId === pId) {
                      return (
                        <div
                          key={pId}
                          className="p-3.5 rounded-xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30 flex items-center justify-between gap-3"
                        >
                          <span className="text-xs font-semibold text-red-800 dark:text-red-300">
                            &ldquo;{p.projectName}&rdquo; projesini silmek istediğinize emin misiniz?
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={handleCancelDelete}
                              className="px-3 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                            >
                              Vazgeç
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleConfirmDelete(pId, e)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                            >
                              Evet, Sil
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (editingProjectId === pId) {
                      return (
                        <div
                          key={pId}
                          className="p-3.5 rounded-xl border border-blue-400 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-950/30 flex items-center justify-between gap-3"
                        >
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-blue-800 dark:text-blue-300 block mb-1">
                              Yeni Proje İsmi
                            </label>
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(pId);
                                if (e.key === 'Escape') handleCancelRename();
                              }}
                              className="w-full bg-white dark:bg-slate-800 border border-blue-400 dark:border-blue-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 pt-4">
                            <button
                              type="button"
                              onClick={handleCancelRename}
                              className="p-1.5 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                              title="İptal"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleSaveRename(pId, e)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                              title="Kaydet"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Kaydet</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={pId}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-700 transition-colors flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4
                              className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate"
                              title={p.projectName}
                            >
                              {p.projectName}
                            </h4>
                            {p.id && (
                              <button
                                type="button"
                                onClick={(e) => handleStartRename(p, e)}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded transition cursor-pointer"
                                title="Proje ismini düzenle"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isCurrent && (
                              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Aktif Proje
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex-wrap font-mono tabular-nums">
                            <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-sans">
                              <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                              <span>{formatSavedDate(p.lastSaved || p.createdAt)}</span>
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{p.parcels?.length || 0} Parsel</span>
                            <span aria-hidden="true">·</span>
                            <span>{p.heirs?.length || 0} Malik</span>
                            {totalValue > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  {formatCurrency(totalValue)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onExportProjectZip(p)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="Projeyi .zip olarak indir"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {p.id && (
                            <button
                              type="button"
                              onClick={(e) => handleStartDelete(pId, e)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition cursor-pointer"
                              title="Projeyi sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              onOpenProject(p);
                              setIsLoadModalOpen(false);
                            }}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                          >
                            <span>Devam Et</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsLoadModalOpen(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
