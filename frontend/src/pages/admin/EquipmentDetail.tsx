import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Pencil, Save, X, UserPlus, ArrowLeft } from 'lucide-react'

interface Equipment { id: string; model: string; manufacturer: string; serial_number: string; notes: string; company_name: string; client_id: string | null; contact_name: string; characteristics: Record<string, string> }
interface EquipmentField { id: string; name: string; unit: string }
interface Client { id: string; company_name: string }

export default function EquipmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [eq, setEq] = useState<Equipment | null>(null)
  const [fields, setFields] = useState<EquipmentField[]>([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ model: '', manufacturer: '', serial_number: '', notes: '' })
  const [chars, setChars] = useState<Record<string, string>>({})
  const [clients, setClients] = useState<Client[]>([])
  const [showAssign, setShowAssign] = useState(false)
  const [assignClientId, setAssignClientId] = useState('')

  const canEdit = user?.role === 'director' || user?.role === 'manager' && user?.permissions?.can_edit_equipment

  useEffect(() => {
    if (!id) return
    api.get(`/equipment/${id}`).then(r => {
      setEq(r.data)
      setForm(r.data)
      setChars(r.data.characteristics || {})
    }).catch(() => {})
    api.get('/settings/equipment_fields').then(r => setFields(r.data || [])).catch(() => {})
  }, [id])

  useEffect(() => {
    api.get('/clients').then(r => setClients(r.data)).catch(() => {})
  }, [])

  const handleSave = async () => {
    try {
      await api.patch(`/equipment/${id}`, { ...form, characteristics: chars })
      toast.success('Сохранено')
      setEditing(false)
      api.get(`/equipment/${id}`).then(r => { setEq(r.data); setChars(r.data.characteristics || {}) })
    } catch { toast.error('Ошибка') }
  }

  const handleAssign = async () => {
    if (!assignClientId) { toast.error('Выберите клиента'); return }
    try {
      // Создаём новую запись для клиента — оригинал в каталоге остаётся
      await api.post('/equipment', {
        client_id: assignClientId,
        model: eq.model,
        manufacturer: eq.manufacturer,
        serial_number: '',   // серийник нужно будет ввести отдельно в карточке
        notes: eq.notes,
      })
      toast.success('Оборудование добавлено клиенту из каталога')
      setShowAssign(false)
    } catch { toast.error('Ошибка') }
  }

  if (!eq) return <div className="p-6 text-[#71717A]">Загрузка...</div>

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)}
          className="text-[#71717A] hover:text-[#18181B] transition-colors flex-shrink-0">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-2xl font-bold text-[#18181B]">{eq.model}</h1>
      </div>

      <div className="card p-5 mb-4">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm font-semibold text-[#71717A] uppercase tracking-wide">Основное</div>
          {!editing ? (
            canEdit && <button onClick={() => setEditing(true)} className="btn btn-secondary gap-2"><Pencil size={14} /> Редактировать</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="btn btn-secondary"><X size={14} /> Отмена</button>
              <button onClick={handleSave} className="btn btn-primary"><Save size={14} /> Сохранить</button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Модель', field: 'model' },
            { label: 'Производитель', field: 'manufacturer' },
            { label: 'Серийный номер', field: 'serial_number' },
          ].map(({ label, field }) => (
            <div key={field}>
              <div className="text-xs font-semibold text-[#A1A1AA] mb-1">{label}</div>
              {editing ? (
                <input className="form-control" value={(form as any)[field] || ''}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
              ) : (
                <div className="text-sm text-[#18181B]">{(eq as any)[field] || '—'}</div>
              )}
            </div>
          ))}
          <div>
            <div className="text-xs font-semibold text-[#A1A1AA] mb-1">Клиент</div>
            {eq.client_id ? (
              <div className="text-sm text-[#18181B]">{eq.company_name}</div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#A1A1AA]">Не привязано</span>
                {canEdit && (
                  <button onClick={() => setShowAssign(true)}
                    className="flex items-center gap-1 text-xs text-[#003399] hover:underline font-medium">
                    <UserPlus size={13} /> Привязать
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold text-[#A1A1AA] mb-1">Примечания</div>
          {editing ? (
            <textarea className="form-control" rows={2} value={form.notes || ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          ) : (
            <div className="text-sm text-[#18181B]">{eq.notes || '—'}</div>
          )}
        </div>
      </div>

      {/* Модалка привязки к клиенту */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E4E4E7] w-full max-w-sm p-6 shadow-lg">
            <h3 className="font-bold text-[#18181B] text-lg mb-4">Привязать к клиенту</h3>
            <p className="text-sm text-[#71717A] mb-4">
              После привязки оборудование перейдёт из каталога в раздел «Оборудование клиентов».
            </p>
            <select className="form-control mb-4" value={assignClientId} onChange={e => setAssignClientId(e.target.value)}>
              <option value="">— выберите клиента —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowAssign(false)} className="btn btn-secondary flex-1 justify-center">Отмена</button>
              <button onClick={handleAssign} className="btn btn-primary flex-1 justify-center">Привязать</button>
            </div>
          </div>
        </div>
      )}

      {/* Характеристики */}
      {fields.length > 0 && (
        <div className="card p-5">
          <div className="text-sm font-semibold text-[#71717A] uppercase tracking-wide mb-4">Характеристики</div>
          <div className="grid grid-cols-2 gap-4">
            {fields.map(f => (
              <div key={f.id}>
                <div className="text-xs font-semibold text-[#A1A1AA] mb-1">
                  {f.name}{f.unit ? <span className="font-normal"> ({f.unit})</span> : ''}
                </div>
                {editing ? (
                  <input className="form-control" placeholder="—"
                    value={chars[f.id] || ''}
                    onChange={e => setChars(c => ({ ...c, [f.id]: e.target.value }))} />
                ) : (
                  <div className="text-sm text-[#18181B]">{chars[f.id] || '—'}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
