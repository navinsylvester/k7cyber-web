import 'server-only'

/* A per-process memo for reference data (products, categories, geography, views, chart definitions): shared across users,
   refreshed hourly, never used for per-user lists (07-production-safety.md §3). */

const store = new Map<string, { exp: number; value: Promise<unknown> }>()

export const HOUR = 60 * 60 * 1000

export const memo = <T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> => {
  const hit = store.get(key)
  if (hit && hit.exp > Date.now()) return hit.value as Promise<T>
  const value = fn().catch((e) => {
    store.delete(key)
    throw e
  })
  store.set(key, { exp: Date.now() + ttlMs, value })
  return value
}

export const forget = (prefix: string): void => {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k)
}
