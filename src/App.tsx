/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { ProjectState, TaksimScenario } from './types';
import { loadProjectFromStorage, saveProjectToStorage } from './utils/storage';
import { computeHeirEntitlements } from './utils/fractionEngine';
import { Header } from './components/Header';
import { Sidebar, ActiveModule } from './components/Sidebar';
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

export default function App() {
  const [project, setProject] = useState<ProjectState>(INITIAL_PROJECT_STATE);
  const [activeModule, setActiveModule] = useState<ActiveModule>('parcels');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from storage on initial mount
  useEffect(() => {
    async function init() {
      try {
        const saved = await loadProjectFromStorage();
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

  // Auto-save to storage on project state changes
  useEffect(() => {
    if (!isLoaded) return;
    saveProjectToStorage(project);
  }, [project, isLoaded]);

  // Update handlers
  const handleUpdateParcels = (newParcels: any[]) => {
    setProject((prev) => {
      const { updatedHeirs } = computeHeirEntitlements(prev.heirs, newParcels);
      return {
        ...prev,
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
        heirs: updatedHeirs,
      };
    });
  };

  const handleUpdateBranches = (newBranches: any[]) => {
    setProject((prev) => ({
      ...prev,
      branches: newBranches,
    }));
  };

  const handleUpdateRootOwner = (name: string, title?: string) => {
    setProject((prev) => ({
      ...prev,
      rootOwnerName: name,
      rootOwnerTitle: title ?? prev.rootOwnerTitle,
    }));
  };

  const handleUpdateGenerationNames = (names: Record<number, string>) => {
    setProject((prev) => ({
      ...prev,
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
      scenarios: newScenarios,
      selectedScenarioMode: activeMode,
    }));
  };

  const getModuleTitle = (mod: ActiveModule): string => {
    switch (mod) {
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        project={project}
        onProjectUpdate={setProject}
        activeModuleTitle={getModuleTitle(activeModule)}
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
              <ArchiveModule project={project} onUpdateProject={setProject} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
