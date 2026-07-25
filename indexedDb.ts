/**
 * Simple, robust IndexedDB helper to store massive string backups or objects
 * without triggering the 5MB browser localStorage quota exception.
 */

const DB_NAME = 'DarkWatchOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'backups';
const KEY_NAME = 'dark_watch_db_auto_backup';

export function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };
    request.onerror = (event: any) => {
      reject(event.target.error || new Error('Failed to open IndexedDB'));
    };
  });
}

/**
 * Saves a string value to IndexedDB.
 */
export async function setIndexedDBItem(value: string): Promise<void> {
  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, KEY_NAME);
      request.onsuccess = () => resolve();
      request.onerror = (e: any) => reject(e.target.error || new Error('Failed to put item in IndexedDB'));
    });
  } catch (err) {
    console.error('IndexedDB write failed:', err);
    throw err;
  }
}

/**
 * Retrieves a string value from IndexedDB. Falls back to checking localStorage
 * for any legacy backups to seamlessly migrate them.
 */
export async function getIndexedDBItem(): Promise<string | null> {
  try {
    const db = await openIndexedDB();
    const value = await new Promise<string | null>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(KEY_NAME);
      request.onsuccess = (e: any) => resolve(e.target.result || null);
      request.onerror = (e: any) => reject(e.target.error || new Error('Failed to get item from IndexedDB'));
    });

    if (value) {
      return value;
    }
  } catch (err) {
    console.warn('IndexedDB read failed, falling back to legacy localStorage check:', err);
  }

  // Fallback: Check if we have legacy backup in localStorage
  try {
    const legacyValue = localStorage.getItem('dark_watch_db_auto_backup');
    if (legacyValue) {
      console.log('Found legacy backup in localStorage. Attempting to migrate to IndexedDB...');
      // Try to migrate it to IndexedDB for next time
      try {
        await setIndexedDBItem(legacyValue);
        localStorage.removeItem('dark_watch_db_auto_backup'); // Clean up to free quota
        console.log('Successfully migrated legacy backup to IndexedDB and cleared localStorage!');
      } catch (migrationErr) {
        console.error('Migration to IndexedDB failed:', migrationErr);
      }
      return legacyValue;
    }
  } catch (lsErr) {
    console.error('Failed to read from localStorage:', lsErr);
  }

  return null;
}
