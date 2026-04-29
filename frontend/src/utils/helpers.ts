export function formatDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateTime(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    new: 'Новая',
    in_progress: 'В работе',
    waiting_parts: 'Ожид. запчастей',
    waiting_client: 'Ожид. клиента',
    done: 'Выполнена',
    cancelled: 'Отменена',
  }
  return map[status] || status
}

export function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    new: 'badge-new',
    in_progress: 'badge-progress',
    waiting_parts: 'badge-waiting',
    waiting_client: 'badge-waiting',
    done: 'badge-done',
    cancelled: 'badge-cancelled',
  }
  return map[status] || 'badge-new'
}

// Инициалы компании — пропускаем организационно-правовые формы
const LEGAL_FORMS = new Set(['ООО', 'ОАО', 'ЗАО', 'ПАО', 'АО', 'ИП', 'НКО', 'АНО', 'ГУП', 'МУП', 'ФГУП', 'ГК', 'АНП'])
export function companyInitials(name: string): string {
  if (!name) return '?'
  const words = name
    .replace(/[«»"']/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0 && !LEGAL_FORMS.has(w.toUpperCase()))
  if (words.length === 0) return name.slice(0, 2).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

export const STATUS_OPTIONS = [
  { value: 'new', label: 'Новая' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'waiting_parts', label: 'Ожидание запчастей' },
  { value: 'waiting_client', label: 'Ожидание клиента' },
  { value: 'done', label: 'Выполнена' },
  { value: 'cancelled', label: 'Отменена' },
]

// Цвета стандартных статусов (используются когда кастомный цвет не задан)
const STANDARD_STATUS_COLORS: Record<string, string> = {
  new: '#6B7280',
  in_progress: '#2563EB',
  waiting_parts: '#D97706',
  waiting_client: '#7C3AED',
  done: '#16A34A',
  cancelled: '#DC2626',
}

// Возвращает реальные label и color для статуса.
// Сначала ищет в type_statuses типа заявки (кастомные с цветом из настроек),
// потом fallback на стандартные.
export function getStatusInfo(status: string, typeStatuses?: any[]): { label: string; color: string } {
  if (Array.isArray(typeStatuses)) {
    for (const s of typeStatuses) {
      if (typeof s === 'object' && s !== null) {
        const key = s.key || s.value
        if (key === status) {
          return {
            label: s.label || statusLabel(status),
            color: s.color || STANDARD_STATUS_COLORS[status] || '#6B7280',
          }
        }
      }
    }
  }
  return {
    label: statusLabel(status),
    color: STANDARD_STATUS_COLORS[status] || '#6B7280',
  }
}

// Inline-стиль бейджа на основе цвета статуса
export function statusBadgeStyle(color: string) {
  return {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: 5,
    padding: '2px 10px',
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    background: color + '20',  // 12% прозрачность
    color: color,
    whiteSpace: 'nowrap' as const,
  }
}
