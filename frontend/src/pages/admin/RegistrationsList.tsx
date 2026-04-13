import { useEffect, useState } from 'react'
import api from '../../api/client'
import { getCache, setCache } from '../../api/cache'
import { formatDate } from '../../utils/helpers'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle } from 'lucide-react'

interface Reg {
  id: string; company_name: string; inn: string; contact_name: string
  contact_email: string; contact_phone: string; created_at: string
  status: string; rejected_reason: string; reviewed_by_name: string; reviewed_at: string
}

const TABS = [
  { key: 'pending', label: 'Ожидают' },
  { key: 'approved', label: 'Одобренные' },
  { key: 'rejected', label: 'Отклонённые' },
]

export default function RegistrationsList() {
  const [tab, setTab] = useState('pending')
  const [items, setItems] = useState<Reg[]>([])
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = () => {
    const key = `registrations_${tab}`
    const cached = getCache(key)
    if (cached) setItems(cached)
    api.get('/registrations', { params: { status: tab } }).then(r => { setCache(key, r.data); setItems(r.data) }).catch(() => {})
  }

  useEffect(() => { load() }, [tab])

  const approve = async (id: string) => {
    try {
      await api.post(`/registrations/${id}/approve`)
      toast.success('Регистрация одобрена')
      load()
    } catch (err: any) { toast.error(err.response?.data?.error || 'Ошибка') }
  }

  const reject = async () => {
    if (!rejectId) return
    try {
      await api.post(`/registrations/${rejectId}/reject`, { reason: rejectReason })
      toast.success('Отклонено')
      setRejectId(null)
      setRejectReason('')
      load()
    } catch { toast.error('Ошибка') }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#18181B]">Регистрации</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-[#E4E4E7]">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === t.key ? 'border-[#CC0033] text-[#CC0033]' : 'border-transparent text-[#71717A] hover:text-[#18181B]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        {items.length === 0 ? (
          <div className="py-12 text-center text-[#A1A1AA] text-sm">
            {tab === 'pending' ? 'Новых заявок на регистрацию нет' : 'Нет записей'}
          </div>
        ) : (
          <div className="divide-y divide-[#F4F4F5]">
            {items.map(r => (
              <div key={r.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-[#18181B]">{r.company_name}</span>
                      {r.inn && <span className="text-xs text-[#71717A] bg-[#F4F4F5] px-2 py-0.5 rounded">ИНН: {r.inn}</span>}
                      <span className="text-xs text-[#A1A1AA]">{formatDate(r.created_at)}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div><span className="text-[#71717A]">Контакт: </span>{r.contact_name}</div>
                      <div><span className="text-[#71717A]">Телефон: </span>{r.contact_phone}</div>
                      <div><span className="text-[#71717A]">Email: </span>{r.contact_email}</div>
                    </div>
                    {r.status === 'rejected' && r.rejected_reason && (
                      <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded">
                        Причина отказа: {r.rejected_reason}
                      </div>
                    )}
                    {r.status !== 'pending' && r.reviewed_by_name && (
                      <div className="mt-1 text-xs text-[#A1A1AA]">
                        {r.status === 'approved' ? 'Одобрено' : 'Отклонено'} — {r.reviewed_by_name} · {formatDate(r.reviewed_at)}
                      </div>
                    )}
                  </div>
                  {tab === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => approve(r.id)} className="btn btn-success gap-1.5">
                        <CheckCircle size={15} /> Подтвердить
                      </button>
                      <button onClick={() => { setRejectId(r.id); setRejectReason('') }} className="btn btn-danger gap-1.5">
                        <XCircle size={15} /> Отклонить
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E4E4E7] w-full max-w-md p-6 shadow-lg">
            <h3 className="font-bold text-[#18181B] mb-4">Причина отклонения</h3>
            <textarea className="form-control mb-4" rows={3} placeholder="Укажите причину (необязательно)..."
              value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => setRejectId(null)} className="btn btn-secondary flex-1 justify-center">Отмена</button>
              <button onClick={reject} className="btn btn-danger flex-[2] justify-center">Отклонить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
