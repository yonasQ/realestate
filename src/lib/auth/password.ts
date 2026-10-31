import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

/**
 * scrypt (N=2^15, r=8, p=1, 64-byte key): memory-hard KDF from Node's standard
 * library, no native dependency. Encoded with parameters so they can be raised later.
 */
const N = 32768
const R = 8
const P = 1
const KEYLEN = 64
const MAXMEM = 64 * 1024 * 1024

function derive(password: string, salt: Buffer, n = N, r = R, p = P): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEYLEN, { N: n, r, p, maxmem: MAXMEM }, (err, key) => (err ? reject(err) : resolve(key))),
  )
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt)
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, n, r, p, saltB64, keyB64] = parts as [string, string, string, string, string, string]
  const expected = Buffer.from(keyB64, 'base64')
  const actual = await derive(password, Buffer.from(saltB64, 'base64'), Number(n), Number(r), Number(p))
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/** Used when the account does not exist, so response time doesn't reveal valid emails. */
export const DUMMY_HASH =
  'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='

export const PASSWORD_MIN_LENGTH = 12

export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters`
  if (password.length > 200) return 'Password is too long'
  if (email && password.toLowerCase().includes(email.split('@')[0]!.toLowerCase())) return 'Password must not contain your email name'
  if (/^(.)\1+$/.test(password)) return 'Password is too simple'
  return null
}
