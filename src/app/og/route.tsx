import { ImageResponse } from 'next/og'
import { connection } from 'next/server'
import { getSettings } from '@/lib/queries/settings'

/** Default 1200x630 share card for pages that have no photo of their own (Facebook, WhatsApp, Telegram, LinkedIn, X). */
export async function GET() {
  await connection()
  const s = await getSettings()
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: 80,
          background: '#1c1b19',
          color: '#f6f1e8',
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 6, textTransform: 'uppercase', color: '#c29a63' }}>
          {`${s.developerName} · Addis Ababa`}
        </div>
        <div style={{ fontSize: 88, lineHeight: 1.05, marginTop: 24 }}>{s.brandName}</div>
        {s.brandTagline ? <div style={{ fontSize: 34, marginTop: 20, opacity: 0.8 }}>{s.brandTagline}</div> : null}
      </div>
    ),
    { width: 1200, height: 630, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } },
  )
}
