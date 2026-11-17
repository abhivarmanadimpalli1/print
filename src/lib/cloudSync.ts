import type { Order, OrderStatus } from '../types';

/**
 * Cloud Sync & File Transfer Engine for Real In-Shop QR Print Operations
 * ---------------------------------------------------------------------
 * Transmits real uploaded customer PDF binaries and order events across
 * cellular/WiFi devices (phone -> desktop on Vercel) in real-time.
 */

const CLOUD_SYNC_BASE = 'https://ntfy.sh';

export function getShopCloudTopic(shopId: string = 'campus-prints'): string {
  return `printqr-shop-${shopId}-sync-v1`;
}

export function getShopFilesTopic(shopId: string = 'campus-prints'): string {
  return `printqr-files-${shopId}-v1`;
}

export interface CloudPayload {
  action: 'CREATE_ORDER' | 'UPDATE_STATUS' | 'PURGE_ORDER' | 'TEST_PING';
  order?: Order;
  orderId?: string;
  status?: OrderStatus;
  note?: string;
  purgeAt?: string;
  timestamp: string;
  deviceId?: string;
}

const CURRENT_DEVICE_ID = typeof window !== 'undefined'
  ? (sessionStorage.getItem('qr_device_id') || (() => {
      const id = 'dev_' + Math.random().toString(36).substring(2, 9);
      try { sessionStorage.setItem('qr_device_id', id); } catch {}
      return id;
    })())
  : 'server';

/**
 * Uploads the actual customer PDF binary to the cloud storage bucket so the shopkeeper
 * downloads the real, unmodified document with all pages and fonts.
 */
export async function uploadPdfToCloud(shopId: string, fileBlob: Blob | File, fileName: string): Promise<string | null> {
  const topic = getShopFilesTopic(shopId);
  try {
    const res = await fetch(`${CLOUD_SYNC_BASE}/${topic}?filename=${encodeURIComponent(fileName)}`, {
      method: 'PUT',
      headers: {
        'Title': `Customer PDF: ${fileName}`,
        'Filename': fileName,
      },
      body: fileBlob,
    });

    if (!res.ok) {
      console.warn('[CloudSync] File upload returned status:', res.status);
      return null;
    }

    const data = await res.json();
    if (data.attachment && data.attachment.url) {
      return data.attachment.url;
    }
  } catch (err) {
    console.warn('[CloudSync] Real PDF file upload failed:', err);
  }
  return null;
}

/**
 * Broadcasts an order or status update to all connected devices over the internet.
 */
export async function broadcastToCloud(shopId: string, payload: Omit<CloudPayload, 'timestamp' | 'deviceId'>): Promise<boolean> {
  const topic = getShopCloudTopic(shopId);
  const fullPayload: CloudPayload = {
    ...payload,
    timestamp: new Date().toISOString(),
    deviceId: CURRENT_DEVICE_ID,
  };

  try {
    // Strip large inline base64 string because the real file is referenced by fileDownloadUrl
    const safePayload = { ...fullPayload };
    if (safePayload.order && safePayload.order.fileDataUrl && safePayload.order.fileDataUrl.length > 2500) {
      safePayload.order = {
        ...safePayload.order,
        fileDataUrl: undefined,
      };
    }

    const res = await fetch(`${CLOUD_SYNC_BASE}/${topic}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Title': `Print Order: ${payload.action}`,
        'Priority': 'high',
      },
      body: JSON.stringify(safePayload),
    });

    return res.ok;
  } catch (err) {
    console.warn('[CloudSync] Broadcast failed:', err);
    return false;
  }
}

/**
 * Polls historical orders submitted from phones in the last 12 hours.
 */
export async function fetchRecentCloudOrders(shopId: string): Promise<CloudPayload[]> {
  const topic = getShopCloudTopic(shopId);
  try {
    const res = await fetch(`${CLOUD_SYNC_BASE}/${topic}/json?poll=1`);
    if (!res.ok) return [];

    const text = await res.text();
    const lines = text.trim().split('\n').filter(Boolean);
    const results: CloudPayload[] = [];

    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        if (item.message) {
          const parsed: CloudPayload = typeof item.message === 'string'
            ? JSON.parse(item.message)
            : item.message;
          if (parsed && parsed.action) {
            results.push(parsed);
          }
        }
      } catch {
        // Skip unparseable lines
      }
    }

    return results;
  } catch (err) {
    console.warn('[CloudSync] Polling failed:', err);
    return [];
  }
}

/**
 * Opens a real-time SSE listener so orders submitted on physical phones
 * immediately appear on the shopkeeper's desktop screen without refreshing.
 */
export function listenToCloud(shopId: string, onMessage: (payload: CloudPayload) => void): () => void {
  if (typeof window === 'undefined' || !('EventSource' in window)) {
    return () => {};
  }

  const topic = getShopCloudTopic(shopId);
  let eventSource: EventSource | null = null;
  let isClosed = false;

  const connect = () => {
    if (isClosed) return;
    try {
      eventSource = new EventSource(`${CLOUD_SYNC_BASE}/${topic}/sse`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && data.message) {
            const payload: CloudPayload = typeof data.message === 'string'
              ? JSON.parse(data.message)
              : data.message;

            if (payload && payload.deviceId !== CURRENT_DEVICE_ID) {
              onMessage(payload);
            }
          }
        } catch (err) {
          console.warn('[CloudSync] Error parsing incoming event:', err);
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!isClosed) {
          setTimeout(connect, 4000);
        }
      };
    } catch (err) {
      console.warn('[CloudSync] EventSource initialization failed:', err);
    }
  };

  connect();

  return () => {
    isClosed = true;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}
