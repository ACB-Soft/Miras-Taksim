/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ProjectState, TaksimScenario } from './types';
import {
  createFreshProjectState,
  deleteSavedProject,
  loadProjectFromStorage,
  loadSavedProjects,
  renameSavedProject,
  saveProjectToLibrary,
} from './utils/storage';
import { exportProjectToZip, importProjectFromZip } from './utils/zipArchive';
import { computeHeirEntitlements, calculateNetShareFromRelative } from './utils/fractionEngine';
import { Header } from './components/Header';
import { Sidebar, ActiveModule } from './components/Sidebar';
import { HomeTab } from './components/HomeTab';
import { ParcelAddModule } from './components/ParcelAddModule';
import { ParcelManagement } from './components/ParcelManagement';
import { HeirManagement } from './components/HeirManagement';
import { OptimizationModule } from './components/OptimizationModule';
import { EqualizationModule } from './components/EqualizationModule';
import { NotaryModule } from './components/NotaryModule';
import { ArchiveModule } from './components/ArchiveModule';

const INITIAL_PROJECT_STATE: ProjectState = {
  projectName: 'Miras Taksim ve Fiili Kullanım Yönetimi',
  aciklama: '',
  rootOwnerName: '1. Kuşak Mülk Sahibi',
  rootOwnerTitle: '1. Kuşak · Kök Malik',
  generationNames: {
    1: '1. Kuşak (İlk Mülk Sahibi)',
    2: '2. Kuşak (Veraset Kolları)',
    3: '3. Kuşak (Mirasçılar)',
    4: '4. Kuşak (Mirasçılar)',
  },
  parcels: [],
  branches: [
    { id: 'Kol-1', adSoyad: '1. Veraset Kolu', kokHisseOrani: '1/3' },
    { id: 'Kol-2', adSoyad: '2. Veraset Kolu', kokHisseOrani: '1/3' },
    { id: 'Kol-3', adSoyad: '3. Veraset Kolu', kokHisseOrani: '1/3' },
  ],
  heirs: [],
  selectedScenarioMode: 'pure_independent',
  scenarios: {},
};

function hasMeaningfulData(p: ProjectState): boolean {
  return Boolean(
    p.id ||
      p.parcels.length > 0 ||
      p.heirs.length > 0 ||
      (p.projectName && p.projectName !== INITIAL_PROJECT_STATE.projectName)
  );
}

