/** Public site origin (no trailing slash). Safe to call at build and request time. */
export function siteUrl(): string {
  return (process.env.SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')
}

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path
  return `${siteUrl()}${path.startsWith('/') ? '' : '/'}${path}`
}

/** Serialises JSON-LD safely for embedding in a <script> tag (prevents </script> breakout). */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}
