import { getObject } from '@/lib/media/storage'

/**
 * Serves processed image variants from storage. Keys contain a random UUID and
 * are never overwritten, so responses are immutable and safe to cache at a CDN.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params
  const path = ['media', ...key].join('/')
  if (!path.endsWith('.webp')) return new Response('Not found', { status: 404 })
  const obj = await getObject(path)
  if (!obj) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } })
  return new Response(new Uint8Array(obj.data), {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(obj.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