export default function App() {
  const [project, setProject] = useState<ProjectState>(INITIAL_PROJECT_STATE);
  const [savedProjects, setSavedProjects] = useState<ProjectState[]>([]);
  const [activeModule, setActiveModule] = useState<ActiveModule>('home');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load current project & multi-project library on initial mount
  useEffect(() => {
    async function init() {
      try {
        const [saved, library] = await Promise.all([
          loadProjectFromStorage(),
          loadSavedProjects(),
        ]);
        setSavedProjects(library);
        if (saved && saved.parcels) {
          setProject(saved);
        }
      } catch (err) {
        console.error('Storage load failed:', err);
      } finally {
        setIsLoaded(true);
      }
    }
    init();
  }, []);

  // Auto-save active project to storage & library when project has been initialized/edited
  useEffect(() => {
    if (!isLoaded) return;
    if (!hasMeaningfulData(project)) return;

    let cancelled = false;
    saveProjectToLibrary(project).then((updatedLibrary) => {
      if (!cancelled) {
        setSavedProjects(updatedLibrary);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [project, isLoaded]);

  // Home Page Handlers
  const handleNewProject = async (projectName: string, rootOwnerName?: string) => {
    const fresh = createFreshProjectState(projectName, rootOwnerName);
    setProject(fresh);
    const updatedLibrary = await saveProjectToLibrary(fresh);
    setSavedProjects(updatedLibrary);
    setActiveModule('parcels');
  };

  const handleOpenProject = async (target: ProjectState) => {
    const normalized: ProjectState = {
      ...target,
      id: target.id || 'proj_' + Date.now().toString(36),
    };
    setProject(normalized);
    const updatedLibrary = await saveProjectToLibrary(normalized);
    setSavedProjects(updatedLibrary);
    setActiveModule('parcels');
  };

  const handleRenameSavedProject = async (projectId: string, newName: string) => {
    const updatedLibrary = await renameSavedProject(projectId, newName);
    setSavedProjects(updatedLibrary);
    if (project.id === projectId) {
      setProject((prev) => ({ ...prev, projectName: newName }));
    }
  };

  const handleDeleteSavedProject = async (projectId: string) => {
    const updatedLibrary = await deleteSavedProject(projectId);
    setSavedProjects(updatedLibrary);
    if (project.id === projectId) {
      setProject(INITIAL_PROJECT_STATE);
    }
  };

  const handleImportProjectFile = async (file: File) => {
    let imported: ProjectState;
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.json')) {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !Array.isArray(parsed.parcels) || !Array.isArray(parsed.heirs)) {
        throw new Error('Geçersiz JSON yapısı: Parsel veya mirasçı verisi eksik.');
      }
      imported = parsed;
    } else {
      imported = await importProjectFromZip(file);
    }

    const withId: ProjectState = {
      ...imported,
      id: imported.id || 'proj_' + Date.now().toString(36),
      createdAt: imported.createdAt || new Date().toISOString(),
      lastSaved: new Date().toISOString(),
    };
    setProject(withId);
    const updatedLibrary = await saveProjectToLibrary(withId);
    setSavedProjects(updatedLibrary);
    setActiveModule('parcels');
  };

  const handleExportProjectZip = async (targetProject: ProjectState) => {
    await exportProjectToZip(targetProject);
  };

  // Update handlers
  const handleUpdateParcels = (newParcels: any[]) => {
    setProject((prev) => {
      const { updatedHeirs } = computeHeirEntitlements(prev.heirs, newParcels);
      return {
        ...prev,
        id: prev.id || 'proj_' + Date.now().toString(36),
        parcels: newParcels,
        heirs: updatedHeirs,
      };
    });
  };

  const handleUpdateHeirs = (newHeirs: any[]) => {
    setProject((prev) => {
      const { updatedHeirs } = computeHeirEntitlements(newHeirs, prev.parcels);
      return {
        ...prev,
        id: prev.id || 'proj_' + Date.now().toString(36),
        heirs: updatedHeirs,
      };
    });
  };

  const handleUpdateBranches = (newBranches: any[]) => {
    setProject((prev) => {
      // If branch shares changed, cascade update to heirs with relative shares (kolIciPayOrani)
      const cascadedHeirs = prev.heirs.map((h) => {
        const br = newBranches.find((b) => b.id === h.kokMurisKolId);
        if (br && h.kolIciPayOrani) {
          const newNet = calculateNetShareFromRelative(br.kokHisseOrani, h.kolIciPayOrani);
          return {
            ...h,
            hisseOrani: newNet,
          };
        }
        return h;
      });

      const { updatedHeirs: finalHeirs } = computeHeirEntitlements(cascadedHeirs, prev.parcels);

      return {
        ...prev,
        id: prev.id || 'proj_' + Date.now().toString(36),
        branches: newBranches,
        heirs: finalHeirs,
      };
    });
  };

  const handleUpdateRootOwner = (name: string, title?: string) => {
    setProject((prev) => ({
      ...prev,
      id: prev.id || 'proj_' + Date.now().toString(36),
      rootOwnerName: name,
      rootOwnerTitle: title ?? prev.rootOwnerTitle,
    }));
  };

  const handleUpdateGenerationNames = (names: Record<number, string>) => {
    setProject((prev) => ({
      ...prev,
      id: prev.id || 'proj_' + Date.now().toString(36),
      generationNames: names,
    }));
  };

  const handleUpdateScenarios = (
    newScenarios: {
      pure_independent?: TaksimScenario;
      sibling_consolidation?: TaksimScenario;
    },
    activeMode: 'pure_independent' | 'sibling_consolidation'
  ) => {
    setProject((prev) => ({
      ...prev,
      id: prev.id || 'proj_' + Date.now().toString(36),
      scenarios: newScenarios,
      selectedScenarioMode: activeMode,
    }));
  };

  const getModuleTitle = (mod: ActiveModule): string => {
    switch (mod) {
      case 'home':
        return 'Ana Sayfa';
      case 'parcel_add':
        return 'Parsel Ekleme (TKGM Sorgu)';
      case 'parcels':
        return 'Parsel & Harita Yönetimi';
      case 'heirs':
        return 'Veraset & Mirasçı Kütüğü';
      case 'optimization':
        return 'Taksim & AI Optimizasyon';
      case 'equalization':
        return 'İvaz (Denkleştirme) Matrisi';
      case 'notary':
        return 'Noter Taslakları & Protokol';
      case 'archive':
        return 'Arşiv & Yerel Depolama';
      default:
        return 'Miras Taksimi';
    }
  };

  const handleSetProjectWithId = (nextProject: ProjectState) => {
    setProject({
      ...nextProject,
      id: nextProject.id || 'proj_' + Date.now().toString(36),
      createdAt: nextProject.createdAt || new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        project={project}
        onProjectUpdate={handleSetProjectWithId}
        activeModuleTitle={getModuleTitle(activeModule)}
        onNavigateHome={() => setActiveModule('home')}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Nav */}
        <Sidebar
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          project={project}
        />

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50">
          <div className="max-w-7xl mx-auto min-h-full">
            {activeModule === 'home' && (
              <HomeTab
                savedProjects={savedProjects}
                currentProject={project}
                onNewProject={handleNewProject}
                onOpenProject={handleOpenProject}
                onRenameProject={handleRenameSavedProject}
                onDeleteProject={handleDeleteSavedProject}
                onImportProjectFile={handleImportProjectFile}
                onExportProjectZip={handleExportProjectZip}
              />
            )}

            {activeModule === 'parcel_add' && (
              <ParcelAddModule
                parcels={project.parcels}
                onUpdateParcels={handleUpdateParcels}
                onNavigateToParcels={() => setActiveModule('parcels')}
              />
            )}

            {activeModule === 'parcels' && (
              <ParcelManagement
                parcels={project.parcels}
                heirs={project.heirs}
                onUpdateParcels={handleUpdateParcels}
                onNavigateToNotary={() => setActiveModule('notary')}
              />
            )}

            {activeModule === 'heirs' && (
              <HeirManagement
                heirs={project.heirs}
                branches={project.branches}
                parcels={project.parcels}
                rootOwnerName={project.rootOwnerName}
                rootOwnerTitle={project.rootOwnerTitle}
                generationNames={project.generationNames}
                onUpdateHeirs={handleUpdateHeirs}
                onUpdateBranches={handleUpdateBranches}
                onUpdateRootOwner={handleUpdateRootOwner}
                onUpdateGenerationNames={handleUpdateGenerationNames}
              />
            )}

            {activeModule === 'optimization' && (
              <OptimizationModule
                project={project}
                onUpdateScenarios={handleUpdateScenarios}
                onUpdateHeirs={handleUpdateHeirs}
                onNavigateToEqualization={() => setActiveModule('equalization')}
              />
            )}

            {activeModule === 'equalization' && (
              <EqualizationModule
                project={project}
                onNavigateToNotary={() => setActiveModule('notary')}
              />
            )}

            {activeModule === 'notary' && <NotaryModule project={project} />}

            {activeModule === 'archive' && (
              <ArchiveModule project={project} onUpdateProject={handleSetProjectWithId} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
