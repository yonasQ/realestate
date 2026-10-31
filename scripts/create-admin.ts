/**
 * Creates (or resets the password of) an admin user. There is no public sign-up.
 *
 *   pnpm admin:create --email you@example.com --name "Your Name" [--role admin|editor]
 *
 * The password is read from the ADMIN_PASSWORD env var or prompted (hidden) on a TTY;
 * it is never accepted as a CLI argument (would leak into shell history / ps).
 */
import { createInterface } from 'node:readline'
import { sql } from 'drizzle-orm'
import { closeDb, db } from '@/lib/db/client'
import { adminUsers, sessions } from '@/lib/db/schema'
import { hashPassword, passwordProblem } from '@/lib/auth/password'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

async function promptHidden(q: string): Promise<string> {
  if (!process.stdin.isTTY) throw new Error('Set ADMIN_PASSWORD or run in an interactive terminal')
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream }
  let muted = false
  out._writeToOutput = (s: string) => { if (!muted) out.output.write(s) }
  return new Promise((resolve) => {
    rl.question(q, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer) })
    muted = true
  })
}

async function main() {
  const email = arg('email')?.trim().toLowerCase()
  const name = arg('name')?.trim()
  const role = (arg('role') ?? 'admin') as 'admin' | 'editor'
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('--email is required')
  if (!name) throw new Error('--name is required')
  if (role !== 'admin' && role !== 'editor') throw new Error('--role must be admin or editor')
  const password = process.env.ADMIN_PASSWORD ?? (await promptHidden('Password (min 12 chars): '))
  const problem = passwordProblem(password, email)
  if (problem) throw new Error(problem)
  const passwordHash = await hashPassword(password)
  const existing = await db().select({ id: adminUsers.id }).from(adminUsers).where(sql`lower(${adminUsers.email}) = ${email}`).limit(1)
  const rows = existing[0]
    ? await db()
        .update(adminUsers)
        .set({ name, role, passwordHash, failedLoginCount: 0, lockedUntil: null, disabledAt: null, updatedAt: new Date() })
        .where(sql`${adminUsers.id} = ${existing[0].id}`)
        .returning({ id: adminUsers.id })
    : await db().insert(adminUsers).values({ email, name, role, passwordHash }).returning({ id: adminUsers.id })
  // A password reset must invalidate existing sessions.
  await db().delete(sessions).where(sql`${sessions.userId} = ${rows[0]!.id}`)
  console.log(JSON.stringify({ level: 'info', event: 'admin.upserted', email, role }))
}

main()
  .catch((err) => {
    console.error(JSON.stringify({ level: 'error', event: 'admin.create_failed', message: String(err?.message ?? err) }))
    process.exitCode = 1
  })
  .finally(() => closeDb())
