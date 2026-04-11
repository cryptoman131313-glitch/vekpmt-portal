import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { ArrowLeft } from 'lucide-react'

interface Equipment {
  id: string; model: string; manufacturer: string; serial_number: string
  notes: string; tickets_count: string; characteristics: Record<string, string>
  installation_date: string; warranty_until: string
}
interface Field { id: string; name: string; unit: string }

export default function ClientEquipmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [eq, setEq] = useState<Equipment | null>(null)
  const [fields, setFields] = useState<Field[]>([])

  useEffect(() => {
    Promise.all([
      api.get(`/equipment/client/${id}`),
      api.get('/settings/equipment_fields')
    ]).then(([eqRes, fieldsRes]) => {
      setEq(eqRes.data)
      setFields(fieldsRes.data || [])
    }).catch(() => {})
  }, [id])

  if (!eq) return <div className="p-6 text-[#71717A]">Загрузка...</div>

  const warrantyActive = eq.warranty_until && new Date(eq.warranty_until) > new Date()

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/client/equipment')}
          className="text-[#71717A] hover:text-[#18181B] transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-[#18181B]">{eq.model}</h1>
      </div>

      {/* Основное */}
      <div className="card p-5 mb-4">
        <div className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-4">Основное</div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-[#A1A1AA] mb-1">Модель</div>
            <div className="text-sm font-semibold text-[#18181B]">{eq.model || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[#A1A1AA] mb-1">Производитель</div>
            <div className="text-sm font-semibold text-[#18181B]">{eq.manufacturer || '—'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[#A1A1AA] mb-1">Серийный номер</div>
            <div className="text-sm font-semibold text-[#18181B]">{eq.serial_number || '—'}</div>
          </div>
          {eq.installation_date && (
            <div>
              <div className="text-xs font-semibold text-[#A1A1AA] mb-1">Дата установки</div>
              <div className="text-sm font-semibold text-[#18181B]">
                {new Date(eq.installation_date).toLocaleDateString('ru-RU')}
              </div>
            </div>
          )}
          {eq.warranty_until && (
            <div>
              <div className="text-xs font-semibold text-[#A1A1AA] mb-1">Гарантия до</div>
              <div className={`text-sm font-semibold ${warrantyActive ? 'text-green-600' : 'text-[#71717A]'}`}>
                {new Date(eq.warranty_until).toLocaleDateString('ru-RU')}
                {warrantyActive && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Активна</span>}
              </div>
            </div>
          )}
          <div>
            <div className="text-xs font-semibold text-[#A1A1AA] mb-1">Заявок</div>
            <div className="text-sm font-semibold text-[#CC0033]">{eq.tickets_count || 0}</div>
          </div>
        </div>
        {eq.notes && (
          <div className="mt-4 pt-4 border-t border-[#E4E4E7]">
            <div className="text-xs font-semibold text-[#A1A1AA] mb-1">Примечания</div>
            <div className="text-sm text-[#18181B]">{eq.notes}</div>
          </div>
        )}
      </div>

      {/* Характеристики */}
      {fields.length > 0 && (
        <div className="card p-5 mb-4">
          <div className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-4">Технические характеристики</div>
          <div className="grid grid-cols-2 gap-4">
            {fields.map(f => (
              <div key={f.id}>
                <div className="text-xs font-semibold text-[#A1A1AA] mb-1">
                  {f.name}{f.unit ? <span className="font-normal"> ({f.unit})</span> : ''}
                </div>
                <div className="text-sm font-semibold text-[#18181B]">{eq.characteristics?.[f.id] || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={() => navigate('/client/tickets/new')} className="btn btn-primary">
        Создать заявку по этому оборудованию
      </button>
    </div>
  )
}
