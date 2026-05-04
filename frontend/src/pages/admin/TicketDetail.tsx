import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../../api/client'
import { getCache, setCache } from '../../api/cache'
import { useAuth } from '../../context/AuthContext'
import { formatDateTime, statusLabel, STATUS_OPTIONS, getStatusInfo, statusBadgeStyle } from '../../utils/helpers'
import toast from 'react-hot-toast'
import { Send, Paperclip, Pencil, Trash2, File, Download, X as XIcon, Eye } from 'lucide-react'

interface TicketStatus { key: string; label: string; color: string }
interface Ticket {
  id: number; company_name: string; contact_name: string; contact_phone: string; contact_email: string
  equipment_model: string; manufacturer: string; equipment_serial: string; serial_manual: string
  type_name: string; type_color: string; type_statuses: TicketStatus[]; client_id: string
  status: string; description: string; assigned_name: string; assigned_to: string; created_at: string
}
interface StaffUser { id: string; name: string; role: string }
interface Message {
  id: string; sender_type: string; sender_name: string; sender_role: string
  channel: string; content: string; is_edited: boolean; created_at: string; sender_id: string
  attachments?: Attachment[]
}
interface Attachment { id: string; filename: string; filepath: string; filesize: number; mimetype: string; uploaded_by_name: string; uploaded_by_type?: string; created_at: string; message_id?: string | null }
interface HistoryRecord { id: string; field_name: string; old_value: string; new_value: string; changed_by_name: string; changed_by_role: string; changed_by_type: string; created_at: string }
interface HistoryStats { ticket_created: string; first_staff_reply: string | null; time_to_first_response_ms: number | null; avg_response_time_ms: number | null; total_messages: number; staff_messages: number; client_messages: number }

const CHANNELS = [
  { key: 'appeal', label: 'Обращение' },
  { key: 'service', label: 'Служебный чат' },
  { key: 'notes', label: 'Примечания' },
]

