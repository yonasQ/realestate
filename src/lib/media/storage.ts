import 'server-only'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { env } from '@/lib/env'

/**
 * Local-filesystem object storage. Production mounts STORAGE_DIR on a persistent,
 * backed-up volume. The interface is deliberately tiny (put/get/delete by key) so
 * an S3/R2 driver can replace it without touching callers.
 */
const KEY_RE = /^[a-z0-9][a-z0-9/_.-]{0,200}$/

export function assertSafeKey(key: string): void {
  if (!KEY_RE.test(key) || key.includes('..') || key.includes('//')) {
    throw new Error('Invalid storage key')
  }
}

function root(): string {
  return path.resolve(env().STORAGE_DIR)
}

function resolveKey(key: string): string {
  assertSafeKey(key)
  const base = root()
  const full = path.resolve(base, key)
  if (!full.startsWith(base + path.sep)) throw new Error('Invalid storage key')
  return full
}

/** Atomic write: temp file + rename, so readers never see a partial file. */
export async function putObject(key: string, data: Buffer): Promise<void> {
  const full = resolveKey(key)
  await mkdir(path.dirname(full), { recursive: true })
  const tmp = `${full}.${randomUUID()}.tmp`
  await writeFile(tmp, data, { mode: 0o640 })
  await rename(tmp, full)
}

export async function getObject(key: string): Promise<{ data: Buffer; size: number } | null> {
  let full: string
  try {
    full = resolveKey(key)
  } catch {
    return null
  }
  try {
    const s = await stat(full)
    if (!s.isFile()) return null
    return { data: await readFile(full), size: s.size }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

export async function deleteObject(key: string): Promise<void> {
  await rm(resolveKey(key), { force: true })
}
