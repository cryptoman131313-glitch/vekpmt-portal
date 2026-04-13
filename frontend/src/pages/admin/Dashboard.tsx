import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { getCache, setCache } from '../../api/cache'
import { formatDate, statusLabel, statusBadgeClass } from '../../utils/helpers'
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Clock, Pencil } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

interface Ticket { id: number; company_name: string; type_name: string; status: string; created_at: string; equipment_model: string }

interface CalendarEvent {
  id: string
  title: string
  description: string | null
  event_date: string
  event_time: string | null
  type: 'general' | 'personal' | 'ticket'
  ticket_id: number | null
  created_by: string
  created_by_name: string
}

const EVENT_TYPES = [
  { value: 'general', label: 'Общее', color: '#3B82F6', bg: '#EFF6FF' },
  { value: 'personal', label: 'Личное', color: '#16A34A', bg: '#F0FDF4' },
  { value: 'ticket', label: 'По заявке', color: '#CC0033', bg: '#FFF1F2' },
]

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

function typeStyle(type: string) {
  return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[0]
}

function eventCountLabel(n: number) {
  const mod10 = n % 10, mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return `${n} событий`
  if (mod10 === 1) return `${n} событие`
  if (mod10 >= 2 && mod10 <= 4) return `${n} события`
  return `${n} событий`
}

