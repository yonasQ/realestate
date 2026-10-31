import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { media, siteSettings, type SiteSettings } from '@/lib/db/schema'
import { DEFAULT_SITE_SETTINGS } from '@/lib/content/defaults'
import { log } from '@/lib/log'
import type { PublicImage } from './catalog'

export const SETTINGS_TAG = 'settings'

export type PublicSettings = Omit<SiteSettings, 'updatedAt' | 'version'> & {
  realtorPhoto: PublicImage | null
  heroImage: PublicImage | null
}

async function mediaById(id: string | null): Promise<PublicImage | null> {
  if (!id) return null
  const rows = await db()
    .select({
      id: media.id,
      alt: media.alt,
      width: media.width,
      height: media.height,
      variants: media.variants,
      dominantColor: media.dominantColor,
    })
    .from(media)
    .where(eq(media.id, id))
    .limit(1)
  return rows[0] ?? null
}

const load = unstable_cache(
  async (): Promise<PublicSettings> => {
    const rows = await db().select().from(siteSettings).where(eq(siteSettings.id, 1)).limit(1)
    const row = rows[0]
    if (!row) {
      log.warn('settings.missing_row', { hint: 'run pnpm import:catalog' })
      return {
        ...DEFAULT_SITE_SETTINGS,
        realtorPhotoMediaId: null,
        heroMediaId: null,
        social: {},
        realtorPhoto: null,
        heroImage: null,
      }
    }
    const { updatedAt: _u, version: _v, ...rest } = row
    const [realtorPhoto, heroImage] = await Promise.all([mediaById(row.realtorPhotoMediaId), mediaById(row.heroMediaId)])
    return { ...rest, realtorPhoto, heroImage }
  },
  ['site-settings-v1'],
  { tags: [SETTINGS_TAG], revalidate: 900 },
)

export const getSettings = cache(() => load())
