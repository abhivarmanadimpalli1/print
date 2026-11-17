import type { Order, OrderAttachment } from '../types';
import { downloadOrderAttachment, getUploadUserId, removeOrderAttachmentPaths, uploadOrderAttachment } from './supabase';
import { generateMinimalPdf } from './samplePdf';

export interface DownloadableAttachment extends OrderAttachment {
  legacyUrl?: string;
}

export async function uploadOrderAttachments(shopId: string, files: { name: string; blob: Blob }[]) {
  const userId = await getUploadUserId();
  const results = await Promise.allSettled(files.map(async ({ name, blob }) => {
    const storagePath = `${shopId}/${userId}/${crypto.randomUUID()}`;
    await uploadOrderAttachment(storagePath, blob);
    return { name, size: blob.size, storagePath };
  }));

  const uploaded = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
  if (uploaded.length === files.length) return uploaded;

  await removeOrderAttachmentPaths(uploaded.map(file => file.storagePath));
  const failedNames = files.filter((_, index) => results[index].status === 'rejected').map(file => file.name);
  throw new Error(`Could not upload ${failedNames.join(', ')}. Please try again.`);
}

export function getOrderAttachments(order: Order): DownloadableAttachment[] {
  if (order.attachments) return order.attachments;
  const name = order.fileName.replace(/ \(\+\d+ more docs\)$/, '');
  const isOldPlaceholder = name !== order.fileName && order.fileDataUrl &&
    !order.fileDownloadUrl && !order.isPurged &&
    order.fileDataUrl === generateMinimalPdf(order.fileName, order.detectedPageCount);
  return [{
    name,
    size: order.fileSize,
    legacyUrl: isOldPlaceholder ? undefined : order.fileDownloadUrl || order.fileDataUrl,
  }];
}

export async function getAttachmentBlob(attachment: DownloadableAttachment): Promise<Blob> {
  if (attachment.storagePath) {
    const blob = await downloadOrderAttachment(attachment.storagePath);
    if (blob.size !== attachment.size) throw new Error('The file size does not match the original.');
    return blob;
  }
  if (!attachment.legacyUrl) throw new Error('The original file is unavailable.');
  const response = await fetch(attachment.legacyUrl);
  if (!response.ok) throw new Error(`File download failed (${response.status}).`);
  return response.blob();
}

export async function saveAttachment(attachment: DownloadableAttachment): Promise<void> {
  const blob = await getAttachmentBlob(attachment);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
