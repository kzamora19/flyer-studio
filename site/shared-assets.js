// Shared Asset Library service. Staging: not loaded by site/index.html yet.
// Provide an existing authenticated Supabase JS client; never use service-role keys here.
const BUCKET = 'flyer-shared-assets';
const TABLE = 'flyer_shared_assets';
const CATEGORIES = new Set(['logos','banners','backgrounds','templates','decorations','other']);
const TYPES = new Set(['image/png','image/jpeg','image/webp']);
const MAX_SIZE = 10 * 1024 * 1024;

function checkFile(file) {
  if (!file || !TYPES.has(file.type) || file.size < 1 || file.size > MAX_SIZE) {
    throw new Error('Use a PNG, JPG or WebP image up to 10 MB.');
  }
}
function checkName(name) {
  const value = String(name ?? '').trim();
  if (value.length < 1 || value.length > 120) throw new Error('Asset name must be 1–120 characters.');
  return value;
}
function requireOk(result) {
  if (result.error) throw result.error;
  return result.data;
}
export function createSharedAssetLibrary(supabase) {
  if (!supabase?.auth || !supabase?.storage || !supabase?.from) throw new Error('Authenticated Supabase client required.');
  const bucket = supabase.storage.from(BUCKET);
  async function currentUser() {
    const { data: { user } = {}, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Sign in before accessing shared assets.');
    return user;
  }
  async function membership() {
    const user = await currentUser();
    const row = requireOk(await supabase.from('flyer_asset_memberships')
      .select('can_view,can_manage').eq('user_id', user.id).single());
    if (!row.can_view) throw new Error('Your account cannot access shared assets.');
    return row;
  }
  async function requireManager() {
    const member = await membership();
    if (!member.can_manage) throw new Error('Only authorized asset managers can make changes.');
    return currentUser();
  }
  return {
    membership,
    async list({ category, search = '' } = {}) {
      await membership();
      if (category && !CATEGORIES.has(category)) throw new Error('Unknown category.');
      let q = supabase.from(TABLE).select('id,name,category,storage_path,mime_type,byte_size,created_at,updated_at')
        .order('name', { ascending: true }).limit(500);
      if (category) q = q.eq('category', category);
      if (search.trim()) q = q.ilike('name', '%' + search.trim().replace(/[%_\\]/g, '\\$&') + '%');
      return requireOk(await q);
    },
    async previewUrl(asset, expiresIn = 300) {
      await membership();
      if (!asset?.storage_path) throw new Error('Missing asset path.');
      return requireOk(await bucket.createSignedUrl(asset.storage_path, expiresIn)).signedUrl;
    },
    async add(file, { name, category }) {
      const user = await requireManager();
      checkFile(file);
      if (!CATEGORIES.has(category)) throw new Error('Unknown category.');
      const filename = crypto.randomUUID() + ({'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[file.type]);
      const path = user.id + '/' + filename;
      requireOk(await bucket.upload(path, file, { contentType: file.type, upsert: false }));
      try {
        return requireOk(await supabase.from(TABLE).insert({
          name: checkName(name), category, storage_path: path,
          mime_type: file.type, byte_size: file.size,
          created_by: user.id, updated_by: user.id
        }).select().single());
      } catch (error) {
        await bucket.remove([path]).catch(() => {});
        throw error;
      }
    },
    async rename(id, name) {
      const user = await requireManager();
      return requireOk(await supabase.from(TABLE).update({
        name: checkName(name), updated_by: user.id, updated_at: new Date().toISOString()
      }).eq('id', id).select().single());
    },
    async remove(asset) {
      await requireManager();
      // Remove the metadata first; an orphaned private file is safer than a broken visible asset.
      requireOk(await supabase.from(TABLE).delete().eq('id', asset.id));
      const res = await bucket.remove([asset.storage_path]);
      return { deleted: true, cleanupError: res.error?.message ?? null };
    },
    async replace(asset, file) {
      const user = await requireManager();
      checkFile(file);
      const ext = {'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp'}[file.type];
      const path = user.id + '/' + crypto.randomUUID() + ext;
      requireOk(await bucket.upload(path, file, { contentType: file.type, upsert: false }));
      let updated;
      try {
        updated = requireOk(await supabase.from(TABLE).update({
          storage_path: path, mime_type: file.type, byte_size: file.size,
          updated_by: user.id, updated_at: new Date().toISOString()
        }).eq('id', asset.id).select().single());
      } catch (error) {
        await bucket.remove([path]).catch(() => {});
        throw error;
      }
      const cleanup = await bucket.remove([asset.storage_path]);
      return { asset: updated, cleanupError: cleanup.error?.message ?? null };
    }
  };
}
