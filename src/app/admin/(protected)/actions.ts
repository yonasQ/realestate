'use server'

import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { ContentError, appendImages, saveDevelopment, saveImages, saveProperty, saveSettings, setSettingsImage, updateInquiry } from '@/lib/admin/content-service'
import { storeUploads } from '@/lib/admin/media-service'
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/auth/password'
import { requireAdmin, revokeOtherSessions } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { adminUsers, auditLog } from '@/lib/db/schema'
import { INQUIRY_STATUSES } from '@/lib/domain'
import { requeueDelivery, processDueDeliveries } from '@/lib/inquiries/delivery'
import { log } from '@/lib/log'
import { CATALOG_TAG } from '@/lib/queries/catalog'
import { SETTINGS_TAG } from '@/lib/queries/settings'
import { RULES, hit } from '@/lib/security/rate-limit'
import { developmentFormSchema, imageListSchema, propertyFormSchema, settingsFormSchema } from '@/lib/validation/content'

/**
 * `values` echoes what was submitted: React 19 resets forms after an action, so the
 * forms re-seed their defaults from it (no lost input on errors, no stale values
 * after a successful save that a later save could silently revert).
 */
export type FormState = { ok?: boolean; error?: string; fields?: Record<string, string>; message?: string; version?: number; values?: Record<string, string> }

const uuid = z.string().uuid()

function zodFields(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const i of err.issues) {
    const k = String(i.path[0] ?? 'form')
    out[k] ??= i.message
  }
  return out
}

function fail(err: unknown): FormState {
  if (err instanceof ContentError) return { error: err.message, fields: err.fields }
  log.error('admin.action_failed', { err })
  return { error: 'Something went wrong while saving. Nothing was changed. Please try again.' }
}

function formObject(form: FormData): Record<string, string> {
  const o: Record<string, string> = {}
  for (const [k, v] of form.entries()) if (typeof v === 'string') o[k] = v
  return o
}

/** Public pages are cached; expire them immediately so edits show up on the next request. */
function invalidateCatalog() {
  updateTag(CATALOG_TAG)
}

// --- Properties -------------------------------------------------------------

export async function savePropertyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireAdmin()
  const id = form.get('id') ? String(form.get('id')) : null
  if (id && !uuid.safeParse(id).success) return { error: 'Invalid listing id' }
  const values = formObject(form)
  const parsed = propertyFormSchema.safeParse(values)
  if (!parsed.success) return { error: 'Please fix the highlighted fields.', fields: zodFields(parsed.error), values }
  let saved
  try {
    saved = await saveProperty(id, parsed.data, session.userId)
  } catch (err) {
    return { ...fail(err), values }
  }
  invalidateCatalog()
  if (!id) redirect(`/admin/properties/${saved.id}?created=1`)
  return { ok: true, message: 'Listing saved. Public pages are updated.', version: saved.version, values }
}

// --- Developments -----------------------------------------------------------

export async function saveDevelopmentAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireAdmin()
  const id = form.get('id') ? String(form.get('id')) : null
  if (id && !uuid.safeParse(id).success) return { error: 'Invalid development id' }
  const values = formObject(form)
  const parsed = developmentFormSchema.safeParse(values)
  if (!parsed.success) return { error: 'Please fix the highlighted fields.', fields: zodFields(parsed.error), values }
  let saved
  try {
    saved = await saveDevelopment(id, parsed.data, session.userId)
  } catch (err) {
    return { ...fail(err), values }
  }
  invalidateCatalog()
  if (!id) redirect(`/admin/developments/${saved.id}?created=1`)
  return { ok: true, message: 'Development saved. Public pages are updated.', version: saved.version, values }
}

// --- Images -----------------------------------------------------------------

const entitySchema = z.enum(['property', 'development'])

export async function saveImagesAction(entity: string, ownerId: string, payload: unknown, coverMediaId: string | null): Promise<FormState> {
  const session = await requireAdmin()
  const e = entitySchema.safeParse(entity)
  const id = uuid.safeParse(ownerId)
  const list = imageListSchema.safeParse(payload)
  const cover = coverMediaId === null ? null : uuid.safeParse(coverMediaId).success ? coverMediaId : null
  if (!e.success || !id.success || !list.success) return { error: 'Invalid image data. Reload and try again.' }
  try {
    await saveImages(e.data, id.data, list.data, cover, session.userId)
  } catch (err) {
    return fail(err)
  }
  invalidateCatalog()
  return { ok: true, message: 'Images saved.' }
}

