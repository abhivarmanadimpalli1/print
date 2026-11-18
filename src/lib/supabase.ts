import { createClient } from '@supabase/supabase-js';
import type { Shop } from '../types';

const projectUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = projectUrl && publishableKey ? createClient(projectUrl, publishableKey) : null;
const bucket = 'print-files';

export const maxOrderFileSize = 50_000_000;

function getClient() {
  if (!supabase) throw new Error('Supabase Storage is not configured.');
  return supabase;
}

let startUploadSession: Promise<string> | undefined;
const verifiedCounters = new Set<string>();

export function getUploadUserId(): Promise<string> {
  if (!startUploadSession) {
    startUploadSession = (async () => {
      const { data, error } = await getClient().auth.getSession();
      if (error) throw error;
      if (data.session) return data.session.user.id;
      const anonymous = await getClient().auth.signInAnonymously();
      if (anonymous.error) throw anonymous.error;
      if (!anonymous.data.user) throw new Error('Could not start a customer upload session.');
      return anonymous.data.user.id;
    })().finally(() => {
      startUploadSession = undefined;
    });
  }
  return startUploadSession;
}

export async function canAccessCounter(shopId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data: session, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session.session) {
    verifiedCounters.delete(shopId);
    return false;
  }
  const { data, error } = await supabase.rpc('quickprint_can_manage_shop', { target_shop: shopId });
  if (error) throw error;
  const allowed = data === true;
  if (allowed) verifiedCounters.add(shopId);
  else verifiedCounters.delete(shopId);
  return allowed;
}

export const hasVerifiedCounter = (shopId: string) => verifiedCounters.has(shopId);

export async function signInToCounter(shopId: string, email: string, password: string) {
  const client = getClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (await canAccessCounter(shopId)) return;
  await signOutFromCounter();
  throw new Error('This account does not have access to this shop.');
}

export async function signOutFromCounter() {
  verifiedCounters.clear();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function isPlatformAdmin(): Promise<boolean> {
  if (!supabase) return false;
  const { data: session } = await supabase.auth.getSession();
  if (!session.session || session.session.user.is_anonymous) return false;
  const { data, error } = await supabase.rpc('quickprint_is_platform_admin');
  if (error) throw error;
  return data === true;
}

export async function signInToPlatform(email: string, password: string) {
  const { error } = await getClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (await isPlatformAdmin()) return;
  await signOutFromCounter();
  throw new Error('This account does not have platform owner access.');
}

export async function createCounterSetupLink(shopId: string): Promise<string> {
  const { data, error } = await getClient().rpc('quickprint_create_counter_link', { target_shop: shopId });
  if (error) throw error;
  return `${window.location.origin}/s/${shopId}/counter#setup=${data}`;
}

export async function activateCounterDevice(shopId: string, code: string) {
  await getUploadUserId();
  const { error } = await getClient().rpc('quickprint_activate_counter', { target_shop: shopId, setup_code: code });
  if (error) throw error;
  if (!(await canAccessCounter(shopId))) throw new Error('Could not activate this counter.');
}

export interface PublishedShop {
  shop_id: string;
  profile: Partial<Shop>;
  management?: Partial<Shop>;
  counter_email?: string | null;
}

export async function getPublishedShop(shopId: string): Promise<PublishedShop | null> {
  const { data, error } = await getClient()
    .from('quickprint_shops')
    .select('shop_id, profile')
    .eq('shop_id', shopId)
    .maybeSingle<PublishedShop>();
  if (error) throw error;
  return data;
}

export async function listManagedShops(): Promise<PublishedShop[]> {
  const { data, error } = await getClient().rpc('quickprint_list_managed_shops');
  if (error) throw error;
  return data ?? [];
}

function customerShopProfile(shop: Shop) {
  const { id, slug, name, tagline, location, phone, isOpen, openingHours, pricing,
    acceptedPaymentModes, retentionMinutes, qrCodeUrl, upiId, upiPayeeName } = shop;
  return { id, slug, name, tagline, location, phone, isOpen, openingHours, pricing,
    acceptedPaymentModes, retentionMinutes, qrCodeUrl, upiId: upiId?.trim() || '', upiPayeeName: upiPayeeName?.trim() || '' };
}

export async function publishNewShop(shop: Shop, ownerEmail: string) {
  const { ownerName, ownerPhone, monthlySubscriptionFee, subscriptionStatus, subscriptionRenewDate, createdAt } = shop;
  const { error } = await getClient().rpc('quickprint_create_shop', {
    target_shop: shop.id,
    public_profile: customerShopProfile(shop),
    shop_management: { ownerName, ownerPhone, monthlySubscriptionFee, subscriptionStatus, subscriptionRenewDate, createdAt },
    owner_email: ownerEmail,
  });
  if (error?.code === '23505') throw new Error('That shop URL is already taken.');
  if (error) throw error;
}

export async function updatePublishedShop(shop: Shop) {
  const { error } = await getClient().rpc('quickprint_update_shop', {
    target_shop: shop.id, public_profile: customerShopProfile(shop),
  });
  if (error) throw error;
}

export async function assignShopCounter(shopId: string, email: string) {
  const { error } = await getClient().rpc('quickprint_set_counter_email', {
    target_shop: shopId, owner_email: email,
  });
  if (error) throw error;
}

export async function archivePublishedShop(shopId: string) {
  const { error } = await getClient().rpc('quickprint_archive_shop', { target_shop: shopId });
  if (error) throw error;
}

export async function uploadOrderAttachment(path: string, blob: Blob) {
  const { error } = await getClient().storage.from(bucket).upload(path, blob, {
    contentType: blob.type || 'application/octet-stream',
  });
  if (error) throw error;
}

export async function downloadOrderAttachment(path: string): Promise<Blob> {
  const { data, error } = await getClient().storage.from(bucket).download(path);
  if (error) throw error;
  return data;
}

export async function removeOrderAttachmentPaths(paths: string[]): Promise<boolean> {
  if (paths.length === 0) return true;
  const { error } = await getClient().storage.from(bucket).remove(paths);
  return !error;
}
