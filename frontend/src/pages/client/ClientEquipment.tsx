import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { Wrench } from 'lucide-react'

interface Equipment {
  id: string; model: string; manufacturer: string; serial_number: string
  notes: string; tickets_count: string; characteristics: Record<string, string>
  installation_date: string; warranty_until: string
}
interface Field { id: string; name: string; unit: string }

export default function ClientEquipment() {
  const [items, setItems] = useState<Equipment[]>([])
  const [fields, setFields] = useState<Field[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/equipment/client/list').then(r => setItems(r.data)).catch(() => {})
    api.get('/settings/equipment_fields').then(r => setFields(r.data || [])).catch(() => {})
  }, [])

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold text-[#18181B]">Моё оборудование</h1>
      </div>
      <p className="text-sm text-[#71717A] mb-6">Оборудование, закреплённое за вашей организацией</p>

      {items.length === 0 ? (
        <div className="card py-16 text-center text-[#A1A1AA]">
          <Wrench size={40} className="mx-auto mb-3 opacity-30" />
          <div className="text-sm">Оборудование не найдено</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(eq => {
            const warrantyActive = eq.warranty_until && new Date(eq.warranty_until) > new Date()
            const filledChars = fields.filter(f => eq.characteristics?.[f.id])
            return (
              <div key={eq.id}
                className="card p-6 cursor-pointer hover:shadow-md transition-shadow flex flex-col"
                onClick={() => navigate(`/client/equipment/${eq.id}`)}>

                {/* Модель */}
                <div className="mb-4">
                  <div className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wide mb-1">Модель</div>
                  <div className="text-[22px] font-extrabold text-[#18181B] leading-tight">{eq.model}</div>
                  {eq.manufacturer && <div className="text-sm text-[#71717A] mt-0.5">{eq.manufacturer}</div>}
                </div>

                {/* Поля в сетке */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4 flex-1">
                  {eq.serial_number && (
                    <div>
                      <div className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wide">Серийный номер</div>
                      <div className="text-sm font-semibold text-[#18181B] mt-0.5">{eq.serial_number}</div>
                    </div>
                  )}
                  {eq.installation_date && (
                    <div>
                      <div className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wide">Дата установки</div>
                      <div className="text-sm font-semibold text-[#18181B] mt-0.5">
                        {new Date(eq.installation_date).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                  )}
                  {eq.warranty_until && (
                    <div>
                      <div className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wide">Гарантия до</div>
                      <div className={`text-sm font-bold mt-0.5 ${warrantyActive ? 'text-green-600' : 'text-[#71717A]'}`}>
                        {new Date(eq.warranty_until).toLocaleDateString('ru-RU')}
                      </div>
                    </div>
                  )}
                  {filledChars.map(f => (
                    <div key={f.id}>
                      <div className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wide">{f.name}</div>
                      <div className="text-sm font-semibold text-[#18181B] mt-0.5">
                        {eq.characteristics[f.id]}{f.unit && <span className="text-[#71717A] font-normal ml-1">{f.unit}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Футер */}
                <div className="border-t border-[#E4E4E7] pt-3 flex items-center justify-between mt-auto">
                  <div className="text-sm text-[#71717A]">
                    Заявок: <strong className="text-[#18181B]">{eq.tickets_count || 0}</strong>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/client/tickets/new?equipment_id=${eq.id}`) }}
                    className="btn btn-primary py-1.5 px-4 text-sm">
                    Создать заявку
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
