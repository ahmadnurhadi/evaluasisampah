import type { WasteCategory } from "@/lib/waste";

export type WasteGenerationPayload = {
  requestId: string;
  userId: string;
  schoolId: string;
  locationId: string;
  qrToken: string;
  sourceId: string;
  category: WasteCategory;
  weightKg: number;
  recordedAt: string;
  wasteTypeId: string | null;
  photoUrl: string | null;
  notes: string | null;
};

type QueueEntry = WasteGenerationPayload & { queuedAt: number };

const DB_NAME = "eco-school-offline";
const DB_VERSION = 1;
const STORE = "waste-generation";

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Penyimpanan offline tidak tersedia di browser ini."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        const store = database.createObjectStore(STORE, { keyPath: "requestId" });
        store.createIndex("userId", "userId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Gagal membuka antrean offline."));
  });
}

export async function queueWasteGeneration(payload: WasteGenerationPayload): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put({ ...payload, queuedAt: Date.now() } satisfies QueueEntry);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Gagal menyimpan catatan offline."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Penyimpanan catatan offline dibatalkan."));
  });
  database.close();
}

export async function listQueuedWasteGeneration(userId: string): Promise<QueueEntry[]> {
  const database = await openDatabase();
  const entries = await new Promise<QueueEntry[]>((resolve, reject) => {
    const request = database.transaction(STORE, "readonly").objectStore(STORE).index("userId").getAll(userId);
    request.onsuccess = () => resolve((request.result as QueueEntry[]).sort((left, right) => left.queuedAt - right.queuedAt));
    request.onerror = () => reject(request.error ?? new Error("Gagal membaca antrean offline."));
  });
  database.close();
  return entries;
}

export async function removeQueuedWasteGeneration(requestId: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(requestId);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Gagal membersihkan antrean offline."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Pembersihan antrean offline dibatalkan."));
  });
  database.close();
}
