// Minimal promise wrapper around IndexedDB.
// Stores:
//   items    — watched / watchlist entries (keyPath "id", e.g. "movie:603")
//   posters  — poster Blobs, keyed by item id (kept out of the JSON export)
//   settings — key/value pairs (out-of-line keys)

const DB_NAME = 'cinedex';
const DB_VERSION = 1;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('items')) {
        const items = db.createObjectStore('items', { keyPath: 'id' });
        items.createIndex('status', 'status');
        items.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('posters')) db.createObjectStore('posters');
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
  });
  return dbPromise;
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

export async function get(storeName, key) {
  return promisify((await store(storeName)).get(key));
}

export async function getAll(storeName) {
  return promisify((await store(storeName)).getAll());
}

export async function put(storeName, value, key) {
  const s = await store(storeName, 'readwrite');
  return promisify(key === undefined ? s.put(value) : s.put(value, key));
}

export async function del(storeName, key) {
  return promisify((await store(storeName, 'readwrite')).delete(key));
}

/** Returns all entries of a key/value store as a plain object. */
export async function entries(storeName) {
  const s = await store(storeName);
  const [keys, values] = await Promise.all([promisify(s.getAllKeys()), promisify(s.getAll())]);
  return Object.fromEntries(keys.map((k, i) => [k, values[i]]));
}

export async function keys(storeName) {
  return promisify((await store(storeName)).getAllKeys());
}

/** Writes several stores in one atomic transaction. ops: [{ store, value, key? }]. */
export async function putMany(ops) {
  const db = await openDB();
  const names = [...new Set(ops.map((o) => o.store))];
  const tx = db.transaction(names, 'readwrite');
  for (const { store: name, value, key } of ops) {
    const s = tx.objectStore(name);
    if (key === undefined) s.put(value); else s.put(value, key);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}
