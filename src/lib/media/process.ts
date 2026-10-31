import 'server-only'
import { randomUUID } from 'node:crypto'
import sharp from 'sharp'
import type { MediaVariant } from '@/lib/db/schema'
import { deleteObject, putObject } from './storage'

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
export const ACCEPTED_FORMATS = ['jpeg', 'png', 'webp', 'avif'] as const
export const VARIANT_WIDTHS = [480, 960, 1600, 2400] as const
const MAX_INPUT_PIXELS = 60_000_000 // ~60 MP: blocks decompression bombs

export class ImageRejectedError extends Error {}

export type ProcessedImage = {
  storageKey: string
  mime: string
  width: number
  height: number
  bytes: number
  variants: MediaVariant[]
  dominantColor: string
}

/**
 * Validates an untrusted image by decoding it (never trusting extension or
 * client MIME), normalises orientation, strips metadata (EXIF/GPS) and writes
 * WebP variants. Returns the record to persist in `media`.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.byteLength === 0) throw new ImageRejectedError('File is empty')
  if (input.byteLength > MAX_UPLOAD_BYTES) throw new ImageRejectedError('File exceeds 15 MB')

  let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' }).metadata()
  } catch {
    throw new ImageRejectedError('File is not a readable image')
  }
  const format = meta.format as string | undefined
  if (!format || !(ACCEPTED_FORMATS as readonly string[]).includes(format)) {
    throw new ImageRejectedError('Only JPEG, PNG, WebP or AVIF images are accepted')
  }
  if ((meta.pages ?? 1) > 1) throw new ImageRejectedError('Animated images are not supported')

  // Orientation-corrected base pipeline.
  const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' }).rotate()
  const { data: normalized, info } = await base.clone().toBuffer({ resolveWithObject: true })
  const width = info.width
  const height = info.height
  if (width < 200 || height < 150) throw new ImageRejectedError('Image is too small (minimum 200×150 px)')

  const stats = await sharp(normalized).stats()
  const d = stats.dominant
  const dominantColor = `#${[d.r, d.g, d.b].map((c) => c.toString(16).padStart(2, '0')).join('')}`

  const now = new Date()
  const storageKey = `media/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}`

  const widths: number[] = VARIANT_WIDTHS.filter((w) => w < width)
  widths.push(Math.min(width, VARIANT_WIDTHS[VARIANT_WIDTHS.length - 1]!))
  const uniqueWidths = [...new Set(widths)].sort((a, b) => a - b)

  const written: string[] = []
  try {
    const variants: MediaVariant[] = []
    for (const w of uniqueWidths) {
      const { data, info: vi } = await sharp(normalized)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: w <= 480 ? 72 : 78, effort: 4, smartSubsample: true })
        .toBuffer({ resolveWithObject: true })
      const key = `${storageKey}-${vi.width}.webp`
      await putObject(key, data)
      written.push(key)
      variants.push({ width: vi.width, height: vi.height, key, bytes: data.byteLength })
    }
    return {
      storageKey,
      mime: `image/${format}`,
      width,
      height,
      bytes: input.byteLength,
      variants,
      dominantColor,
    }
  } catch (err) {
    await Promise.allSettled(written.map((k) => deleteObject(k)))
    throw err
  }
}

export async function deleteProcessedImage(variants: MediaVariant[]): Promise<void> {
  await Promise.allSettled(variants.map((v) => deleteObject(v.key)))
}
