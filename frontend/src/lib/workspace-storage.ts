import { WORKSPACE_STORAGE, type WorkspaceData } from "./sessions";

// Single-port story runs exceed localStorage's small per-origin quota.
// Keep complete, immutable snapshots in IndexedDB without dropping old runs.
let connection: IDBDatabase | undefined;
let opening: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  if (connection) return Promise.resolve(connection);
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open("atlas-single-port-workspace", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("snapshots");
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("浏览器中的工作区存储正被占用"));
    request.onsuccess = () => {
      connection = request.result;
      connection.onversionchange = () => {
        connection?.close();
        connection = undefined;
        opening = undefined;
      };
      resolve(connection);
    };
  });
  opening.catch(() => {
    opening = undefined;
  });
  return opening;
}
export async function readWorkspace(): Promise<string | null> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("snapshots")
      .objectStore("snapshots")
      .get(WORKSPACE_STORAGE);
    request.onsuccess = () =>
      resolve(request.result ? JSON.stringify(request.result) : null);
    request.onerror = () => reject(request.error);
  });
}
export async function writeWorkspace(workspace: WorkspaceData): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("snapshots", "readwrite");
    transaction.objectStore("snapshots").put(workspace, WORKSPACE_STORAGE);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("本地保存中断"));
  });
}
