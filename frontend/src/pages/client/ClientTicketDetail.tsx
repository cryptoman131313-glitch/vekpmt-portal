import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api/client'
import { formatDateTime, getStatusInfo, statusBadgeStyle } from '../../utils/helpers'
import toast from 'react-hot-toast'
import { Send, Paperclip, File, Download, Eye, X as XIcon } from 'lucide-react'

interface Message { id: string; sender_type: string; sender_name: string; sender_role: string; content: string; created_at: string; attachments?: Attachment[] }
interface Ticket { id: number; type_name: string; type_color: string; type_statuses?: any[]; status: string; description: string; created_at: string; equipment_model: string; equipment_manufacturer: string; equipment_serial: string }
interface Attachment { id: string; filename: string; filepath: string; filesize: number; mimetype: string; uploaded_by_name: string; uploaded_by_type?: string; created_at: string; message_id?: string | null }

export default function ClientTicketDetail() {
  const { id } = useParams()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      api.get('/tickets/client/list'),
      api.get(`/tickets/${id}/messages/client`),
      api.get(`/tickets/${id}/attachments/client`)
    ]).then(([ticketsRes, msgsRes, attRes]) => {
      const t = ticketsRes.data.find((x: Ticket) => x.id === Number(id))
      if (t) setTicket(t)
      setMessages(msgsRes.data)
      setAttachments(attRes.data)
    }).catch(() => {})
  }, [id])

  const loadMessages = () => {
    api.get(`/tickets/${id}/messages/client`).then(r => setMessages(r.data)).catch(() => {})
  }

  const loadAttachments = () => {
    api.get(`/tickets/${id}/attachments/client`).then(r => setAttachments(r.data)).catch(() => {})
  }

  // Файлы добавляются в локальную очередь и отправляются вместе с сообщением
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setPendingFiles(prev => [...prev, ...files])
    e.target.value = ''
  }
  const removePendingFile = (idx: number) => setPendingFiles(prev => prev.filter((_, i) => i !== idx))

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    const trimmed = text.trim()
    if (!trimmed && pendingFiles.length === 0) return
    if (sending) return
    setSending(true)
    const optimistic: Message = {
      id: `tmp-${Date.now()}`, sender_type: 'client', sender_name: 'Вы',
      sender_role: '', content: trimmed || '📎', created_at: new Date().toISOString()
    }
    setMessages(prev => [...prev, optimistic])
    const sentText = trimmed || ''
    const filesToSend = pendingFiles
    setText('')
    setPendingFiles([])
    try {
      const attachmentIds: string[] = []
      for (const f of filesToSend) {
        const fd = new FormData()
        fd.append('file', f)
        try {
          const r = await api.post(`/tickets/${id}/attachments/client`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
          if (r.data?.id) attachmentIds.push(r.data.id)
        } catch {
          toast.error(`Не удалось загрузить ${f.name}`)
        }
      }
      await api.post(`/tickets/${id}/messages/client`, { content: sentText, attachment_ids: attachmentIds })
      loadMessages()
      loadAttachments()
    } catch {
      toast.error('Ошибка отправки')
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
    } finally {
      setSending(false)
    }
  }

  if (!ticket) return <div className="p-6 text-[#71717A]">Загрузка...</div>

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#18181B]">Заявка #{ticket.id}</h1>
        {(() => {
          const info = getStatusInfo(ticket.status, ticket.type_statuses)
          return <span style={statusBadgeStyle(info.color)}>
            <span style={{width:6,height:6,borderRadius:'50%',background:info.color}} />
            {info.label}
          </span>
        })()}
      </div>

      {/* Info */}
      <div className="card p-5 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {ticket.type_name && (
            <div>
              <div className="text-xs font-semibold text-[#71717A] mb-1">Тип заявки</div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{ background: (ticket.type_color || '#71717A') + '20', color: ticket.type_color || '#71717A' }}>
                {ticket.type_name}
              </span>
            </div>
          )}
          {ticket.equipment_manufacturer && (
            <div>
              <div className="text-xs font-semibold text-[#71717A] mb-1">Марка</div>
              <div className="text-sm text-[#18181B]">{ticket.equipment_manufacturer}</div>
            </div>
          )}
          {ticket.equipment_model && (
            <div>
              <div className="text-xs font-semibold text-[#71717A] mb-1">Модель</div>
              <div className="text-sm text-[#18181B]">{ticket.equipment_model}</div>
            </div>
          )}
          {ticket.equipment_serial && (
            <div>
              <div className="text-xs font-semibold text-[#71717A] mb-1">Серийный номер</div>
              <div className="text-sm text-[#18181B]">{ticket.equipment_serial}</div>
            </div>
          )}
          <div>
            <div className="text-xs font-semibold text-[#71717A] mb-1">Дата создания</div>
            <div className="text-sm text-[#18181B]">{formatDateTime(ticket.created_at)}</div>
          </div>
        </div>
        {ticket.description && (
          <div className="mt-4 pt-4 border-t border-[#E4E4E7]">
            <div className="text-xs font-semibold text-[#71717A] mb-1">Описание</div>
            <div className="text-sm text-[#18181B]">{ticket.description}</div>
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="card">
        <div className="px-5 py-3 border-b border-[#E4E4E7]">
          <span className="font-semibold text-sm text-[#18181B]">Обращение</span>
        </div>

        {/* Messages */}
        <div className="p-4 overflow-y-auto space-y-4" style={{ minHeight: 200, maxHeight: 'calc(100vh - 520px)' }}>
          {messages.length === 0 && (
            <div className="text-center text-[#A1A1AA] py-8 text-sm">Начните переписку с нашим специалистом</div>
          )}
          {messages.map(m => {
            const isClient = m.sender_type === 'client'
            return (
              <div key={m.id} className={`flex gap-3 ${isClient ? 'flex-row-reverse' : ''}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${isClient ? 'bg-[#003399] text-white' : 'bg-[#CC0033] text-white'}`}>
                  {m.sender_name?.slice(0, 2).toUpperCase()}
                </div>
                <div className={`flex flex-col max-w-[75%] ${isClient ? 'items-end' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-[#18181B]">{m.sender_name}</span>
                    <span className="text-[10px] font-semibold text-[#52525B] bg-[#E4E4E7] px-1.5 py-0.5 rounded">
                      {isClient ? 'Клиент' : m.sender_role === 'director' ? 'Руководитель' : m.sender_role === 'manager' ? 'Менеджер' : 'Специалист'}
                    </span>
                    <span className="text-[10px] text-[#A1A1AA]">{formatDateTime(m.created_at)}</span>
                  </div>
                  <div className="rounded-lg px-3 py-2 text-sm bg-[#F4F4F5] text-[#18181B]">
                    {m.content}
                  </div>
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="mt-1.5 space-y-1.5 w-full">
                      {m.attachments.map(a => <ClientAttachment key={a.id} att={a} />)}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        {/* Reply */}
        <div className="border-t border-[#E4E4E7] p-4">
          <textarea className="form-control text-sm resize-none w-full" rows={3}
            placeholder="Введите сообщение..."
            value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
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
              <button onClick={() => fileInputRef.current?.click()} className="btn btn-secondary" style={{ width: 36, height: 36, padding: 0, justifyContent: 'center' }} title="Прикрепить файл"><Paperclip size={16} /></button>
              <button onClick={send} disabled={sending} className="btn btn-blue gap-2 disabled:opacity-60" style={{ height: 36, paddingLeft: 16, paddingRight: 16 }}><Send size={15} /> {sending ? 'Отправка...' : 'Отправить'}</button>
            </div>
          </div>
        </div>

        {/* Общие вложения (без message_id) */}
        {(() => {
          const general = attachments.filter(a => !a.message_id)
          if (general.length === 0) return null
          return (
            <div className="border-t border-[#E4E4E7] px-4 py-3">
              <div className="text-xs font-semibold text-[#A1A1AA] uppercase mb-2">Общие вложения ({general.length})</div>
              <div className="space-y-1.5">
                {general.map(a => <ClientAttachment key={a.id} att={a} extended />)}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

// Компактная плашка вложения для клиентского ЛК. Цветная полоса:
// синяя — от клиента, красная — от сотрудника.
function ClientAttachment({ att, extended = false }: { att: Attachment; extended?: boolean }) {
  const isClient = att.uploaded_by_type === 'client'
  const stripe = isClient ? '#003399' : '#CC0033'

  const handleDownload = async () => {
    try {
      const { data } = await api.post(`/tickets/attachments/${att.id}/client-download-link`)
      window.location.href = data.url
    } catch { toast.error('Не удалось скачать') }
  }
  const handlePreview = async () => {
    try {
      const { data } = await api.post(`/tickets/attachments/${att.id}/client-download-link`)
      window.open(`${data.url}&inline=1`, '_blank', 'noopener')
    } catch { toast.error('Не удалось открыть') }
  }

  return (
    <div className="flex items-center gap-2 p-2 pl-3 rounded-lg bg-white border border-[#E4E4E7] group"
      style={{ borderLeft: `4px solid ${stripe}` }}>
      <File size={14} className="text-[#71717A] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-[#18181B] truncate">{att.filename}</div>
        {extended ? (
          <div className="text-[10px] text-[#A1A1AA]">{att.uploaded_by_name} · {(att.filesize / 1024).toFixed(0)} КБ</div>
        ) : (
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
