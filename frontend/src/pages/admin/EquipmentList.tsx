import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { getCache, setCache } from '../../api/cache'
import toast from 'react-hot-toast'
import { Search, Plus, BookOpen, Users, ChevronDown, ChevronRight, Factory } from 'lucide-react'
import { companyInitials } from '../../utils/helpers'

interface Equipment {
  id: string; model: string; manufacturer: string; serial_number: string
  company_name: string; client_id: string | null; tickets_count: string
}
interface Client { id: string; company_name: string }
interface Brand { id: string; name: string }

const emptyForm = { client_id: '', model: '', manufacturer: '', serial_number: '', notes: '' }

export default function EquipmentList() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'catalog' | 'clients'>('catalog')
  const [items, setItems] = useState<Equipment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [search, setSearch] = useState('')
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set())
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
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

    const cachedBrands = getCache('equipment_brands')
    if (cachedBrands) setBrands(cachedBrands)
    api.get('/settings/equipment_brands').then(r => { setCache('equipment_brands', r.data || []); setBrands(r.data || []) }).catch(() => {})
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

  const toggleBrand = (brand: string) => {
    setExpandedBrands(prev => {
      const next = new Set(prev)
      next.has(brand) ? next.delete(brand) : next.add(brand)
      return next
    })
  }

  const toggleClient = (clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev)
      next.has(clientId) ? next.delete(clientId) : next.add(clientId)
      return next
    })
  }

  // Каталог — без клиента
  const catalog = items.filter(e => !e.client_id)
  const clientEq = items.filter(e => !!e.client_id)

  // Группировка каталога по производителю
  const catalogGrouped: Record<string, Equipment[]> = {}
  catalog.forEach(eq => {
    const key = eq.manufacturer || 'Без производителя'
    if (!catalogGrouped[key]) catalogGrouped[key] = []
    catalogGrouped[key].push(eq)
  })

  // Группировка клиентского по client_id
  const clientGrouped: Record<string, Equipment[]> = {}
  clientEq.forEach(eq => {
    const key = eq.client_id!
    if (!clientGrouped[key]) clientGrouped[key] = []
    clientGrouped[key].push(eq)
  })

  const s = search.toLowerCase()

  const filteredCatalogGroups = Object.entries(catalogGrouped).filter(([brand, eqs]) => {
    if (!search) return true
    return brand.toLowerCase().includes(s) || eqs.some(eq =>
      eq.model.toLowerCase().includes(s) || (eq.serial_number || '').toLowerCase().includes(s)
    )
  })

  const filteredClientGroups = Object.entries(clientGrouped).filter(([, eqs]) => {
    if (!search) return true
    return (eqs[0].company_name || '').toLowerCase().includes(s) ||
      eqs.some(eq => eq.model.toLowerCase().includes(s) || (eq.manufacturer || '').toLowerCase().includes(s) || (eq.serial_number || '').toLowerCase().includes(s))
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
          label="Каталог" count={catalog.length} onClick={() => setTab('catalog')} />
        <TabBtn active={tab === 'clients'} icon={<Users size={15} />}
          label="Оборудование клиентов" count={clientEq.length} onClick={() => setTab('clients')} />
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 border border-[#E4E4E7] rounded px-3 py-2 bg-white max-w-sm mb-4">
        <Search size={15} className="text-[#A1A1AA]" />
        <input className="outline-none text-sm flex-1 bg-transparent" placeholder="Поиск..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* ── КАТАЛОГ ── */}
      {tab === 'catalog' && (
        <div className="space-y-2">
          {filteredCatalogGroups.length === 0 && (
            <div className="card py-10 text-center text-[#71717A] text-sm">Каталог пуст</div>
          )}
          {filteredCatalogGroups.map(([brand, eqs]) => {
            const isOpen = expandedBrands.has(brand)
            const visibleEqs = search
              ? eqs.filter(eq => eq.model.toLowerCase().includes(s) || (eq.serial_number || '').toLowerCase().includes(s) || brand.toLowerCase().includes(s))
              : eqs
            return (
              <div key={brand} className="card overflow-hidden">
                {/* Заголовок марки */}
                <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none hover:bg-[#FAFAFA] transition-colors"
                  onClick={() => toggleBrand(brand)}>
                  <div className="text-[#A1A1AA]">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                  <div className="w-9 h-9 rounded-full bg-[#CC0033]/10 flex items-center justify-center flex-shrink-0">
                    <Factory size={16} className="text-[#CC0033]" />
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-[#18181B]">{brand}</div>
                    <div className="text-xs text-[#A1A1AA]">{eqs.length} {eqs.length === 1 ? 'модель' : eqs.length < 5 ? 'модели' : 'моделей'}</div>
                  </div>
                </div>

                {/* Модели марки */}
                {isOpen && (
                  <div className="border-t border-[#F4F4F5]">
                    <table className="w-full text-sm table-fixed">
                      <colgroup>
                        <col style={{ width: 'auto' }} />
                        <col style={{ width: 320 }} />
                        <col style={{ width: 120 }} />
                      </colgroup>
                      <thead>
                        <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                          {['Модель', 'Серийный №', 'Заявок'].map(h => (
                            <th key={h} className="px-5 py-2.5 text-left font-semibold text-[#71717A]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visibleEqs.map(eq => (
                          <tr key={eq.id} onClick={() => navigate(`/admin/equipment/${eq.id}`)}
                            className="border-b border-[#F4F4F5] last:border-b-0 hover:bg-[#FAFAFA] cursor-pointer transition-colors">
                            <td className="px-5 py-2.5 font-semibold text-[#18181B] truncate">{eq.model}</td>
                            <td className="px-5 py-2.5 text-[#71717A] truncate">{eq.serial_number || '—'}</td>
                            <td className="px-5 py-2.5 font-bold text-[#CC0033]">{eq.tickets_count}</td>
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

      {/* ── ОБОРУДОВАНИЕ КЛИЕНТОВ ── */}
      {tab === 'clients' && (
        <div className="space-y-2">
          {filteredClientGroups.length === 0 && (
            <div className="card py-10 text-center text-[#71717A] text-sm">Нет оборудования клиентов</div>
          )}
          {filteredClientGroups.map(([clientId, eqs]) => {
            const isOpen = expandedClients.has(clientId)
            const companyName = eqs[0].company_name || 'Клиент'
            const visibleEqs = search
              ? eqs.filter(eq =>
                  eq.model.toLowerCase().includes(s) ||
                  (eq.manufacturer || '').toLowerCase().includes(s) ||
                  (eq.serial_number || '').toLowerCase().includes(s) ||
                  companyName.toLowerCase().includes(s))
              : eqs
            return (
              <div key={clientId} className="card overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer select-none hover:bg-[#FAFAFA] transition-colors"
                  onClick={() => toggleClient(clientId)}>
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
                {isOpen && (
                  <div className="border-t border-[#F4F4F5]">
                    <table className="w-full text-sm table-fixed">
                      <colgroup>
                        <col style={{ width: 'auto' }} />
                        <col style={{ width: 220 }} />
                        <col style={{ width: 260 }} />
                        <col style={{ width: 120 }} />
                      </colgroup>
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
                            <td className="px-5 py-2.5 font-semibold truncate">{eq.model}</td>
                            <td className="px-5 py-2.5 text-[#71717A] truncate">{eq.manufacturer || '—'}</td>
                            <td className="px-5 py-2.5 text-[#71717A] truncate">{eq.serial_number || '—'}</td>
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
              <F label="Производитель (марка)">
                <select className="form-control" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)}>
                  <option value="">— выберите марку —</option>
                  {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                  <option value="__other__">Другой...</option>
                </select>
                {form.manufacturer === '__other__' && (
                  <input className="form-control mt-2" placeholder="Введите производителя"
                    onChange={e => set('manufacturer', e.target.value)} />
                )}
              </F>
              <F label="Модель" required>
                <input className="form-control" placeholder="Например: A-160"
                  value={form.model} onChange={e => set('model', e.target.value)} />
              </F>
              <F label="Серийный номер">
                <input className="form-control" placeholder="SN-00001"
                  value={form.serial_number} onChange={e => set('serial_number', e.target.value)} />
              </F>
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
