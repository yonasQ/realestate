import 'server-only'
import { db } from '@/lib/db/client'
import { media } from '@/lib/db/schema'
import { log } from '@/lib/log'
import { ImageRejectedError, MAX_UPLOAD_BYTES, deleteProcessedImage, processImage } from '@/lib/media/process'

export const MAX_FILES_PER_UPLOAD = 10

export type UploadOutcome = { ids: string[]; errors: string[] }

/**
 * Validates and stores uploaded images. Files are processed one at a time to
 * bound memory/CPU (sharp is already multi-threaded internally).
 */
export async function storeUploads(files: File[], actorId: string, altPrefix: string): Promise<UploadOutcome> {
  const ids: string[] = []
  const errors: string[] = []
  if (files.length > MAX_FILES_PER_UPLOAD) {
    return { ids, errors: [`Upload at most ${MAX_FILES_PER_UPLOAD} images at a time.`] }
  }
  for (const file of files) {
    const name = file.name.replace(/[^\w.\- ]+/g, '_').slice(0, 120)
    if (file.size > MAX_UPLOAD_BYTES) {
      errors.push(`${name}: larger than 15 MB`)
      continue
    }
    try {
      const processed = await processImage(Buffer.from(await file.arrayBuffer()))
      try {
        const [row] = await db()
          .insert(media)
          .values({
            storageKey: processed.storageKey,
            mime: processed.mime,
            width: processed.width,
            height: processed.height,
            bytes: processed.bytes,
            variants: processed.variants,
            dominantColor: processed.dominantColor,
            alt: altPrefix,
            originalFilename: name,
            createdBy: actorId,
          })
          .returning({ id: media.id })
        ids.push(row!.id)
      } catch (err) {
        await deleteProcessedImage(processed.variants)
        throw err
      }
    } catch (err) {
      if (err instanceof ImageRejectedError) errors.push(`${name}: ${err.message}`)
      else {
        log.error('media.upload_failed', { err, actorId })
        errors.push(`${name}: could not be processed`)
      }
    }
  }
  return { ids, errors }
}
