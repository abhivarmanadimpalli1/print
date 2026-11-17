import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  type FirebaseStorage,
} from 'firebase/storage';
import type { Order, Shop } from '../types';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const FIREBASE_CONFIG_KEY = 'campus_print_firebase_config_v1';

// Get config from localStorage or env variables
export function getFirebaseConfig(): FirebaseConfig | null {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(FIREBASE_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.projectId && parsed.apiKey) return parsed;
      }
    }
  } catch {}

  const envConfig: FirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  };

  if (envConfig.projectId && envConfig.apiKey) {
    return envConfig;
  }

  return null;
}

export function saveFirebaseConfig(config: FirebaseConfig): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(config));
    }
  } catch (err) {
    console.error('Failed saving Firebase config', err);
  }
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseConfig() !== null;
}

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let storageInstance: FirebaseStorage | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (appInstance) return appInstance;
  const config = getFirebaseConfig();
  if (!config) return null;

  try {
    if (getApps().length > 0) {
      appInstance = getApps()[0];
    } else {
      appInstance = initializeApp(config);
    }
    return appInstance;
  } catch (err) {
    console.warn('[Firebase] Initialization error:', err);
    return null;
  }
}

export function getDb(): Firestore | null {
  if (dbInstance) return dbInstance;
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    dbInstance = getFirestore(app);
    return dbInstance;
  } catch (err) {
    console.warn('[Firebase] Firestore init error:', err);
    return null;
  }
}

export function getStorageInstance(): FirebaseStorage | null {
  if (storageInstance) return storageInstance;
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    storageInstance = getStorage(app);
    return storageInstance;
  } catch (err) {
    console.warn('[Firebase] Storage init error:', err);
    return null;
  }
}

/**
 * Saves or updates an order in Firestore
 */
export async function syncOrderToFirestore(order: Order): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const orderRef = doc(db, 'orders', order.id);
    // Remove large local base64 string before saving to Firestore to keep DB fast & clean
    const safeOrder = {
      ...order,
      fileDataUrl: undefined,
    };
    await setDoc(orderRef, safeOrder, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firebase] Failed to sync order to Firestore:', err);
    return false;
  }
}

/**
 * Saves a bookstore into Firestore
 */
export async function syncShopToFirestore(shop: Shop): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const shopRef = doc(db, 'shops', shop.id);
    await setDoc(shopRef, shop, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firebase] Failed to sync shop to Firestore:', err);
    return false;
  }
}

/**
 * Real-time listener for a specific bookstore's orders
 */
export function listenToStoreOrdersFromFirestore(
  shopId: string,
  onOrders: (orders: Order[]) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};

  try {
    const ordersCol = collection(db, 'orders');
    const q = query(ordersCol, where('shopId', '==', shopId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const orders: Order[] = [];
        snapshot.forEach((d) => {
          orders.push(d.data() as Order);
        });
        orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onOrders(orders);
      },
      (err) => {
        console.warn('[Firebase] Orders listener error:', err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[Firebase] Listener registration failed:', err);
    return () => {};
  }
}

/**
 * Real-time listener for ALL orders in city (For Abhinav's Master Admin)
 */
export function listenToAllCityOrdersFromFirestore(
  onOrders: (orders: Order[]) => void
): () => void {
  const db = getDb();
  if (!db) return () => {};

  try {
    const ordersCol = collection(db, 'orders');
    const unsubscribe = onSnapshot(
      ordersCol,
      (snapshot) => {
        const orders: Order[] = [];
        snapshot.forEach((d) => {
          orders.push(d.data() as Order);
        });
        orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onOrders(orders);
      },
      (err) => {
        console.warn('[Firebase] All orders listener error:', err);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[Firebase] All orders listener registration failed:', err);
    return () => {};
  }
}

/**
 * Fetches a single order by ID from Firestore (Solves "Order Not Found" across devices)
 */
export async function getOrderFromFirestore(orderId: string): Promise<Order | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const orderDoc = await getDoc(doc(db, 'orders', orderId));
    if (orderDoc.exists()) {
      return orderDoc.data() as Order;
    }
  } catch (err) {
    console.warn('[Firebase] Error fetching order:', err);
  }
  return null;
}

/**
 * Uploads customer PDF binary directly to Firebase Cloud Storage
 */
export async function uploadPdfToFirebaseStorage(
  shopId: string,
  fileBlob: Blob | File,
  fileName: string
): Promise<string | null> {
  const storage = getStorageInstance();
  if (!storage) return null;

  try {
    const safeAsciiName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fileStoragePath = `shops/${shopId}/orders/${fileId}_${safeAsciiName}`;
    const fileRef = ref(storage, fileStoragePath);

    const snapshot = await uploadBytes(fileRef, fileBlob, {
      contentType: 'application/pdf',
      customMetadata: {
        shopId,
        originalName: fileName,
        uploadedAt: new Date().toISOString(),
      },
    });

    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (err) {
    console.warn('[Firebase Storage] Upload failed:', err);
    return null;
  }
}

/**
 * Permanently deletes the PDF from Firebase Storage after 10 minutes
 */
export async function purgePdfFromFirebase(downloadUrlOrPath: string): Promise<boolean> {
  const storage = getStorageInstance();
  if (!storage) return false;

  try {
    const fileRef = ref(storage, downloadUrlOrPath);
    await deleteObject(fileRef);
    return true;
  } catch (err) {
    console.warn('[Firebase Storage] Purge failed (file may already be deleted):', err);
    return false;
  }
}
