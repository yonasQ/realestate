/** Retries due inquiry notifications once and exits (alternative to the HTTP cron endpoint). */
import { closeDb } from '@/lib/db/client'
import { processDueDeliveries } from '@/lib/inquiries/delivery'

processDueDeliveries(50)
  .then((r) => console.log(JSON.stringify({ level: 'info', event: 'notifications.processed', ...r })))
  .catch((err) => {
    console.error(JSON.stringify({ level: 'error', event: 'notifications.failed', message: String(err?.message ?? err) }))
    process.exitCode = 1
  })
  .finally(() => closeDb())
