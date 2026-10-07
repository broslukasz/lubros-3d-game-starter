// IndexedDB persistent storage for user's uploaded default 3D model (.glb)
const DB_NAME = '3d_glb_studio_db';
const DB_VERSION = 1;
const STORE_NAME = 'default_model_store';
const KEY = 'active_default_character';

interface StoredModelRecord {
  id: string;
  buffer: ArrayBuffer;
  name: string;
  size: number;
  updatedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves uploaded GLB file buffer so it persists as the default character on next visits
 */
export async function saveDefaultModel(file: File): Promise<void> {
  try {
    const buffer = await file.arrayBuffer();
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record: StoredModelRecord = {
        id: KEY,
        buffer,
        name: file.name,
        size: file.size,
        updatedAt: Date.now(),
      };

      const putRequest = store.put(record);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });
  } catch (err) {
    console.warn('Could not save model to IndexedDB:', err);
  }
}

/**
 * Loads the saved default model from IndexedDB
 */
export async function loadSavedDefaultModel(): Promise<{ buffer: ArrayBuffer; name: string; size: number } | null> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(KEY);

      getRequest.onsuccess = () => {
        const record = getRequest.result as StoredModelRecord | undefined;
        if (record && record.buffer) {
          resolve({
            buffer: record.buffer,
            name: record.name,
            size: record.size,
          });
        } else {
          resolve(null);
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  } catch (err) {
    console.warn('Could not load model from IndexedDB:', err);
    return null;
  }
}

/**
 * Removes the saved model and reverts to demo
 */
export async function clearSavedDefaultModel(): Promise<void> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const delRequest = store.delete(KEY);

      delRequest.onsuccess = () => resolve();
      delRequest.onerror = () => reject(delRequest.error);
    });
  } catch (err) {
    console.warn('Could not clear model from IndexedDB:', err);
  }
}
