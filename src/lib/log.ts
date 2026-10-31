/**
 * Minimal structured JSON logger. One line per event on stdout/stderr so any
 * log collector (Docker, journald, Loki, CloudWatch…) can parse it.
 *
 * Never pass raw personal data (names, emails, phones, message bodies) or
 * secrets in `fields`; log identifiers instead.
 */
type Level = 'debug' | 'info' | 'warn' | 'error'

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

function threshold(): number {
  const lvl = (process.env.LOG_LEVEL as Level | undefined) ?? (process.env.NODE_ENV === 'test' ? 'warn' : 'info')
  return ORDER[lvl] ?? ORDER.info
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack?.split('\n').slice(0, 8).join('\n') }
  }
  return { message: String(err) }
}

function write(level: Level, event: string, fields?: Record<string, unknown>) {
  if (ORDER[level] < threshold()) return
  const record: Record<string, unknown> = { ts: new Date().toISOString(), level, event }
  if (fields) {
    for (const [k, v] of Object.entries(fields)) {
      record[k] = k === 'err' || v instanceof Error ? serializeError(v) : v
    }
  }
  const line = JSON.stringify(record)
  if (level === 'error' || level === 'warn') process.stderr.write(line + '\n')
  else process.stdout.write(line + '\n')
}

export const log = {
  debug: (event: string, fields?: Record<string, unknown>) => write('debug', event, fields),
  info: (event: string, fields?: Record<string, unknown>) => write('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write('error', event, fields),
}
