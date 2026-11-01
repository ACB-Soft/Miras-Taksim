import { ProjectState } from '../types';

const DB_NAME = 'MirasTaksimDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const PROJECT_KEY = 'current_project';

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

export async function saveProjectToStorage(project: ProjectState): Promise<void> {
  try {
    const updatedProject = {
      ...project,
      lastSaved: new Date().toISOString(),
    };

    // Try IndexedDB first
    try {
      const db = await openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(updatedProject, PROJECT_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback to localStorage
      localStorage.setItem('miras_taksim_backup', JSON.stringify(updatedProject));
    }
  } catch (err) {
    console.error('Save to storage failed:', err);
  }
}

export async function loadProjectFromStorage(): Promise<ProjectState | null> {
  try {
    try {
      const db = await openDB();
      const project = await new Promise<ProjectState | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(PROJECT_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });

      if (project) return project;
    } catch {
      // Fallback
    }

    const localData = localStorage.getItem('miras_taksim_backup');
    if (localData) {
      return JSON.parse(localData);
    }
  } catch (err) {
    console.error('Load from storage failed:', err);
  }
  return null;
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
    localStorage.removeItem('miras_taksim_backup');
  } catch (err) {
    console.error('Clear storage failed:', err);
  }
}
