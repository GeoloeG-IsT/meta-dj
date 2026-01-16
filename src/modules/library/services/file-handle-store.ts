/**
 * IndexedDB service for storing FileSystemFileHandle objects
 * Allows re-accessing files without user interaction (after permission grant)
 */

const DB_NAME = 'meta-dj-file-handles';
const DB_VERSION = 1;
const STORE_NAME = 'file-handles';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB for file handles'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Store file handles keyed by track ID
        db.createObjectStore(STORE_NAME, { keyPath: 'trackId' });
      }
    };
  });

  return dbPromise;
}

export interface StoredFileHandle {
  trackId: number;
  handle: FileSystemFileHandle;
  path: string;
  storedAt: number;
}

/**
 * Store a file handle for a track
 */
export async function storeFileHandle(
  trackId: number,
  handle: FileSystemFileHandle,
  path: string
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const record: StoredFileHandle = {
      trackId,
      handle,
      path,
      storedAt: Date.now(),
    };

    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to store file handle'));
  });
}

/**
 * Store multiple file handles in a batch
 */
export async function storeFileHandlesBatch(
  handles: Array<{ trackId: number; handle: FileSystemFileHandle; path: string }>
): Promise<void> {
  console.log(`[FileHandleStore] Storing ${handles.length} handles:`, handles.map(h => ({ trackId: h.trackId, path: h.path })));
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    transaction.oncomplete = () => {
      console.log(`[FileHandleStore] Successfully stored ${handles.length} handles`);
      resolve();
    };
    transaction.onerror = () => reject(new Error('Failed to store file handles batch'));

    for (const { trackId, handle, path } of handles) {
      const record: StoredFileHandle = {
        trackId,
        handle,
        path,
        storedAt: Date.now(),
      };
      store.put(record);
    }
  });
}

/**
 * Get a file handle for a track
 */
export async function getFileHandle(trackId: number): Promise<FileSystemFileHandle | null> {
  console.log(`[FileHandleStore] Getting handle for track ${trackId}`);
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.get(trackId);

    request.onsuccess = () => {
      const record = request.result as StoredFileHandle | undefined;
      console.log(`[FileHandleStore] Found record:`, record ? { trackId: record.trackId, path: record.path } : 'null');
      resolve(record?.handle ?? null);
    };
    request.onerror = () => reject(new Error('Failed to get file handle'));
  });
}

/**
 * Request permission for a stored file handle
 * Returns the File if permission granted, null otherwise
 */
export async function getFileWithPermission(trackId: number): Promise<File | null> {
  const handle = await getFileHandle(trackId);

  if (!handle) {
    return null;
  }

  try {
    // Check if we already have permission
    const permission = await handle.queryPermission({ mode: 'read' });

    if (permission === 'granted') {
      return await handle.getFile();
    }

    // Request permission (will show prompt if not previously granted this session)
    const requestResult = await handle.requestPermission({ mode: 'read' });

    if (requestResult === 'granted') {
      return await handle.getFile();
    }

    return null;
  } catch (error) {
    // Handle may be stale (file moved/deleted)
    console.warn('Failed to access file handle:', error);
    return null;
  }
}

/**
 * Delete a file handle
 */
export async function deleteFileHandle(trackId: number): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.delete(trackId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to delete file handle'));
  });
}

/**
 * Check if a file handle exists for a track
 */
export async function hasFileHandle(trackId: number): Promise<boolean> {
  const handle = await getFileHandle(trackId);
  return handle !== null;
}

/**
 * Clear all stored file handles
 */
export async function clearAllFileHandles(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to clear file handles'));
  });
}
