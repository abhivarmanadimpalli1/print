import type { Order, OrderStatus } from '../types';

/**
 * Cloud Sync Engine for Internet-Wide Multi-Device Synchronization
 * ---------------------------------------------------------------
 * Connects physical smartphones (scanning QR codes via cellular / 4G / WiFi)
 * to the shopkeeper's desktop computer on Vercel with sub-second latency.
 * Uses persistent Server-Sent Events (SSE) and HTTP broadcast over a secure topic.
 */

const CLOUD_SYNC_BASE = 'https://ntfy.sh';

export function getShopCloudTopic(shopId: string = 'campus-prints'): string {
  // Unique topic scoped to the shop
  return `printqr-shop-${shopId}-sync-v1`;
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

// Generate an ephemeral device ID to avoid echo loops
const CURRENT_DEVICE_ID = typeof window !== 'undefined'
  ? (sessionStorage.getItem('qr_device_id') || (() => {
      const id = 'dev_' + Math.random().toString(36).substring(2, 9);
      try { sessionStorage.setItem('qr_device_id', id); } catch {}
      return id;
    })())
  : 'server';

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
    // If the order has a very large file payload, strip the base64 binary in the cloud broadcast
    // so it fits comfortably within the cloud broker's message limits.
    const safePayload = { ...fullPayload };
    if (safePayload.order && safePayload.order.fileDataUrl && safePayload.order.fileDataUrl.length > 2500) {
      safePayload.order = {
        ...safePayload.order,
        fileDataUrl: undefined, // file binary generated or held locally
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

            // Ignore messages broadcast by this same browser window
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
        // Reconnect after brief backoff
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
