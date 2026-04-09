import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { formatDate, statusLabel, statusBadgeClass } from '../../utils/helpers'
import { Search, Plus } from 'lucide-react'

interface Ticket {
  id: number; company_name: string; type_name: string; type_color: string
  status: string; created_at: string; equipment_model: string
  equipment_serial: string; serial_manual: string; assigned_name: string
}
interface TicketType { id: string; name: string; statuses?: { id: string; name: string; color: string }[] }

export default function TicketsList() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [types, setTypes] = useState<TicketType[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterType, setFilterType] = useState('')

  const load = () => {
    const params: Record<string, string | number> = { page, limit }
    if (search) params.search = search
    if (filterStatus) params.status = filterStatus
    if (filterType) params.type_id = filterType
    api.get('/tickets', { params }).then(r => {
      setTickets(r.data.tickets || [])
      setTotal(r.data.total || 0)
    }).catch(() => {})
  }

  useEffect(() => {
    api.get('/users/ticket-types').then(r => setTypes(r.data)).catch(() => {})
  }, [])

  useEffect(() => { load() }, [page, limit, filterStatus, filterType])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#18181B]">Заявки</h1>
        </div>
        <button onClick={() => navigate('/admin/tickets/new')} className="btn btn-primary">
          <Plus size={16} /> Новая заявка
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select className="form-control" style={{ width: 'auto', minWidth: 160 }}
          value={filterType} onChange={e => { setFilterType(e.target.value); setFilterStatus(''); setPage(1) }}>
          <option value="">Тип — все</option>
          {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto', minWidth: 160 }}
          value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
          <option value="">Статус — все</option>
          {(filterType
            ? (types.find(t => t.id === filterType)?.statuses || [])
            : types.flatMap(t => t.statuses || []).filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i)
          ).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="flex items-center gap-2 border border-[#E4E4E7] rounded px-3 py-2 bg-white min-w-[220px]">
          <Search size={15} className="text-[#A1A1AA] flex-shrink-0" />
          <input className="outline-none text-sm flex-1 bg-transparent" placeholder="Поиск по заявкам..."
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load()} />
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                {['#', 'Дата', 'Клиент', 'Оборудование', 'Серийный №', 'Тип', 'Инженер', 'Статус'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-[#71717A] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-[#71717A]">Заявок не найдено</td></tr>
              )}
              {tickets.map(t => (
                <tr key={t.id} onClick={() => navigate(`/admin/tickets/${t.id}`)}
                  className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA] cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-bold text-[#CC0033]">#{t.id}</td>
                  <td className="px-4 py-3 text-[#71717A] whitespace-nowrap">{formatDate(t.created_at)}</td>
                  <td className="px-4 py-3 font-medium">{t.company_name || '—'}</td>
                  <td className="px-4 py-3 text-[#71717A]">{t.equipment_model || '—'}</td>
                  <td className="px-4 py-3 text-[#71717A]">{t.equipment_serial || t.serial_manual || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{ background: t.type_color + '20', color: t.type_color }}>{t.type_name || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-[#71717A]">{t.assigned_name || '—'}</td>
                  <td className="px-4 py-3"><span className={`badge ${statusBadgeClass(t.status)}`}>{statusLabel(t.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#E4E4E7]">
          <div className="flex items-center gap-2 text-sm text-[#71717A]">
            Показывать:
            <select className="form-control" style={{ width: 'auto', minWidth: 70, padding: '4px 24px 4px 8px', fontSize: 13 }}
              value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1) }}>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            записей / всего {total}
          </div>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 7).map(p => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 rounded text-sm font-medium transition-colors ${p === page ? 'bg-[#CC0033] text-white' : 'text-[#71717A] hover:bg-[#F4F4F5]'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
