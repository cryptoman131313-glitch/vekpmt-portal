// Stale-while-revalidate кэш: данные показываются мгновенно из памяти/localStorage,
// API в фоне обновляет. Переживает закрытие вкладки и браузера.
// При логауте обязательно вызывать clearAllCache().

const memStore: Record<string, any> = {}
const LS_PREFIX = 'cache:'

export function getCache(key: string) {
  if (key in memStore) return memStore[key]
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    if (raw) {
      const data = JSON.parse(raw)
      memStore[key] = data
      return data
    }
  } catch {}
  return null
}

export function setCache(key: string, data: any) {
  memStore[key] = data
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(data))
  } catch {
    // Переполнение localStorage — чистим старые ключи кэша и пробуем ещё раз
    try {
      Object.keys(localStorage).forEach(k => { if (k.startsWith(LS_PREFIX)) localStorage.removeItem(k) })
      localStorage.setItem(LS_PREFIX + key, JSON.stringify(data))
    } catch {}
  }
}

export function invalidateCache(key: string) {
  delete memStore[key]
  try { localStorage.removeItem(LS_PREFIX + key) } catch {}
}

export function invalidatePrefix(prefix: string) {
  Object.keys(memStore).forEach(k => { if (k.startsWith(prefix)) delete memStore[k] })
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(LS_PREFIX + prefix)) localStorage.removeItem(k)
    })
  } catch {}
}

// Полная очистка кэша — вызывать при логауте, смене аккаунта, истечении токена
export function clearAllCache() {
  Object.keys(memStore).forEach(k => delete memStore[k])
  try {
    Object.keys(localStorage).forEach(k => { if (k.startsWith(LS_PREFIX)) localStorage.removeItem(k) })
  } catch {}
}
