import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { supabaseServer } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
]);

/**
 * POST /api/posts/upload — upload a post screenshot to Vercel Blob, then
 * attach it to a `posts` row.
 *
 * Multipart body:
 *  - file: image/png|jpeg|webp|gif, up to 10 MB
 *  - post_id?: string  — attach to existing post (updates media_blob_url)
 *  - snapshot_id?: string + new post fields → create a new post row
 */
export async function POST(req: NextRequest) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'no file' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file too large (max 10MB)' }, { status: 413 });
  }
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `unsupported type: ${file.type}` },
      { status: 415 }
    );
  }

  const postId = form.get('post_id') as string | null;
  const snapshotId = form.get('snapshot_id') as string | null;

  const filename =
    (file as File).name && (file as File).name.length > 0
      ? (file as File).name
      : 'upload.bin';
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, '_');

  const blob = await put(`posts/${user.id}-${Date.now()}-${safeName}`, file, {
    access: 'public',
    token: process.env.BLOB_READ_WRITE_TOKEN
  });

  if (postId) {
    await sb
      .from('posts')
      .update({ media_blob_url: blob.url, thumb_blob_url: blob.url })
      .eq('id', postId);
    return NextResponse.json({ ok: true, url: blob.url, post_id: postId });
  }
  if (snapshotId) {
    const { data: snap } = await sb
      .from('snapshots')
      .select('account_id, platform')
      .eq('id', snapshotId)
      .maybeSingle();
    if (!snap) return NextResponse.json({ error: 'snapshot not found' }, { status: 404 });
    const { data: post } = await sb
      .from('posts')
      .insert({
        snapshot_id: snapshotId,
        account_id: snap.account_id,
        platform: snap.platform,
        media_blob_url: blob.url,
        thumb_blob_url: blob.url,
        is_top: true,
        title: form.get('title') as string,
        views: form.get('views') ? parseInt(form.get('views') as string, 10) : null,
        likes: form.get('likes') ? parseInt(form.get('likes') as string, 10) : null
      })
      .select('id')
      .single();
    return NextResponse.json({ ok: true, url: blob.url, post_id: post?.id });
  }

  return NextResponse.json({ ok: true, url: blob.url });
}
