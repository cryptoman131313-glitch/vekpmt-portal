import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import toast from 'react-hot-toast'
import { Search, UserPlus, Eye, EyeOff } from 'lucide-react'

interface Client { id: string; company_name: string; contact_name: string; contact_phone: string; contact_email: string; equipment_count: string; tickets_count: string }

const emptyForm = { company_name: '', inn: '', legal_address: '', actual_address: '', contact_name: '', contact_phone: '', contact_email: '', password: '' }

export default function ClientsList() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const load = () => api.get('/clients', { params: search ? { search } : {} }).then(r => setClients(r.data)).catch(() => {})

  useEffect(() => { load() }, [])

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  const handleCreate = async () => {
    if (!form.company_name || !form.contact_name || !form.contact_phone || !form.contact_email || !form.password) {
      toast.error('Заполните все обязательные поля'); return
    }
    setLoading(true)
    try {
      await api.post('/clients', form)
      toast.success('Клиент добавлен')
      setShowForm(false)
      setForm(emptyForm)
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка')
    } finally { setLoading(false) }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#18181B]">Клиенты</h1>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          <UserPlus size={15} /> Добавить клиента
        </button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="flex items-center gap-2 border border-[#E4E4E7] rounded px-3 py-2 bg-white min-w-[300px]">
          <Search size={15} className="text-[#A1A1AA]" />
          <input className="outline-none text-sm flex-1 bg-transparent" placeholder="Поиск по клиентам..."
            value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                {['Организация', 'Контактное лицо', 'Телефон', 'Email', 'Оборудование', 'Заявок'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-[#71717A]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-[#71717A]">Клиентов не найдено</td></tr>
              )}
              {clients.map(c => (
                <tr key={c.id} onClick={() => navigate(`/admin/clients/${c.id}`)}
                  className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA] cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-semibold text-[#18181B]">{c.company_name}</td>
                  <td className="px-4 py-3">{c.contact_name}</td>
                  <td className="px-4 py-3 text-[#71717A]">{c.contact_phone}</td>
                  <td className="px-4 py-3 text-[#71717A]">{c.contact_email}</td>
                  <td className="px-4 py-3 font-bold">{c.equipment_count}</td>
                  <td className="px-4 py-3 font-bold">{c.tickets_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модалка добавления клиента */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E4E4E7] w-full max-w-lg p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-[#18181B] text-lg mb-5">Новый клиент</h3>
            <div className="space-y-3">
              <F label="Название организации" required>
                <input className="form-control" autoComplete="off" placeholder="ООО «Название»" value={form.company_name} onChange={e => set('company_name', e.target.value)} />
              </F>
              <F label="Юридический адрес">
                <input className="form-control" autoComplete="off" placeholder="г. Москва, ул. Примерная, д. 1" value={form.legal_address} onChange={e => set('legal_address', e.target.value)} />
              </F>
              <div className="grid grid-cols-2 gap-3">
                <F label="ИНН">
                  <input className="form-control" autoComplete="off" placeholder="7712345678" value={form.inn} onChange={e => set('inn', e.target.value)} />
                </F>
                <F label="ФИО контакта" required>
                  <input className="form-control" autoComplete="off" placeholder="Иванов Алексей" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
                </F>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <F label="Телефон" required>
                  <input className="form-control" autoComplete="off" placeholder="+7 (999) 123-45-67" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} />
                </F>
                <F label="Email" required>
                  <input className="form-control" autoComplete="off" type="email" placeholder="ivanov@company.ru" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} />
                </F>
              </div>
              <F label="Пароль для входа в ЛК" required>
                <div className="relative">
                  <input className="form-control pr-10" type={showPassword ? 'text' : 'password'}
                    placeholder="Минимум 8 символов" value={form.password} onChange={e => set('password', e.target.value)} />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#18181B] transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </F>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowForm(false); setForm(emptyForm) }} className="btn btn-secondary flex-1 justify-center">Отмена</button>
              <button onClick={handleCreate} disabled={loading} className="btn btn-primary flex-[2] justify-center disabled:opacity-60">
                {loading ? 'Создание...' : 'Создать клиента'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function F({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#18181B] mb-1">
        {label} {required && <span className="text-[#CC0033]">*</span>}
      </label>
      {children}
    </div>
  )
}
