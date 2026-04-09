import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import toast from 'react-hot-toast'
import { Paperclip, X, FileText } from 'lucide-react'

interface Equipment { id: string; model: string; serial_number: string }
interface TicketType { id: string; name: string }

export default function ClientTicketNew() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [types, setTypes] = useState<TicketType[]>([])
  const [form, setForm] = useState({ equipment_id: '', equipment_manual: '', serial_manual: '', type_id: '', description: '' })
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/equipment/client/list').then(r => setEquipment(r.data)).catch(() => {})
    api.get('/users/ticket-types').then(r => setTypes(r.data)).catch(() => {})
  }, [])

  const isManual = form.equipment_id === '__manual__'

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || [])
    setFiles(prev => [...prev, ...picked])
    e.target.value = ''
  }

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.type_id || !form.description) { toast.error('Заполните обязательные поля'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/tickets/client/new', {
        equipment_id: isManual ? null : form.equipment_id || null,
        equipment_manual: isManual ? form.equipment_manual : null,
        serial_manual: isManual ? form.serial_manual : null,
        type_id: form.type_id,
        description: form.description,
      })

      // Загружаем вложения если есть
      if (files.length > 0) {
        for (const file of files) {
          const fd = new FormData()
          fd.append('file', file)
          await api.post(`/tickets/${data.id}/attachments/client`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' }
          }).catch(() => {})
        }
      }

      toast.success('Заявка создана')
      navigate('/client/tickets')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#18181B]">Новая заявка</h1>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {/* Оборудование */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Оборудование</label>
          <select className="form-control" value={form.equipment_id}
            onChange={e => setForm(f => ({ ...f, equipment_id: e.target.value }))}>
            <option value="">— выберите оборудование —</option>
            {equipment.map(eq => (
              <option key={eq.id} value={eq.id}>
                {eq.model}{eq.serial_number ? ` (${eq.serial_number})` : ''}
              </option>
            ))}
            <option value="__manual__">Ввести вручную...</option>
          </select>
        </div>

        {isManual && (
          <div className="grid grid-cols-2 gap-3 p-3 bg-[#FAFAFA] rounded border border-[#E4E4E7]">
            <div>
              <label className="block text-sm font-medium mb-1.5">Модель</label>
              <input className="form-control" placeholder="A-130 ПАКМАТИК"
                value={form.equipment_manual} onChange={e => setForm(f => ({ ...f, equipment_manual: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Серийный номер</label>
              <input className="form-control" placeholder="SN-00001"
                value={form.serial_manual} onChange={e => setForm(f => ({ ...f, serial_manual: e.target.value }))} />
            </div>
          </div>
        )}

        {/* Тип заявки */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Тип заявки <span className="text-[#CC0033]">*</span></label>
          <select className="form-control" value={form.type_id}
            onChange={e => setForm(f => ({ ...f, type_id: e.target.value }))} required>
            <option value="">— выберите тип —</option>
            {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Описание */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Описание проблемы <span className="text-[#CC0033]">*</span></label>
          <textarea className="form-control" rows={5} placeholder="Опишите проблему подробно..."
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
        </div>

        {/* Вложения */}
        <div>
          <label className="block text-sm font-medium mb-2">Прикрепить файлы</label>
          <div className="space-y-1.5 mb-2">
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-[#FAFAFA] rounded border border-[#E4E4E7]">
                <FileText size={14} className="text-[#003399] flex-shrink-0" />
                <span className="text-sm flex-1 truncate">{file.name}</span>
                <span className="text-xs text-[#A1A1AA]">{(file.size / 1024).toFixed(0)} КБ</span>
                <button type="button" onClick={() => removeFile(i)}
                  className="text-[#A1A1AA] hover:text-[#CC0033] transition-colors">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="btn btn-secondary gap-2 text-sm">
            <Paperclip size={14} /> Добавить файл
          </button>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={handleAddFiles} />
          <div className="text-xs text-[#A1A1AA] mt-1">Фото, документы, видео — до 20 МБ каждый</div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate('/client/tickets')}
            className="btn btn-secondary flex-1 justify-center py-3">Отмена</button>
          <button type="submit" disabled={loading}
            className="btn btn-blue flex-[2] justify-center py-3 disabled:opacity-60">
            {loading ? 'Отправка...' : 'Отправить заявку'}
          </button>
        </div>
      </form>
    </div>
  )
}
