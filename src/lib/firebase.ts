import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  runTransaction,
  deleteField,
  getDoc,
  getDocs,
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
  measurementId?: string;
}

const FIREBASE_CONFIG_KEY = 'campus_print_firebase_config_v1';

// Default config provided by project owner (Abhinav)
export const DEFAULT_FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: "AIzaSyBxE40NVCeNNpu9Zo0Eo87CHUTuXZKRoRE",
  authDomain: "print-5c970.firebaseapp.com",
  projectId: "print-5c970",
  storageBucket: "print-5c970.firebasestorage.app",
  messagingSenderId: "188104133643",
  appId: "1:188104133643:web:e780c4ee30140aa7758b0e",
  measurementId: "G-ZRVE4TMZYD",
};

// Get config from localStorage, env variables, or default project config
export function getFirebaseConfig(): FirebaseConfig {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(FIREBASE_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.projectId && parsed.apiKey) return parsed;
      }
    }
  } catch {}

  const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  if (envApiKey) {
    return {
      apiKey: envApiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
      appId: import.meta.env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
      measurementId: DEFAULT_FIREBASE_CONFIG.measurementId,
    };
  }

  return DEFAULT_FIREBASE_CONFIG;
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
  return true;
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
    // Keep fileDataUrl in Firestore if <= 800KB for zero-latency instant downloads
    const isSmallEnoughForFirestore = order.fileDataUrl && order.fileDataUrl.length <= 800000;
    const safeOrder = {
      ...order,
      fileDataUrl: isSmallEnoughForFirestore ? order.fileDataUrl : undefined,
    };
    const data = JSON.parse(JSON.stringify(safeOrder));
    if (order.isPurged) {
      data.fileDataUrl = deleteField();
      data.fileDownloadUrl = deleteField();
    }
    await setDoc(orderRef, data, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firebase] Failed to sync order to Firestore:', err);
    return false;
  }
}

/** Update payment fields atomically without overwriting concurrent queue or quote changes. */
export async function updateOrderPaymentInFirestore(
  orderId: string,
  change: (current: Order) => Pick<Order, 'paymentStatus' | 'upiPayment'>,
): Promise<Order> {
  const db = getDb();
  if (!db) throw new Error('The order service is unavailable. Please try again; do not pay again.');
  return runTransaction(db, async transaction => {
    const reference = doc(db, 'orders', orderId);
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error('Order not found.');
    const current = { ...snapshot.data(), id: snapshot.id } as Order;
    const fields = change(current);
    const updatedAt = new Date().toISOString();
    transaction.update(reference, { ...fields, updatedAt });
    return { ...current, ...fields, updatedAt };
  });
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
 * Fetches a single order by ID or Order Number from Firestore (Solves "Order Not Found" across devices)
 */
export async function getOrderFromFirestore(orderIdOrNumber: string | number): Promise<Order | null> {
  const db = getDb();
  if (!db) return null;

  const raw = String(orderIdOrNumber).trim();
  const cleanId = raw.replace(/^#/, '');
  const numericOnly = cleanId.replace(/^ORD-/i, '');
  const standardOrdId = `ORD-${numericOnly}`;

  try {
    // 1. Direct doc lookup by cleanId
    let orderDoc = await getDoc(doc(db, 'orders', cleanId));
    if (orderDoc.exists()) {
      return orderDoc.data() as Order;
    }

    // 2. Direct doc lookup by standard ORD-XXX format
    if (cleanId !== standardOrdId) {
      orderDoc = await getDoc(doc(db, 'orders', standardOrdId));
      if (orderDoc.exists()) {
        return orderDoc.data() as Order;
      }
    }

    // 3. Query collection where orderNumber == numeric value
    const num = parseInt(numericOnly, 10);
    if (!isNaN(num)) {
      const q = query(collection(db, 'orders'), where('orderNumber', '==', num));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data() as Order;
      }
    }

    // 4. Query collection where id matches standard format
    const qUpper = query(collection(db, 'orders'), where('id', '==', standardOrdId));
    const snapUpper = await getDocs(qUpper);
    if (!snapUpper.empty) {
      return snapUpper.docs[0].data() as Order;
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
