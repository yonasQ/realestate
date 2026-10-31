import type { MetadataRoute } from 'next'
import { connection } from 'next/server'
import { getSettings } from '@/lib/queries/settings'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  await connection()
  const s = await getSettings()
  return {
    name: s.brandName,
    short_name: s.brandName.slice(0, 12),
    description: s.brandTagline ?? undefined,
    start_url: '/',
    display: 'browser',
    background_color: '#f6f1e8',
    theme_color: '#f6f1e8',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  }
}
