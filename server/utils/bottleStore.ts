/**
 * Bottle storage: one key per bottle in the `bottles` mount (configured in
 * nuxt.config — a folder under .data by default; swap the driver for KV/Redis
 * on a serverless deploy). Bottles are written once and never edited, so
 * one-key-per-bottle needs no locking.
 *
 * With NUXT_BOTTLES_MODERATE=true new bottles are stored as pending: only
 * their writer sees them (via ?mine=) until `status` is flipped to
 * "published" in storage.
 */
import type { Bottle } from '#shared/utils/bottles'

export interface StoredBottle extends Bottle {
  status: 'published' | 'pending'
  ip: string
}

const store = () => useStorage<StoredBottle>('bottles')

export async function listBottles() {
  const s = store()
  const keys = await s.getKeys()
  const items = await Promise.all(keys.map(k => s.getItem(k)))
  return items.filter((b): b is StoredBottle => !!b)
}

export async function getBottle(id: string) {
  return store().getItem(id)
}

export async function saveBottle(b: StoredBottle) {
  await store().setItem(b.id, b)
}

/** What visitors get: no ip, no status */
export function toPublic({ id, message, name, melody, createdAt }: StoredBottle): Bottle {
  return { id, message, name, melody, createdAt }
}
