import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { formatDate, statusLabel, statusBadgeClass } from '../../utils/helpers'
import { Plus } from 'lucide-react'

interface Ticket { id: number; type_name: string; type_color: string; status: string; created_at: string; equipment_model: string; description: string }

export default function ClientTickets() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<Ticket[]>([])

  useEffect(() => {
    api.get('/tickets/client/list').then(r => setTickets(r.data)).catch(() => {})
  }, [])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#18181B]">Мои заявки</h1>
        <button onClick={() => navigate('/client/tickets/new')} className="btn btn-blue">
          <Plus size={16} /> Новая заявка
        </button>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                {['#', 'Дата', 'Оборудование', 'Тип', 'Описание', 'Статус'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-[#71717A]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-[#71717A]">
                  У вас пока нет заявок. <button onClick={() => navigate('/client/tickets/new')} className="text-[#003399] underline">Создать первую?</button>
                </td></tr>
              )}
              {tickets.map(t => (
                <tr key={t.id} onClick={() => navigate(`/client/tickets/${t.id}`)}
                  className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA] cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-bold text-[#003399]">#{t.id}</td>
                  <td className="px-4 py-3 text-[#71717A] whitespace-nowrap">{formatDate(t.created_at)}</td>
                  <td className="px-4 py-3">{t.equipment_model || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{ background: t.type_color + '20', color: t.type_color }}>{t.type_name || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-[#71717A] max-w-[200px] truncate">{t.description}</td>
                  <td className="px-4 py-3"><span className={`badge ${statusBadgeClass(t.status)}`}>{statusLabel(t.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
