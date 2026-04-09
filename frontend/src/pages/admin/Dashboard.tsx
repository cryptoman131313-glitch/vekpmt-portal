import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { formatDate, statusLabel, statusBadgeClass } from '../../utils/helpers'

interface Ticket { id: number; company_name: string; type_name: string; status: string; created_at: string; equipment_model: string }
interface ChartData {
  byDay: { date: string; count: number }[]
  byStatus: { status: string; count: number }[]
  byType: { name: string; color: string; count: number }[]
}

const STATUS_COLORS: Record<string, string> = {
  new: '#22C55E',
  in_progress: '#3B82F6',
  waiting_parts: '#F97316',
  waiting_client: '#EAB308',
  done: '#6B7280',
  cancelled: '#EF4444',
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [chart, setChart] = useState<ChartData | null>(null)

  useEffect(() => {
    api.get('/tickets?limit=8').then(r => setTickets(r.data.tickets || [])).catch(() => {})
    api.get('/tickets/stats/chart').then(r => setChart(r.data)).catch(() => {})
  }, [])

  const maxDay = Math.max(...(chart?.byDay.map(d => d.count) || [1]), 1)
  const totalStatus = chart?.byStatus.reduce((s, i) => s + i.count, 0) || 1

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#18181B]">Дашборд</h1>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-4 mb-6">

        {/* Bar chart — активность за 14 дней */}
        <div className="card p-5 col-span-2">
          <div className="text-sm font-semibold text-[#18181B] mb-4">Активность за 14 дней</div>
          {!chart || chart.byDay.length === 0 ? (
            <div className="h-28 flex items-center justify-center text-sm text-[#A1A1AA]">Нет данных</div>
          ) : (
            <div className="flex items-end gap-1.5 h-28">
              {chart.byDay.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#18181B] text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {d.count} зявок
                  </div>
                  <div
                    className="w-full rounded-t-sm bg-[#003399] hover:bg-[#CC0033] transition-colors cursor-default"
                    style={{ height: `${Math.max(4, (d.count / maxDay) * 100)}%`, minHeight: d.count > 0 ? 4 : 2 }}
                  />
                  <span className="text-[9px] text-[#A1A1AA] leading-none">{d.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status distribution */}
        <div className="card p-5">
          <div className="text-sm font-semibold text-[#18181B] mb-4">По статусам</div>
          {!chart || chart.byStatus.length === 0 ? (
            <div className="h-28 flex items-center justify-center text-sm text-[#A1A1AA]">Нет данных</div>
          ) : (
            <div className="space-y-2.5">
              {chart.byStatus.map((s, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#52525B] font-medium">{statusLabel(s.status)}</span>
                    <span className="font-bold text-[#18181B]">{s.count}</span>
                  </div>
                  <div className="h-1.5 bg-[#F4F4F5] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${(s.count / totalStatus) * 100}%`,
                        background: STATUS_COLORS[s.status] || '#71717A'
                      }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Types chart */}
      {chart && chart.byType.length > 0 && (
        <div className="card p-5 mb-6">
          <div className="text-sm font-semibold text-[#18181B] mb-4">По типам заявок</div>
          <div className="flex gap-3 flex-wrap">
            {chart.byType.map((t, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E4E4E7]">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color || '#71717A' }} />
                <span className="text-sm font-medium text-[#18181B]">{t.name}</span>
                <span className="text-sm font-bold text-[#71717A]">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent tickets */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E4E7]">
          <h2 className="font-semibold text-[#18181B]">Последние заявки</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
                {['#', 'Дата', 'Клиент', 'Оборудование', 'Тип', 'Статус'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-[#71717A]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-[#71717A]">Заявок пока нет</td></tr>
              )}
              {tickets.map(t => (
                <tr key={t.id} onClick={() => navigate(`/admin/tickets/${t.id}`)}
                  className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA] cursor-pointer transition-colors">
                  <td className="px-4 py-3 font-bold text-[#CC0033]">#{t.id}</td>
                  <td className="px-4 py-3 text-[#71717A]">{formatDate(t.created_at)}</td>
                  <td className="px-4 py-3 font-medium">{t.company_name || '—'}</td>
                  <td className="px-4 py-3 text-[#71717A]">{t.equipment_model || '—'}</td>
                  <td className="px-4 py-3">{t.type_name || '—'}</td>
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
