import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import api from '../../api/client'
import { formatDateTime, statusLabel, statusBadgeClass } from '../../utils/helpers'
import toast from 'react-hot-toast'
import { Send, Paperclip, File, Download } from 'lucide-react'

interface Message { id: string; sender_type: string; sender_name: string; sender_role: string; content: string; created_at: string }
interface Ticket { id: number; type_name: string; type_color: string; status: string; description: string; created_at: string; equipment_model: string; equipment_serial: string }
interface Attachment { id: string; filename: string; filepath: string; filesize: number; mimetype: string; uploaded_by_name: string; created_at: string }

export default function ClientTicketDetail() {
  const { id } = useParams()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    api.get('/tickets/client/list').then(r => {
      const t = r.data.find((x: Ticket) => x.id === Number(id))
      if (t) setTicket(t)
    }).catch(() => {})
    loadMessages()
    loadAttachments()
  }, [id])

  const loadMessages = () => {
    api.get(`/tickets/${id}/messages/client`).then(r => setMessages(r.data)).catch(() => {})
  }

  const loadAttachments = () => {
    api.get(`/tickets/${id}/attachments/client`).then(r => setAttachments(r.data)).catch(() => {})
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      await api.post(`/tickets/${id}/attachments/client`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      loadAttachments()
      toast.success('Файл прикреплён')
    } catch { toast.error('Ошибка загрузки') }
    e.target.value = ''
  }

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!text.trim()) return
    try {
      await api.post(`/tickets/${id}/messages/client`, { content: text })
      setText('')
      loadMessages()
    } catch { toast.error('Ошибка отправки') }
  }

  if (!ticket) return <div className="p-6 text-[#71717A]">Загрузка...</div>

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#18181B]">Заявка #{ticket.id}</h1>
        <span className={`badge ${statusBadgeClass(ticket.status)}`}>{statusLabel(ticket.status)}</span>
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
          {ticket.equipment_model && (
            <div>
              <div className="text-xs font-semibold text-[#71717A] mb-1">Оборудование</div>
              <div className="text-sm text-[#18181B]">{ticket.equipment_model}</div>
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
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>

        {/* Reply */}
        <div className="border-t border-[#E4E4E7] p-4">
          <div className="flex gap-2 items-end">
            <textarea className="form-control text-sm resize-none flex-1" rows={3}
              placeholder="Введите сообщение..."
              value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
            <div className="flex flex-col gap-2">
              <>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                <button onClick={() => fileInputRef.current?.click()} className="btn btn-secondary flex-shrink-0" style={{ width: 36, height: 36, padding: 0, justifyContent: 'center' }} title="Прикрепить файл"><Paperclip size={16} /></button>
              </>
              <button onClick={send} className="btn btn-primary flex-shrink-0" style={{ width: 36, height: 36, padding: 0, justifyContent: 'center' }}><Send size={16} /></button>
            </div>
          </div>
          <div className="text-[10px] text-[#A1A1AA] mt-1">Enter — отправить · Shift+Enter — новая строка</div>
        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="border-t border-[#E4E4E7] px-4 py-3">
            <div className="text-xs font-semibold text-[#A1A1AA] uppercase mb-2">Вложения ({attachments.length})</div>
            <div className="space-y-1.5">
              {attachments.map(a => (
                <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] group">
                  <File size={14} className="text-[#71717A] flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-[#18181B] truncate">{a.filename}</div>
                    <div className="text-[10px] text-[#A1A1AA]">{a.uploaded_by_name} · {(a.filesize / 1024).toFixed(0)} КБ</div>
                  </div>
                  <a href={a.filepath} target="_blank" rel="noreferrer"
                    className="text-[#003399] hover:text-[#0044cc] opacity-0 group-hover:opacity-100 transition-opacity">
                    <Download size={14} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
