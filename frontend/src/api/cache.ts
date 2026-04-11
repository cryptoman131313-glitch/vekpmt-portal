// Простой in-memory кэш — живёт пока открыта вкладка браузера
// При повторном заходе на страницу данные показываются мгновенно, фоновый запрос обновляет

const store: Record<string, { data: any; ts: number }> = {}
const TTL = 30_000 // 30 секунд

export function getCache(key: string) {
  const entry = store[key]
  if (!entry) return null
  if (Date.now() - entry.ts > TTL) { delete store[key]; return null }
  return entry.data
}

export function setCache(key: string, data: any) {
  store[key] = { data, ts: Date.now() }
}

export function invalidateCache(key: string) {
  delete store[key]
}

export function invalidatePrefix(prefix: string) {
  Object.keys(store).forEach(k => { if (k.startsWith(prefix)) delete store[k] })
}