export default function TicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [channel, setChannel] = useState('appeal')
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [historyStats, setHistoryStats] = useState<HistoryStats | null>(null)
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([])
  const [assignedTo, setAssignedTo] = useState<string>('')
  const [showDelete, setShowDelete] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const msgCache = useRef<Record<string, Message[]>>({})
  // Очередь локальных файлов до отправки сообщения
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    api.get(`/tickets/${id}`).then(r => { setTicket(r.data); setStatus(r.data.status); setAssignedTo(r.data.assigned_to || '') }).catch(() => navigate('/admin/tickets'))
    loadAttachments()
    if (user?.role === 'director') {
      const cached = getCache('staff_users')
      if (cached) setStaffUsers(cached)
      api.get('/users').then(r => { setCache('staff_users', r.data); setStaffUsers(r.data) }).catch(() => {})
    }
  }, [id])

  // История грузится отдельно — ждём пока загрузится user из контекста
  useEffect(() => {
    if (id && user) loadHistory()
  }, [id, user?.role])

  useEffect(() => {
    if (!id) return
    // Если кэш есть — показываем мгновенно, иначе сразу очищаем чтобы не было залипания
    setMessages(msgCache.current[channel] || [])
    api.get(`/tickets/${id}/messages`, { params: { channel } })
      .then(r => { msgCache.current[channel] = r.data; setMessages(r.data) })
      .catch(() => {})
  }, [id, channel])

  const loadMessages = () => {
    api.get(`/tickets/${id}/messages`, { params: { channel } })
      .then(r => { msgCache.current[channel] = r.data; setMessages(r.data) })
      .catch(() => {})
  }

  const prevChannelRef = useRef(channel)
  useEffect(() => {
    // Скроллим вниз только при отправке нового сообщения, не при смене канала
    if (prevChannelRef.current === channel && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevChannelRef.current = channel
  }, [messages])

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus)
    try {
      await api.patch(`/tickets/${id}`, { status: newStatus })
      toast.success('Статус обновлён')
    } catch { toast.error('Ошибка') }
  }

  const handleAssignChange = async (newAssigned: string) => {
    setAssignedTo(newAssigned)
    try {
      await api.patch(`/tickets/${id}`, { assigned_to: newAssigned || null })
      const found = staffUsers.find(u => u.id === newAssigned)
      setTicket(prev => prev ? { ...prev, assigned_name: found?.name || '—', assigned_to: newAssigned } : prev)
      toast.success(newAssigned ? `Назначено: ${found?.name}` : 'Назначение снято')
    } catch { toast.error('Ошибка') }
  }

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed && pendingFiles.length === 0) return
    if (sending) return
    setSending(true)

    const optimistic: Message = {
      id: `tmp-${Date.now()}`, sender_type: 'user', sender_name: user?.name || '',
      sender_role: user?.role || '', channel, content: trimmed || '📎', is_edited: false,
      created_at: new Date().toISOString(), sender_id: user?.id || ''
    }
    setMessages(prev => [...prev, optimistic])
    const sentText = trimmed || ''
    const filesToSend = pendingFiles
    setText('')
    setPendingFiles([])

    try {
      // 1) Загружаем файлы (без message_id) — собираем их id
      const attachmentIds: string[] = []
      for (const f of filesToSend) {
        const fd = new FormData()
        fd.append('file', f)
        try {
          const r = await api.post(`/tickets/${id}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
          if (r.data?.id) attachmentIds.push(r.data.id)
        } catch {
          toast.error(`Не удалось загрузить ${f.name}`)
        }
      }

      // 2) Отправляем сообщение с привязкой вложений
      await api.post(`/tickets/${id}/messages`, { content: sentText, channel, attachment_ids: attachmentIds })

      loadMessages()
      loadAttachments()
    } catch {
      toast.error('Ошибка отправки')
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
    } finally {
      setSending(false)
    }
  }

  const handleEdit = async (msgId: string) => {
    try {
      await api.patch(`/tickets/${id}/messages/${msgId}`, { content: editText })
      setEditId(null)
      loadMessages()
    } catch { toast.error('Ошибка') }
  }

  const handleDelete = async (msgId: string) => {
    if (!confirm('Удалить сообщение?')) return
    try {
      await api.delete(`/tickets/${id}/messages/${msgId}`)
      loadMessages()
    } catch { toast.error('Ошибка') }
  }

  const loadAttachments = () => {
    api.get(`/tickets/${id}/attachments`).then(r => setAttachments(r.data)).catch(() => {})
  }

  const loadHistory = () => {
    api.get(`/tickets/${id}/history`).then(r => {
      setHistory(r.data.history || [])
      setHistoryStats(r.data.stats || null)
    }).catch(() => {})
  }

  // Файлы добавляются в локальную очередь и отправляются вместе с сообщением
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setPendingFiles(prev => [...prev, ...files])
    e.target.value = ''
  }
  const removePendingFile = (idx: number) => setPendingFiles(prev => prev.filter((_, i) => i !== idx))

  const handleDeleteTicket = async () => {
    try {
      await api.delete(`/tickets/${id}`)
      toast.success('Заявка удалена')
      navigate('/admin/tickets')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка')
    }
  }

  if (!ticket) return <div className="p-6 text-[#71717A]">Загрузка...</div>

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#18181B]">Заявка #{ticket.id}</h1>
        </div>
        <div className="flex items-center gap-3">
          {(() => {
            const info = getStatusInfo(status, ticket.type_statuses)
            return <span style={statusBadgeStyle(info.color)}>
              <span style={{width:6,height:6,borderRadius:'50%',background:info.color}} />
              {info.label}
            </span>
          })()}
          <select className="form-control" style={{ width: 'auto', minWidth: 200 }}
            value={status} onChange={e => handleStatusChange(e.target.value)}>
            {(() => {
              const raw = ticket.type_statuses?.length > 0 ? ticket.type_statuses : STATUS_OPTIONS
              return raw.map((o: any) => {
                // Поддержка двух форматов: строка ("new") и объект ({key/value, label})
                if (typeof o === 'string') {
                  return <option key={o} value={o}>{statusLabel(o)}</option>
                }
                const val = o.key || o.value
                return <option key={val} value={val}>{o.label || statusLabel(val)}</option>
              })
            })()}
          </select>
          {user?.role === 'director' && (
            <button onClick={() => setShowDelete(true)} className="btn btn-danger gap-1.5" title="Удалить заявку">
              <Trash2 size={14} /> Удалить
            </button>
          )}
        </div>
      </div>

      {/* Ticket info */}
      <div className="card p-5 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <InfoItem label="Клиент" value={<Link to={`/admin/clients/${(ticket as any).client_id}`} className="text-[#003399] hover:underline">{ticket.company_name}</Link>} />
          <InfoItem label="Контактное лицо" value={ticket.contact_name} />
          <InfoItem label="Телефон" value={ticket.contact_phone} />
          <InfoItem label="Email" value={ticket.contact_email} />
          <InfoItem label="Марка" value={ticket.manufacturer || '—'} />
          <InfoItem label="Модель" value={ticket.equipment_model || '—'} />
          <InfoItem label="Серийный номер" value={ticket.equipment_serial || ticket.serial_manual || '—'} />
          <InfoItem label="Тип заявки" value={ticket.type_name} />
          <InfoItem label="Назначен" value={
            user?.role === 'director' ? (
              <select className="form-control py-1 text-sm" style={{ minWidth: 180 }}
                value={assignedTo} onChange={e => handleAssignChange(e.target.value)}>
                <option value="">— Не назначен —</option>
                {staffUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role === 'manager' ? 'Менеджер' : u.role === 'engineer' ? 'Инженер' : 'Руководитель'})</option>
                ))}
              </select>
            ) : (ticket.assigned_name || '—')
          } />
          <InfoItem label="Дата создания" value={formatDateTime(ticket.created_at)} />
        </div>
        {ticket.description && (
          <div className="mt-4 pt-4 border-t border-[#E4E4E7]">
            <div className="text-xs font-semibold text-[#71717A] mb-1">Описание</div>
            <div className="text-sm text-[#18181B]">{ticket.description}</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex border-b border-[#E4E4E7]">
          {CHANNELS.map(c => (
            <button key={c.key} onClick={() => setChannel(c.key)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${channel === c.key ? 'border-[#CC0033] text-[#CC0033]' : 'border-transparent text-[#71717A] hover:text-[#18181B]'}`}>
              {c.label}
            </button>
          ))}
          {user?.role === 'director' && (
            <button onClick={() => setChannel('history')}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${channel === 'history' ? 'border-[#CC0033] text-[#CC0033]' : 'border-transparent text-[#71717A] hover:text-[#18181B]'}`}>
              История
            </button>
          )}
        </div>

        {/* Messages */}
        <div className={`p-4 overflow-y-auto space-y-4 ${channel === 'history' ? 'hidden' : ''}`} style={{ height: 'calc(100vh - 520px)', minHeight: 300 }}>
          {messages.length === 0 && (
            <div className="text-center text-[#A1A1AA] py-8 text-sm">Сообщений пока нет</div>
          )}
          {messages.map(m => (
            <div key={m.id} className={`flex gap-3 ${m.sender_type === 'user' && m.sender_id === user?.id ? 'flex-row-reverse' : ''}`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                ${m.sender_type === 'client' ? 'bg-[#003399] text-white' : 'bg-[#CC0033] text-white'}`}>
                {m.sender_name?.slice(0, 2).toUpperCase()}
              </div>
              <div className={`flex flex-col max-w-[75%] ${m.sender_type === 'user' && m.sender_id === user?.id ? 'items-end' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-[#18181B]">{m.sender_name}</span>
                  <span className="text-[10px] font-semibold text-[#52525B] bg-[#E4E4E7] px-1.5 py-0.5 rounded">
                    {m.sender_type === 'client' ? 'Клиент' : m.sender_role === 'director' ? 'Руководитель' : m.sender_role === 'manager' ? 'Менеджер' : 'Инженер'}
                  </span>
                  <span className="text-[10px] text-[#A1A1AA]">{formatDateTime(m.created_at)}</span>
                  {m.is_edited && <span className="text-[10px] text-[#A1A1AA] italic">изменено</span>}
                </div>
                {editId === m.id ? (
                  <div className="flex gap-2 items-end">
                    <textarea className="form-control text-sm resize-none flex-1" rows={2}
                      value={editText} onChange={e => setEditText(e.target.value)} />
                    <button onClick={() => handleEdit(m.id)} className="btn btn-primary py-1 px-3 text-xs">Сохранить</button>
                    <button onClick={() => setEditId(null)} className="btn btn-secondary py-1 px-3 text-xs">Отмена</button>
                  </div>
                ) : (
                  <div className="group">
                    <div className={`rounded-lg px-3 py-2 text-sm
                      ${channel === 'service' ? 'bg-yellow-50 border border-yellow-100' : channel === 'notes' ? 'bg-purple-50 border border-purple-100' : 'bg-[#F4F4F5]'}`}>
                      {m.content}
                    </div>
                    {/* Вложения сообщения */}
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="mt-1.5 space-y-1.5">
                        {m.attachments.map(a => <MessageAttachment key={a.id} att={a} />)}
                      </div>
                    )}
                    {m.sender_type === 'user' && m.sender_id === user?.id && (user?.role === 'director' || user?.permissions?.can_edit_messages) && (
                      <div className="hidden group-hover:flex gap-1 mt-1">
                        <button onClick={() => { setEditId(m.id); setEditText(m.content) }}
                          className="p-1 rounded hover:bg-[#E4E4E7] text-[#71717A]" title="Редактировать"><Pencil size={12} /></button>
                        <button onClick={() => handleDelete(m.id)}
                          className="p-1 rounded hover:bg-[#FEE2E2] text-red-400" title="Удалить"><Trash2 size={12} /></button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* History tab */}
        {channel === 'history' && (
          <div className="p-4 space-y-4 overflow-y-auto" style={{ height: 'calc(100vh - 520px)', minHeight: 300 }}>
            {/* Stats */}
            {historyStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <StatCard label="Всего сообщений" value={String(historyStats.total_messages)} />
                <StatCard label="От сотрудников" value={String(historyStats.staff_messages)} />
                <StatCard label="От клиента" value={String(historyStats.client_messages)} />
                <StatCard label="Первый ответ" value={historyStats.time_to_first_response_ms != null ? formatDuration(historyStats.time_to_first_response_ms) : '—'} highlight={historyStats.time_to_first_response_ms != null && historyStats.time_to_first_response_ms < 3600000} />
              </div>
            )}
            {/* Timeline */}
            {history.length === 0 ? (
              <div className="text-center text-[#A1A1AA] py-8 text-sm">Изменений пока нет</div>
            ) : (
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-[#E4E4E7]" />
                <div className="space-y-3">
                  {history.map(h => (
                    <div key={h.id} className="flex gap-3 relative">
                      <div className="w-6 h-6 rounded-full bg-white border-2 border-[#E4E4E7] flex items-center justify-center flex-shrink-0 z-10">
                        <div className="w-2 h-2 rounded-full bg-[#CC0033]" />
                      </div>
                      <div className="flex-1 pb-1">
                        <div className="text-sm text-[#18181B]">{formatHistoryEvent(h)}</div>
                        <div className="text-[10px] text-[#A1A1AA] mt-0.5">
                          {h.changed_by_name || 'Система'} · {formatDateTime(h.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reply form */}
        {channel !== 'history' && (user?.role === 'director' || (channel === 'appeal' && user?.permissions?.can_write_appeal) || (channel === 'service' && user?.permissions?.can_write_service) || (channel === 'notes' && user?.permissions?.can_write_notes)) && <div className="border-t border-[#E4E4E7] p-4">
          <textarea className="form-control text-sm resize-none w-full" rows={3}
            placeholder={channel === 'appeal' ? 'Ответ клиенту...' : channel === 'service' ? 'Служебное сообщение...' : 'Примечание...'}
            value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} />
          {/* Очередь файлов перед отправкой */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {pendingFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FAFAFA] border border-[#E4E4E7] rounded text-xs">
                  <File size={12} className="text-[#71717A]" />
                  <span className="text-[#18181B] max-w-[180px] truncate">{f.name}</span>
                  <span className="text-[#A1A1AA]">{(f.size / 1024).toFixed(0)} КБ</span>
                  <button onClick={() => removePendingFile(i)} className="text-[#A1A1AA] hover:text-[#CC0033] ml-0.5"><XIcon size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] text-[#A1A1AA]">Enter — отправить · Shift+Enter — новая строка</span>
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
              <button onClick={() => fileInputRef.current?.click()}
                className="btn btn-secondary"
                style={{ width: 36, height: 36, padding: 0, justifyContent: 'center' }}
                title="Прикрепить файл">
                <Paperclip size={16} />
              </button>
              <button onClick={handleSend} disabled={sending} className="btn btn-primary gap-2 disabled:opacity-60" style={{ height: 36, paddingLeft: 16, paddingRight: 16 }}>
                <Send size={15} /> {sending ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </div>
        </div>}

        {/* Общие вложения (не привязаны к конкретному сообщению) */}
        {(() => {
          if (channel === 'history') return null
          const generalAttachments = attachments.filter(a => !a.message_id)
          if (generalAttachments.length === 0) return null
          return (
            <div className="border-t border-[#E4E4E7] px-4 py-3">
              <div className="text-xs font-semibold text-[#A1A1AA] uppercase mb-2">Общие вложения ({generalAttachments.length})</div>
              <div className="space-y-1.5">
                {generalAttachments.map(a => <MessageAttachment key={a.id} att={a} extended />)}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Удаление заявки */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E4E4E7] w-full max-w-md p-6 shadow-lg">
            <h3 className="font-bold text-[#18181B] mb-2">Удалить заявку #{ticket.id}?</h3>
            <p className="text-sm text-[#71717A] mb-4">
              Заявка будет удалена безвозвратно вместе с перепиской, вложениями и историей изменений.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDelete(false)} className="btn btn-secondary flex-1 justify-center">Отмена</button>
              <button onClick={handleDeleteTicket} className="btn btn-danger flex-[2] justify-center">Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatDuration(ms: number) {
  const mins = Math.floor(ms / 60000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}д ${hours % 24}ч`
  if (hours > 0) return `${hours}ч ${mins % 60}м`
  return `${mins}м`
}

function formatHistoryEvent(h: { field_name: string; old_value: string; new_value: string }) {
  const statusLabels: Record<string, string> = {
    new: 'Новая', in_progress: 'В работе', waiting_parts: 'Ожид. запчастей',
    waiting_client: 'Ожид. клиента', done: 'Выполнена', cancelled: 'Отменена'
  }
  if (h.field_name === 'created') return `Заявка создана`
  if (h.field_name === 'message') return `Отправлено сообщение: «${h.new_value}${h.new_value?.length >= 100 ? '...' : ''}»`
  if (h.field_name === 'status') {
    if (!h.old_value) return `Заявка создана со статусом: ${statusLabels[h.new_value] || h.new_value}`
    const from = statusLabels[h.old_value] || h.old_value
    const to = statusLabels[h.new_value] || h.new_value
    return `Статус изменён: ${from} → ${to}`
  }
  if (h.field_name === 'assigned') {
    if (!h.old_value && h.new_value) return `Назначен: ${h.new_value}`
    if (h.old_value && !h.new_value) return `Назначение снято (был: ${h.old_value})`
    if (h.old_value && h.new_value) return `Переназначен: ${h.old_value} → ${h.new_value}`
  }
  if (h.field_name === 'assigned_to') {
    if (!h.old_value && h.new_value) return `Назначен сотрудник`
    if (h.old_value && !h.new_value) return `Сотрудник снят с заявки`
    return `Назначен другой сотрудник`
  }
  return `Изменено поле «${h.field_name}»`
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-[#FAFAFA] border border-[#E4E4E7] rounded-lg p-3 text-center">
      <div className="text-[10px] text-[#A1A1AA] font-medium mb-1">{label}</div>
      <div className={`text-lg font-bold ${highlight ? 'text-green-600' : 'text-[#18181B]'}`}>{value}</div>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-[#A1A1AA] mb-0.5">{label}</div>
      <div className="text-sm text-[#18181B]">{value || '—'}</div>
    </div>
  )
}

// Компактная плашка вложения сообщения. Слева — цветная полоса:
// красная для сотрудника, синяя для клиента.
function MessageAttachment({ att, extended = false }: { att: Attachment; extended?: boolean }) {
  const isClient = att.uploaded_by_type === 'client'
  const stripe = isClient ? '#003399' : '#CC0033'

  const handleDownload = async () => {
    try {
      const { data } = await api.post(`/tickets/attachments/${att.id}/download-link`)
      window.location.href = data.url
    } catch { toast.error('Не удалось скачать') }
  }
  const handlePreview = async () => {
    try {
      const { data } = await api.post(`/tickets/attachments/${att.id}/download-link`)
      window.open(`${data.url}&inline=1`, '_blank', 'noopener')
    } catch { toast.error('Не удалось открыть') }
  }

  return (
    <div className="flex items-center gap-2 p-2 pl-3 rounded-lg bg-white border border-[#E4E4E7] group"
      style={{ borderLeft: `4px solid ${stripe}` }}>
      <File size={14} className="text-[#71717A] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-[#18181B] truncate">{att.filename}</div>
        {extended && (
          <div className="text-[10px] text-[#A1A1AA]">{att.uploaded_by_name} · {(att.filesize / 1024).toFixed(0)} КБ</div>
        )}
        {!extended && (
          <div className="text-[10px] text-[#A1A1AA]">{(att.filesize / 1024).toFixed(0)} КБ</div>
        )}
      </div>
      <button type="button" title="Просмотр" onClick={handlePreview}
        className="text-[#003399] hover:text-[#0044cc] opacity-0 group-hover:opacity-100 transition-opacity">
        <Eye size={14} />
      </button>
      <button type="button" title="Скачать" onClick={handleDownload}
        className="text-[#003399] hover:text-[#0044cc] opacity-60 group-hover:opacity-100 transition-opacity">
        <Download size={14} />
      </button>
    </div>
  )
}
