import { ProjectState } from '../types';

const DB_NAME = 'MirasTaksimDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const PROJECT_KEY = 'current_project';
const LIBRARY_KEY = 'projects_library';
const LOCAL_CURRENT_KEY = 'miras_taksim_backup';
const LOCAL_LIBRARY_KEY = 'miras_taksim_projects_library';

export function createFreshProjectState(
  projectName = 'Yeni Miras Taksim Projesi',
  rootOwnerName = '1. Kuşak Mülk Sahibi'
): ProjectState {
  const now = new Date().toISOString();
  return {
    id: 'proj_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
    projectName: projectName.trim() || 'Yeni Miras Taksim Projesi',
    aciklama: '',
    rootOwnerName: rootOwnerName.trim() || '1. Kuşak Mülk Sahibi',
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
    createdAt: now,
    lastSaved: now,
  };
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as T) || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: any): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function sortProjectsNewest(projects: ProjectState[]): ProjectState[] {
  return [...projects].sort((a, b) => {
    const tA = new Date(a.lastSaved || a.createdAt || 0).getTime();
    const tB = new Date(b.lastSaved || b.createdAt || 0).getTime();
    return tB - tA;
  });
}

export async function saveProjectToStorage(project: ProjectState): Promise<void> {
  try {
    const updatedProject: ProjectState = {
      ...project,
      id: project.id || 'proj_default',
      lastSaved: new Date().toISOString(),
    };

    try {
      await idbPut(PROJECT_KEY, updatedProject);
    } catch {
      localStorage.setItem(LOCAL_CURRENT_KEY, JSON.stringify(updatedProject));
    }
  } catch (err) {
    console.error('Save to storage failed:', err);
  }
}

export async function loadProjectFromStorage(): Promise<ProjectState | null> {
  try {
    try {
      const project = await idbGet<ProjectState>(PROJECT_KEY);
      if (project) return project;
    } catch {
      // Fallback
    }

    const localData = localStorage.getItem(LOCAL_CURRENT_KEY);
    if (localData) {
      return JSON.parse(localData);
    }
  } catch (err) {
    console.error('Load from storage failed:', err);
  }
  return null;
}

export async function loadSavedProjects(): Promise<ProjectState[]> {
  let list: ProjectState[] = [];
  try {
    try {
      const idbList = await idbGet<ProjectState[]>(LIBRARY_KEY);
      if (Array.isArray(idbList)) {
        list = idbList;
      }
    } catch {
      const raw = localStorage.getItem(LOCAL_LIBRARY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) list = parsed;
      }
    }
  } catch (err) {
    console.error('Load project library failed:', err);
  }

  // Ensure legacy single current_project with actual data is migrated into the saved library
  const current = await loadProjectFromStorage();
  if (
    current &&
    (current.parcels?.length > 0 ||
      current.heirs?.length > 0 ||
      (current.projectName && current.projectName !== 'Miras Taksim ve Fiili Kullanım Yönetimi'))
  ) {
    const currentId = current.id || 'proj_legacy';
    const normalizedCurrent: ProjectState = {
      ...current,
      id: currentId,
      createdAt: current.createdAt || current.lastSaved || new Date().toISOString(),
      lastSaved: current.lastSaved || new Date().toISOString(),
    };
    const exists = list.some((p) => p.id === currentId);
    if (!exists) {
      list = [normalizedCurrent, ...list];
      await persistLibrary(list);
    }
  }

  return sortProjectsNewest(list);
}

async function persistLibrary(projects: ProjectState[]): Promise<void> {
  const sorted = sortProjectsNewest(projects);
  try {
    await idbPut(LIBRARY_KEY, sorted);
  } catch {
    localStorage.setItem(LOCAL_LIBRARY_KEY, JSON.stringify(sorted));
  }
}

export async function saveProjectToLibrary(project: ProjectState): Promise<ProjectState[]> {
  const now = new Date().toISOString();
  const normalized: ProjectState = {
    ...project,
    id: project.id || 'proj_' + Date.now().toString(36),
    createdAt: project.createdAt || now,
    lastSaved: now,
  };

  await saveProjectToStorage(normalized);

  const existing = await loadSavedProjects();
  const idx = existing.findIndex((p) => p.id === normalized.id);
  const next =
    idx >= 0
      ? existing.map((p, i) => (i === idx ? normalized : p))
      : [normalized, ...existing];

  await persistLibrary(next);
  return sortProjectsNewest(next);
}

export async function renameSavedProject(
  projectId: string,
  newName: string
): Promise<ProjectState[]> {
  const trimmed = newName.trim();
  if (!trimmed) return loadSavedProjects();

  const existing = await loadSavedProjects();
  const next = existing.map((p) =>
    p.id === projectId ? { ...p, projectName: trimmed, lastSaved: new Date().toISOString() } : p
  );
  await persistLibrary(next);

  const current = await loadProjectFromStorage();
  if (current && current.id === projectId) {
    await saveProjectToStorage({ ...current, projectName: trimmed });
  }

  return sortProjectsNewest(next);
}

export async function deleteSavedProject(projectId: string): Promise<ProjectState[]> {
  const existing = await loadSavedProjects();
  const next = existing.filter((p) => p.id !== projectId);
  await persistLibrary(next);

  const current = await loadProjectFromStorage();
  if (current && current.id === projectId) {
    await clearProjectStorage();
  }

  return sortProjectsNewest(next);
}

export async function clearProjectStorage(): Promise<void> {
  try {
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(PROJECT_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {}
    localStorage.removeItem(LOCAL_CURRENT_KEY);
  } catch (err) {
    console.error('Clear storage failed:', err);
  }
}
