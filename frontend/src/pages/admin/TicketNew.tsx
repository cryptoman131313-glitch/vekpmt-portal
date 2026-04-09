import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import toast from 'react-hot-toast'

interface Client { id: string; company_name: string }
interface Equipment { id: string; model: string; serial_number: string }
interface TicketType { id: string; name: string }

export default function TicketNew() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [types, setTypes] = useState<TicketType[]>([])
  const [form, setForm] = useState({
    client_id: '', equipment_id: '', equipment_manual: '', serial_manual: '',
    type_id: '', description: '', manual: false,
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/clients').then(r => setClients(r.data)).catch(() => {})
    api.get('/users/ticket-types').then(r => setTypes(r.data)).catch(() => {})
  }, [])

  useEffect(() => {
    if (form.client_id) {
      api.get(`/clients/${form.client_id}/equipment`).then(r => setEquipment(r.data)).catch(() => {})
    } else {
      setEquipment([])
    }
  }, [form.client_id])

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client_id || !form.type_id || !form.description) {
      toast.error('Заполните обязательные поля'); return
    }
    setLoading(true)
    try {
      const { data } = await api.post('/tickets', {
        client_id: form.client_id,
        equipment_id: form.manual ? null : form.equipment_id || null,
        equipment_manual: form.manual ? form.equipment_manual : null,
        serial_manual: form.manual ? form.serial_manual : null,
        type_id: form.type_id,
        description: form.description,
      })
      toast.success('Заявка создана')
      navigate(`/admin/tickets/${data.id}`)
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
        <Field label="Клиент" required>
          <select className="form-control" value={form.client_id} onChange={e => set('client_id', e.target.value)} required>
            <option value="">Выберите клиента</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </Field>

        {form.client_id && (
          <Field label="Оборудование">
            <select className="form-control" value={form.equipment_id}
              onChange={e => { set('equipment_id', e.target.value); set('manual', e.target.value === '__manual__') }}>
              <option value="">Выберите оборудование</option>
              {equipment.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.model} {eq.serial_number ? `(${eq.serial_number})` : ''}</option>
              ))}
              <option value="__manual__">Ввести вручную...</option>
            </select>
          </Field>
        )}

        {form.manual && (
          <div className="grid grid-cols-2 gap-3 p-3 bg-[#FAFAFA] rounded border border-[#E4E4E7]">
            <Field label="Модель оборудования">
              <input className="form-control" placeholder="A-130 ПАКМАТИК" value={form.equipment_manual} onChange={e => set('equipment_manual', e.target.value)} />
            </Field>
            <Field label="Серийный номер">
              <input className="form-control" placeholder="SN-00001" value={form.serial_manual} onChange={e => set('serial_manual', e.target.value)} />
            </Field>
          </div>
        )}

        <Field label="Тип заявки" required>
          <select className="form-control" value={form.type_id} onChange={e => set('type_id', e.target.value)} required>
            <option value="">Выберите тип</option>
            {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>

        <Field label="Описание проблемы" required>
          <textarea className="form-control" rows={5} placeholder="Опишите проблему подробно..."
            value={form.description} onChange={e => set('description', e.target.value)} required />
        </Field>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate('/admin/tickets')} className="btn btn-secondary flex-1 justify-center py-3">
            Отмена
          </button>
          <button type="submit" disabled={loading} className="btn btn-primary flex-[2] justify-center py-3 disabled:opacity-60">
            {loading ? 'Создание...' : 'Создать заявку'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#18181B] mb-1.5">
        {label} {required && <span className="text-[#CC0033]">*</span>}
      </label>
      {children}
    </div>
  )
}
