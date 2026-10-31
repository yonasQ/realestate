/**
 * Finds storage files with no media row, and media rows referenced by nothing.
 *   pnpm media:prune            # dry run: report only
 *   pnpm media:prune --apply    # delete them
 * Media rows younger than 24h are never deleted (an upload may still be in progress).
 */
import { readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import { closeDb, db } from '@/lib/db/client'
import { env } from '@/lib/env'
import type { MediaVariant } from '@/lib/db/schema'

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(full)))
    else out.push(full)
  }
  return out
}

async function main() {
  const apply = process.argv.includes('--apply')
  const root = path.resolve(env().STORAGE_DIR)
  const unreferenced = (await db().execute(sql`
    SELECT m.id, m.variants FROM media m
    WHERE m.created_at < now() - interval '24 hours'
      AND NOT EXISTS (SELECT 1 FROM property_images x WHERE x.media_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM development_images x WHERE x.media_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM properties x WHERE x.cover_media_id = m.id OR x.og_media_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM developments x WHERE x.cover_media_id = m.id OR x.og_media_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM site_settings x WHERE x.realtor_photo_media_id = m.id OR x.hero_media_id = m.id)`)) as unknown as { id: string; variants: MediaVariant[] }[]
  const rows = (await db().execute(sql`SELECT variants FROM media`)) as unknown as { variants: MediaVariant[] }[]
  const known = new Set(rows.flatMap((r) => r.variants.map((v) => path.join(root, v.key))))
  const orphanFiles: string[] = []
  let orphanBytes = 0
  for (const f of await walk(path.join(root, 'media'))) {
    if (!known.has(f)) {
      orphanFiles.push(f)
      orphanBytes += (await stat(f)).size
    }
  }
  console.log(JSON.stringify({ event: 'media.prune', apply, unreferencedMedia: unreferenced.length, orphanFiles: orphanFiles.length, orphanMB: +(orphanBytes / 1048576).toFixed(1) }))
  if (!apply) return
  for (const f of orphanFiles) await rm(f, { force: true })
  for (const m of unreferenced) {
    await db().execute(sql`DELETE FROM media WHERE id = ${m.id}`)
    for (const v of m.variants) await rm(path.join(root, v.key), { force: true })
  }
}

main()
  .catch((err) => {
    console.error(JSON.stringify({ level: 'error', event: 'media.prune_failed', message: String(err?.message ?? err) }))
    process.exitCode = 1
  })
  .finally(() => closeDb())
