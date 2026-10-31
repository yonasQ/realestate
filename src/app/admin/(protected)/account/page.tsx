import { PasswordForm } from '@/components/admin/PasswordForm'
import { requireAdmin } from '@/lib/auth/session'

export default async function AccountPage() {
  const s = await requireAdmin()
  return (
    <div className="space-y-6">
      <h1 className="text-4xl">My account</h1>
      <p className="text-stone">{s.name} · {s.email} · {s.role}</p>
      <h2 className="text-2xl">Change password</h2>
      <PasswordForm />
    </div>
  )
}
