import { createClient } from '@supabase/supabase-js';

const projectUrl = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = projectUrl && publishableKey ? createClient(projectUrl, publishableKey) : null;
const bucket = 'print-files';

export const usesSupabase = Boolean(supabase);
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
  const { data, error } = await supabase
    .from('quickprint_shop_staff')
    .select('shop_id')
    .eq('shop_id', shopId)
    .maybeSingle();
  const allowed = !error && Boolean(data);
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
  if (supabase) await supabase.auth.signOut({ scope: 'local' });
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
