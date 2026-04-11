import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { getCache, setCache, invalidateCache } from '../../api/cache'
import toast from 'react-hot-toast'
import { Search, Plus, BookOpen, Users, ChevronDown, ChevronRight } from 'lucide-react'
import { companyInitials } from '../../utils/helpers'

interface Equipment {
  id: string; model: string; manufacturer: string; serial_number: string
  company_name: string; client_id: string | null; tickets_count: string
}
interface Client { id: string; company_name: string }

const emptyForm = { client_id: '', model: '', manufacturer: '', serial_number: '', notes: '' }

export default function EquipmentList() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'catalog' | 'clients'>('catalog')
  const [items, setItems] = useState<Equipment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  const load = () => {
    const cached = getCache('equipment')
    if (cached) setItems(cached)
    api.get('/equipment').then(r => { setCache('equipment', r.data); setItems(r.data) }).catch(() => {})
  }

  useEffect(() => {
    load()
    const cachedClients = getCache('clients')
    if (cachedClients) setClients(cachedClients)
    api.get('/clients').then(r => { setCache('clients', r.data); setClients(r.data) }).catch(() => {})
  }, [])

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

  const handleCreate = async () => {
    if (!form.model) { toast.error('Укажите модель'); return }
    setLoading(true)
    try {
      await api.post('/equipment', { ...form, client_id: form.client_id || null })
      toast.success('Оборудование добавлено')
      setShowForm(false)
      setForm(emptyForm)
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка')
    } finally { setLoading(false) }
  }

  const toggleClient = (clientId: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(clientId) ? next.delete(clientId) : next.add(clientId)
      return next
    })
  }

  // Каталог — только без клиента
  const catalog = items.filter(e => !e.client_id)
  // Оборудование клиентов — только привязанное, группируем по клиенту
  const clientEq = items.filter(e => !!e.client_id)

  // Группировка по client_id
  const grouped: Record<string, Equipment[]> = {}
  clientEq.forEach(eq => {
    const key = eq.client_id!
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(eq)
  })

  // Поиск для каталога
  const filteredCatalog = catalog.filter(eq => {
    if (!search) return true
    const s = search.toLowerCase()
    return eq.model.toLowerCase().includes(s)
      || (eq.manufacturer || '').toLowerCase().includes(s)
      || (eq.serial_number || '').toLowerCase().includes(s)
  })

  // Поиск для клиентского оборудования (фильтруем по имени клиента или оборудованию)
  const filteredGroups = Object.entries(grouped).filter(([, eqs]) => {
    if (!search) return true
    const s = search.toLowerCase()
    const clientMatch = (eqs[0].company_name || '').toLowerCase().includes(s)
    const eqMatch = eqs.some(eq =>
      eq.model.toLowerCase().includes(s) ||
      (eq.manufacturer || '').toLowerCase().includes(s) ||
      (eq.serial_number || '').toLowerCase().includes(s)
    )
    return clientMatch || eqMatch
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#18181B]">Оборудование</h1>
        <button onClick={() => { setForm(emptyForm); setShowForm(true) }} className="btn btn-primary">
          <Plus size={16} /> Добавить оборудование
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-[#E4E4E7]">
        <TabBtn active={tab === 'catalog'} icon={<BookOpen size={15} />}
          label="Каталог" count={catalog.length}
          onClick={() => setTab('catalog')} />
        <TabBtn active={tab === 'clients'} icon={<Users size={15} />}
          label="Оборудование клиентов" count={clientEq.length}
          onClick={() => setTab('clients')} />
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 border border-[#E4E4E7] rounded px-3 py-2 bg-white max-w-sm mb-4">
        <Search size={15} className="text-[#A1A1AA]" />
        <input className="outline-none text-sm flex-1 bg-transparent" placeholder="Поиск..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* ── КАТАЛОГ ── */}
      {tab === 'catalog' && (
        <div className="card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                {['Модель', 'Производитель', 'Серийный №', 'Заявок'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-[#71717A]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCatalog.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-[#71717A]">Каталог пуст</td></tr>
              )}
              {filteredCatalog.map(eq => (
                <tr key={eq.id} onClick={() => navigate(`/admin/equipment/${eq.id}`)}
                  className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA] cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-semibold">{eq.model}</td>
                  <td className="px-4 py-3 text-[#71717A]">{eq.manufacturer || '—'}</td>
                  <td className="px-4 py-3 text-[#71717A]">{eq.serial_number || '—'}</td>
                  <td className="px-4 py-3 font-bold">{eq.tickets_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ОБОРУДОВАНИЕ КЛИЕНТОВ ── */}
      {tab === 'clients' && (
        <div className="space-y-2">
          {filteredGroups.length === 0 && (
            <div className="card py-10 text-center text-[#71717A] text-sm">Нет оборудования клиентов</div>
          )}
          {filteredGroups.map(([clientId, eqs]) => {
            const isOpen = expanded.has(clientId)
            const companyName = eqs[0].company_name || 'Клиент'
            // Фильтруем оборудование внутри клиента по поиску
            const visibleEqs = search
              ? eqs.filter(eq =>
                  eq.model.toLowerCase().includes(search.toLowerCase()) ||
                  (eq.manufacturer || '').toLowerCase().includes(search.toLowerCase()) ||
                  (eq.serial_number || '').toLowerCase().includes(search.toLowerCase()) ||
                  companyName.toLowerCase().includes(search.toLowerCase())
                )
              : eqs
            return (
              <div key={clientId} className="card overflow-hidden">
                {/* Заголовок клиента */}
                <div
                  className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none hover:bg-[#FAFAFA] transition-colors"
                  onClick={() => toggleClient(clientId)}
                >
                  <div className="text-[#A1A1AA]">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                  <div className="w-9 h-9 rounded-full bg-[#003399] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {companyInitials(companyName)}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-[#18181B]">{companyName}</div>
                    <div className="text-xs text-[#A1A1AA]">{eqs.length} ед. оборудования</div>
                  </div>
                </div>

                {/* Оборудование клиента */}
                {isOpen && (
                  <div className="border-t border-[#F4F4F5]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                          {['Модель', 'Производитель', 'Серийный №', 'Заявок'].map(h => (
                            <th key={h} className="px-5 py-2.5 text-left font-semibold text-[#71717A]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleEqs.map(eq => (
                          <tr key={eq.id} onClick={() => navigate(`/admin/equipment/${eq.id}`)}
                            className="border-b border-[#F4F4F5] last:border-b-0 hover:bg-[#FAFAFA] cursor-pointer transition-colors">
                            <td className="px-5 py-2.5 font-semibold">{eq.model}</td>
                            <td className="px-5 py-2.5 text-[#71717A]">{eq.manufacturer || '—'}</td>
                            <td className="px-5 py-2.5 text-[#71717A]">{eq.serial_number || '—'}</td>
                            <td className="px-5 py-2.5 font-bold">{eq.tickets_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal добавления */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E4E4E7] w-full max-w-lg p-6 shadow-lg">
            <h3 className="font-bold text-[#18181B] text-lg mb-5">
              {tab === 'catalog' ? 'Добавить в каталог' : 'Новое оборудование клиента'}
            </h3>
            <div className="space-y-3">
              <F label="Клиент">
                <select className="form-control" value={form.client_id} onChange={e => set('client_id', e.target.value)}>
                  <option value="">— без клиента (в каталог) —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                </select>
              </F>
              <F label="Модель" required>
                <input className="form-control" placeholder="Например: A-160"
                  value={form.model} onChange={e => set('model', e.target.value)} />
              </F>
              <div className="grid grid-cols-2 gap-3">
                <F label="Производитель">
                  <input className="form-control" placeholder="Например: Filpack"
                    value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} />
                </F>
                <F label="Серийный номер">
                  <input className="form-control" placeholder="SN-00001"
                    value={form.serial_number} onChange={e => set('serial_number', e.target.value)} />
                </F>
              </div>
              <F label="Примечания">
                <textarea className="form-control" rows={2} placeholder="Дополнительная информация..."
                  value={form.notes} onChange={e => set('notes', e.target.value)} />
              </F>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowForm(false); setForm(emptyForm) }}
                className="btn btn-secondary flex-1 justify-center">Отмена</button>
              <button onClick={handleCreate} disabled={loading}
                className="btn btn-primary flex-[2] justify-center disabled:opacity-60">
                {loading ? 'Добавление...' : 'Добавить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TabBtn({ active, icon, label, count, onClick }: {
  active: boolean; icon: React.ReactNode; label: string; count: number; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
        active ? 'border-[#CC0033] text-[#CC0033]' : 'border-transparent text-[#71717A] hover:text-[#18181B]'
      }`}>
      {icon}
      {label}
      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
        active ? 'bg-[#CC0033]/10 text-[#CC0033]' : 'bg-[#E4E4E7] text-[#71717A]'
      }`}>
        {count}
      </span>
    </button>
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
