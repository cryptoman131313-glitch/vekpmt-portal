import { useEffect, useState, useCallback, useRef } from 'react'
import { getCache, setCache } from '../api/cache'

// Stale-while-revalidate хук:
// - Сразу возвращает данные из кэша (если есть) — UI не пустой
// - Параллельно вызывает fetcher, обновляет state и кэш
// - loading=true только если нет ни кэша, ни данных (самый первый заход)
//
// Использование:
//   const { data, loading, refetch } = useSwr('clients_list', () => api.get('/clients').then(r => r.data))
//   if (loading) return <Skeleton />
//   return <List items={data || []} />
export function useSwr<T = any>(key: string | null, fetcher: () => Promise<T>) {
  const cached = key ? (getCache(key) as T | null) : null
  const [data, setData] = useState<T | null>(cached)
  const [loading, setLoading] = useState<boolean>(cached === null)
  const [error, setError] = useState<any>(null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refetch = useCallback(async () => {
    if (!key) return
    try {
      const result = await fetcherRef.current()
      setData(result)
      setCache(key, result)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [key])

  useEffect(() => {
    if (!key) return
    // При смене key — синхронизируем data из кэша мгновенно
    const fresh = getCache(key) as T | null
    if (fresh !== null) {
      setData(fresh)
      setLoading(false)
    } else {
      setLoading(true)
    }
    refetch()
  }, [key, refetch])

  return { data, loading, error, refetch, setData }
}