export async function uploadImagesAction(entity: string, ownerId: string, form: FormData): Promise<FormState & { added?: number }> {
  const session = await requireAdmin()
  const e = entitySchema.safeParse(entity)
  const id = uuid.safeParse(ownerId)
  if (!e.success || !id.success) return { error: 'Invalid request' }
  const limit = await hit(RULES.uploadPerUser, session.userId)
  if (!limit.allowed) return { error: 'Upload limit reached. Please wait and try again.' }
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (!files.length) return { error: 'Choose one or more images.' }
  const altPrefix = String(form.get('alt') ?? '').slice(0, 200)
  const { ids, errors } = await storeUploads(files, session.userId, altPrefix)
  try {
    await appendImages(e.data, id.data, ids)
  } catch (err) {
    return fail(err)
  }
  if (ids.length) invalidateCatalog()
  return {
    ok: errors.length === 0,
    added: ids.length,
    message: ids.length ? `${ids.length} image${ids.length === 1 ? '' : 's'} added.` : undefined,
    error: errors.length ? errors.join(' · ') : undefined,
  }
}

// --- Inquiries --------------------------------------------------------------

export async function updateInquiryAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireAdmin()
  const id = uuid.safeParse(form.get('id'))
  const status = z.enum(INQUIRY_STATUSES).safeParse(form.get('status'))
  const notes = String(form.get('adminNotes') ?? '').trim().slice(0, 4000) || null
  if (!id.success || !status.success) return { error: 'Invalid request' }
  try {
    await updateInquiry(id.data, status.data, notes, session.userId)
  } catch (err) {
    return fail(err)
  }
  return { ok: true, message: 'Inquiry updated.' }
}

export async function retryDeliveryAction(form: FormData): Promise<void> {
  await requireAdmin()
  const id = uuid.safeParse(form.get('id'))
  if (!id.success) return
  await requeueDelivery(id.data)
  await processDueDeliveries(5)
}

// --- Settings ---------------------------------------------------------------

export async function saveSettingsAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireAdmin('admin')
  const values = formObject(form)
  const parsed = settingsFormSchema.safeParse(values)
  if (!parsed.success) return { error: 'Please fix the highlighted fields.', fields: zodFields(parsed.error), values }
  let version
  try {
    version = await saveSettings(parsed.data, session.userId)
  } catch (err) {
    return { ...fail(err), values }
  }
  updateTag(SETTINGS_TAG)
  return { ok: true, message: 'Settings saved.', version, values }
}

export async function uploadSettingsImageAction(field: string, form: FormData): Promise<FormState> {
  const session = await requireAdmin('admin')
  const f = z.enum(['realtorPhotoMediaId', 'heroMediaId']).safeParse(field)
  if (!f.success) return { error: 'Invalid field' }
  if (form.get('remove') === '1') {
    await setSettingsImage(f.data, null, session.userId)
    updateTag(SETTINGS_TAG)
    return { ok: true, message: 'Image removed.' }
  }
  const file = form.get('file')
  if (!(file instanceof File) || !file.size) return { error: 'Choose an image.' }
  const { ids, errors } = await storeUploads([file], session.userId, f.data === 'heroMediaId' ? 'Homepage hero image' : 'Realtor portrait')
  if (!ids[0]) return { error: errors.join(' ') || 'Upload failed' }
  await setSettingsImage(f.data, ids[0], session.userId)
  updateTag(SETTINGS_TAG)
  return { ok: true, message: 'Image updated.' }
}

// --- Account ----------------------------------------------------------------

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await requireAdmin()
  const current = String(form.get('current') ?? '')
  const next = String(form.get('next') ?? '')
  const confirm = String(form.get('confirm') ?? '')
  if (next !== confirm) return { fields: { confirm: 'Passwords do not match' }, error: 'Please fix the highlighted fields.' }
  const problem = passwordProblem(next, session.email)
  if (problem) return { fields: { next: problem }, error: 'Please fix the highlighted fields.' }
  const limit = await hit(RULES.loginPerEmail, `pw:${session.userId}`)
  if (!limit.allowed) return { error: 'Too many attempts. Please wait 15 minutes.' }
  const [user] = await db().select({ hash: adminUsers.passwordHash }).from(adminUsers).where(eq(adminUsers.id, session.userId)).limit(1)
  if (!user || !(await verifyPassword(current, user.hash))) return { fields: { current: 'Current password is incorrect' }, error: 'Please fix the highlighted fields.' }
  const passwordHash = await hashPassword(next) // CPU-heavy: compute before opening the transaction
  await db().transaction(async (tx) => {
    await tx.update(adminUsers).set({ passwordHash, updatedAt: new Date() }).where(eq(adminUsers.id, session.userId))
    await tx.insert(auditLog).values({ actorId: session.userId, action: 'password_change', entityType: 'admin_user', entityId: session.userId })
  })
  await revokeOtherSessions(session.userId, session.sessionId)
  return { ok: true, message: 'Password changed. Other devices have been signed out.' }
}
