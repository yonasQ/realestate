import { SettingsForm, SettingsImage } from '@/components/admin/SettingsForm'
import { getAdminSettings, mediaThumb } from '@/lib/admin/queries'
import { requireAdmin } from '@/lib/auth/session'

export default async function SettingsPage() {
  await requireAdmin('admin')
  const s = await getAdminSettings()
  if (!s) return <p>Settings row missing. Run <code>pnpm import:catalog</code> to initialise.</p>
  const [photo, hero] = await Promise.all([mediaThumb(s.realtorPhotoMediaId), mediaThumb(s.heroMediaId)])
  return (
    <div className="space-y-6">
      <h1 className="text-4xl">Site settings</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <SettingsImage field="realtorPhotoMediaId" label="Realtor portrait" thumbKey={photo} />
        <SettingsImage field="heroMediaId" label="Homepage hero image (defaults to first featured development)" thumbKey={hero} />
      </div>
      <SettingsForm s={s} />
    </div>
  )
}