function formatTime(t: string | null) {
  if (!t) return ''
  return t.slice(0, 5)
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const today = new Date()
  const [curYear, setCurYear] = useState(today.getFullYear())
  const [curMonth, setCurMonth] = useState(today.getMonth() + 1)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null)
  const [form, setForm] = useState({ title: '', description: '', event_date: '', event_time: '', type: 'general', ticket_id: '' })

  useEffect(() => {
    const cached = getCache('dashboard_tickets')
    if (cached) setTickets(cached)
    api.get('/tickets?limit=6').then(r => { setCache('dashboard_tickets', r.data.tickets || []); setTickets(r.data.tickets || []) }).catch(() => {})
  }, [])

  useEffect(() => {
    loadEvents()
  }, [curYear, curMonth])

  const loadEvents = () => {
    api.get(`/calendar?year=${curYear}&month=${curMonth}`)
      .then(r => setEvents(r.data))
      .catch(() => {})
  }

  const prevMonth = () => {
    if (curMonth === 1) { setCurYear(y => y - 1); setCurMonth(12) }
    else setCurMonth(m => m - 1)
    setSelectedDay(null)
  }
  const nextMonth = () => {
    if (curMonth === 12) { setCurYear(y => y + 1); setCurMonth(1) }
    else setCurMonth(m => m + 1)
    setSelectedDay(null)
  }
  const goToday = () => { setCurYear(today.getFullYear()); setCurMonth(today.getMonth() + 1); setSelectedDay(today.getDate()) }

  // Построение сетки календаря
  const firstDow = new Date(curYear, curMonth - 1, 1).getDay() // 0=Sun
  const firstOffset = firstDow === 0 ? 6 : firstDow - 1 // смещение для Пн=0
  const daysInMonth = new Date(curYear, curMonth, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const eventsForDay = (day: number) => {
    const dateStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.event_date.slice(0, 10) === dateStr)
  }

  const isToday = (day: number) =>
    day === today.getDate() && curMonth === today.getMonth() + 1 && curYear === today.getFullYear()

  const openCreateForm = (day: number) => {
    const dateStr = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setForm({ title: '', description: '', event_date: dateStr, event_time: '', type: 'general', ticket_id: '' })
    setEditEvent(null)
    setShowForm(true)
  }

  const openEditForm = (e: CalendarEvent) => {
    setForm({
      title: e.title, description: e.description || '',
      event_date: e.event_date.slice(0, 10),
      event_time: e.event_time ? e.event_time.slice(0, 5) : '',
      type: e.type, ticket_id: e.ticket_id ? String(e.ticket_id) : ''
    })
    setEditEvent(e)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Введите название'); return }
    try {
      const payload = {
        title: form.title, description: form.description || null,
        event_date: form.event_date, event_time: form.event_time || null,
        type: form.type, ticket_id: form.ticket_id ? Number(form.ticket_id) : null
      }
      if (editEvent) {
        await api.patch(`/calendar/${editEvent.id}`, payload)
        toast.success('Событие обновлено')
      } else {
        await api.post('/calendar', payload)
        toast.success('Событие добавлено')
      }
      setShowForm(false)
      loadEvents()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Ошибка сервера') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить событие?')) return
    try {
      await api.delete(`/calendar/${id}`)
      toast.success('Удалено')
      loadEvents()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Ошибка сервера') }
  }

  const selectedDayEvents = selectedDay ? eventsForDay(selectedDay) : []

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#18181B]">Дашборд</h1>
      </div>

      {/* Calendar + sidebar */}
      {(user?.role === 'director' || user?.permissions?.can_view_calendar) && <div className="grid grid-cols-3 gap-4 mb-6">

        {/* Calendar */}
        <div className="card p-5 col-span-2">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#18181B]">{MONTHS[curMonth - 1]} {curYear}</h2>
            <div className="flex items-center gap-2">
              <button onClick={goToday} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E4E4E7] text-[#52525B] hover:bg-[#F4F4F5] transition-colors">Сегодня</button>
              <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E4E4E7] hover:bg-[#F4F4F5] transition-colors text-[#52525B]"><ChevronLeft size={16} /></button>
              <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E4E4E7] hover:bg-[#F4F4F5] transition-colors text-[#52525B]"><ChevronRight size={16} /></button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-[11px] font-semibold text-[#A1A1AA] py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-px bg-[#F4F4F5] rounded-lg overflow-hidden border border-[#F4F4F5]">
            {cells.map((day, i) => {
              if (!day) return <div key={i} className="bg-[#FAFAFA] min-h-[80px]" />
              const dayEvents = eventsForDay(day)
              const isSelected = selectedDay === day
              const _isToday = isToday(day)
              return (
                <div key={i}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`bg-white min-h-[80px] p-1.5 cursor-pointer transition-colors hover:bg-[#FAFAFA] ${isSelected ? 'ring-2 ring-inset ring-[#003399]' : ''}`}>
                  {/* Date number */}
                  <div className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full mb-1 ${_isToday ? 'bg-[#CC0033] text-white' : 'text-[#18181B]'}`}>
                    {day}
                  </div>
                  {/* Events count */}
                  {dayEvents.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: typeStyle(dayEvents[0].type).color }} />
                      <span className="text-[10px] font-medium text-[#52525B] leading-tight">
                        {eventCountLabel(dayEvents.length)}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3">
            {EVENT_TYPES.map(t => (
              <div key={t.value} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} />
                <span className="text-xs text-[#71717A]">{t.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar — день + ближайшие события */}
        <div className="flex flex-col gap-4">

          {/* Выбранный день */}
          <div className="card p-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-[#18181B]">
                {selectedDay
                  ? `${selectedDay} ${MONTHS[curMonth - 1]}`
                  : 'Выберите день'}
              </div>
              {selectedDay && (
                <button onClick={() => openCreateForm(selectedDay)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#003399] text-white hover:bg-[#0044cc] transition-colors">
                  <Plus size={14} />
                </button>
              )}
            </div>

            {!selectedDay ? (
              <div className="text-xs text-[#A1A1AA] text-center py-6">Нажмите на день в календаре</div>
            ) : selectedDayEvents.length === 0 ? (
              <div className="text-xs text-[#A1A1AA] text-center py-4">
                Нет событий
                <div className="mt-2">
                  <button onClick={() => openCreateForm(selectedDay)}
                    className="text-[#003399] hover:underline text-xs">+ Добавить</button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[340px] pr-0.5">
                {selectedDayEvents.map(e => {
                  const s = typeStyle(e.type)
                  const canEdit = e.created_by === user?.id || user?.role === 'director'
                  return (
                    <div key={e.id} className="rounded-lg p-2.5 border" style={{ borderColor: s.color + '40', background: s.bg }}>
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate" style={{ color: s.color }}>{e.title}</div>
                          {e.event_time && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Clock size={10} style={{ color: s.color, opacity: 0.7 }} />
                              <span className="text-[10px]" style={{ color: s.color, opacity: 0.8 }}>{formatTime(e.event_time)}</span>
                            </div>
                          )}
                          {e.ticket_id && (
                            <div className="text-[10px] font-semibold mt-0.5 cursor-pointer hover:underline" style={{ color: s.color }}
                              onClick={ev => { ev.stopPropagation(); navigate(`/admin/tickets/${e.ticket_id}`) }}>
                              Заявка #{e.ticket_id}
                            </div>
                          )}
                          {e.description && <div className="text-[10px] text-[#71717A] mt-1 line-clamp-2">{e.description}</div>}
                          <div className="text-[9px] text-[#A1A1AA] mt-1">{e.created_by_name}</div>
                        </div>
                        {canEdit && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => openEditForm(e)} className="p-1 rounded hover:bg-white/60 transition-colors" style={{ color: s.color }}><Pencil size={11} /></button>
                            <button onClick={() => handleDelete(e.id)} className="p-1 rounded hover:bg-white/60 transition-colors text-red-400"><Trash2 size={11} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Ближайшие события */}
          <div className="card p-4">
            <div className="text-sm font-bold text-[#18181B] mb-3">Ближайшие</div>
            <div className="overflow-y-auto max-h-[220px] -mx-1 px-1">
            {events
              .filter(e => e.event_date.slice(0, 10) >= today.toISOString().slice(0, 10))
              .map(e => {
                const s = typeStyle(e.type)
                const d = new Date(e.event_date)
                return (
                  <div key={e.id}
                    onClick={() => { setSelectedDay(d.getDate()); if (d.getMonth() + 1 !== curMonth || d.getFullYear() !== curYear) { setCurYear(d.getFullYear()); setCurMonth(d.getMonth() + 1) } }}
                    className="flex items-center gap-2.5 py-2 border-b border-[#F4F4F5] last:border-0 cursor-pointer hover:bg-[#FAFAFA] -mx-1 px-1 rounded transition-colors">
                    <div className="w-8 h-8 rounded-lg flex flex-col items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                      <div className="text-[11px] font-bold leading-none" style={{ color: s.color }}>{d.getDate()}</div>
                      <div className="text-[9px] leading-none mt-0.5" style={{ color: s.color, opacity: 0.7 }}>{MONTHS[d.getMonth()].slice(0, 3)}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#18181B] truncate">{e.title}</div>
                      <div className="text-[10px] text-[#A1A1AA]">
                        {e.event_time ? formatTime(e.event_time) + ' · ' : ''}{e.created_by_name}
                      </div>
                      {e.ticket_id && (
                        <div className="text-[10px] font-semibold text-[#CC0033] cursor-pointer hover:underline"
                          onClick={ev => { ev.stopPropagation(); navigate(`/admin/tickets/${e.ticket_id}`) }}>
                          Заявка #{e.ticket_id}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {events.filter(e => e.event_date.slice(0, 10) >= today.toISOString().slice(0, 10)).length === 0 && (
              <div className="text-xs text-[#A1A1AA] text-center py-3">Нет предстоящих событий</div>
            )}
          </div>
        </div>
      </div>}

      {/* Recent tickets */}
      <div className="card">
        <div className="px-5 py-4 border-b border-[#E4E4E7]">
          <h2 className="font-semibold text-[#18181B]">Последние заявки</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                {['#', 'Дата', 'Клиент', 'Оборудование', 'Тип', 'Статус'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-[#71717A]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[#71717A]">Заявок пока нет</td></tr>
              )}
              {tickets.map(t => (
                <tr key={t.id} onClick={() => navigate(`/admin/tickets/${t.id}`)}
                  className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA] cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-bold text-[#CC0033]">#{t.id}</td>
                  <td className="px-4 py-3 text-[#71717A]">{formatDate(t.created_at)}</td>
                  <td className="px-4 py-3 font-medium">{t.company_name || '—'}</td>
                  <td className="px-4 py-3 text-[#71717A]">{t.equipment_model || '—'}</td>
                  <td className="px-4 py-3">{t.type_name || '—'}</td>
                  <td className="px-4 py-3"><span className={`badge ${statusBadgeClass(t.status)}`}>{statusLabel(t.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E4E4E7] w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-[#18181B] text-lg">{editEvent ? 'Редактировать событие' : 'Новое событие'}</h3>
              <button onClick={() => setShowForm(false)} className="text-[#A1A1AA] hover:text-[#18181B] transition-colors"><X size={20} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[#18181B] mb-1">Название <span className="text-[#CC0033]">*</span></label>
                <input className="form-control" placeholder="Что планируется?" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#18181B] mb-1">Дата</label>
                  <input className="form-control" type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#18181B] mb-1">Время</label>
                  <input className="form-control" type="time" value={form.event_time} onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#18181B] mb-1">Тип</label>
                <div className="flex gap-2">
                  {EVENT_TYPES.map(t => (
                    <button key={t.value} type="button"
                      onClick={() => setForm(f => ({ ...f, type: t.value }))}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${form.type === t.value ? 'border-current' : 'border-[#E4E4E7] text-[#71717A]'}`}
                      style={form.type === t.value ? { borderColor: t.color, color: t.color, background: t.bg } : {}}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              {form.type === 'ticket' && (
                <div>
                  <label className="block text-sm font-medium text-[#18181B] mb-1">Номер заявки</label>
                  <input className="form-control" type="number" placeholder="Например: 42" value={form.ticket_id} onChange={e => setForm(f => ({ ...f, ticket_id: e.target.value }))} />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-[#18181B] mb-1">Описание</label>
                <textarea className="form-control resize-none" rows={3} placeholder="Дополнительные заметки..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="btn btn-secondary flex-1 justify-center">Отмена</button>
              <button onClick={handleSave} className="btn btn-primary flex-[2] justify-center">
                {editEvent ? 'Сохранить' : 'Добавить событие'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
