import { ServiceReport, AuditEvent } from '../types';

const DB_NAME = 'XOVR_ServicePro_DB';
const DB_VERSION = 1;

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject('IndexedDB error: ' + (event.target as any).error);

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Reports store
      if (!db.objectStoreNames.contains('reports')) {
        db.createObjectStore('reports', { keyPath: 'id' });
      }

      // Attachments metadata store (for resuming uploads)
      if (!db.objectStoreNames.contains('attachments')) {
        db.createObjectStore('attachments', { keyPath: 'id' });
      }

      // Audit logs
      if (!db.objectStoreNames.contains('audit')) {
        db.createObjectStore('audit', { keyPath: 'id' });
      }
    };
  });
};

export const saveLocalReport = async (report: ServiceReport): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction('reports', 'readwrite');
  const store = tx.objectStore('reports');
  store.put(report);
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
  });
};

export const getLocalReport = async (id: string): Promise<ServiceReport | undefined> => {
  const db = await openDB();
  const tx = db.transaction('reports', 'readonly');
  const store = tx.objectStore('reports');
  const req = store.get(id);
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result);
  });
};

export const getAllLocalReports = async (): Promise<ServiceReport[]> => {
  const db = await openDB();
  const tx = db.transaction('reports', 'readonly');
  const store = tx.objectStore('reports');
  const req = store.getAll();
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result);
  });
};

export const logAuditLocal = async (event: AuditEvent): Promise<void> => {
  const db = await openDB();
  const tx = db.transaction('audit', 'readwrite');
  const store = tx.objectStore('audit');
  store.put(event);
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
  });
};
