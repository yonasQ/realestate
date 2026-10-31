import 'server-only'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/lib/env'
import * as schema from './schema'

export type Database = PostgresJsDatabase<typeof schema>

/**
 * One pool per server process. Stored on globalThis so Next.js dev hot-reload
 * does not leak a new pool on every module re-evaluation.
 */
const globalForDb = globalThis as unknown as { __realtorSql?: postgres.Sql; __realtorDb?: Database }

function createClient(): postgres.Sql {
  const e = env()
  return postgres(e.DATABASE_URL, {
    max: e.DATABASE_POOL_MAX,
    idle_timeout: 30,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    prepare: true,
    onnotice: () => {},
    connection: {
      application_name: 'realtor-web',
      // Bound every statement so a slow query cannot pin a pool slot indefinitely.
      statement_timeout: 10_000,
      idle_in_transaction_session_timeout: 15_000,
    },
  })
}

export function sqlClient(): postgres.Sql {
  if (!globalForDb.__realtorSql) globalForDb.__realtorSql = createClient()
  return globalForDb.__realtorSql
}

export function db(): Database {
  if (!globalForDb.__realtorDb) globalForDb.__realtorDb = drizzle(sqlClient(), { schema })
  return globalForDb.__realtorDb
}

export async function closeDb(): Promise<void> {
  const client = globalForDb.__realtorSql
  globalForDb.__realtorSql = undefined
  globalForDb.__realtorDb = undefined
  if (client) await client.end({ timeout: 5 })
}
