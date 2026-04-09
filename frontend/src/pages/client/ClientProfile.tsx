import { useEffect, useState } from 'react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Save } from 'lucide-react'

interface Profile { company_name: string; inn: string; legal_address: string; contact_name: string; contact_phone: string; contact_email: string }
interface Billing { bank_name?: string; bik?: string; account?: string; corr_account?: string; kpp?: string; ogrn?: string }

export default function ClientProfile() {
  const { client } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [billing, setBilling] = useState<Billing>({})
  const [billingLoading, setBillingLoading] = useState(false)
  const [tab, setTab] = useState<'profile' | 'billing'>('profile')

  useEffect(() => {
    api.get('/clients/me/profile').then(r => {
      setProfile(r.data)
      setContactName(r.data.contact_name || '')
      setContactPhone(r.data.contact_phone || '')
    }).catch(() => {})
    api.get('/clients/me/billing').then(r => setBilling(r.data || {})).catch(() => {})
  }, [])

  const handleSaveBilling = async () => {
    setBillingLoading(true)
    try {
      await api.patch('/clients/me/billing', billing)
      toast.success('Реквизиты сохранены')
    } catch { toast.error('Ошибка') }
    finally { setBillingLoading(false) }
  }

  const handleSave = async () => {
    if (password && password !== passwordConfirm) {
      toast.error('Пароли не совпадают'); return
    }
    if (password && password.length < 8) {
      toast.error('Пароль минимум 8 символов'); return
    }
    setLoading(true)
    try {
      await api.patch('/clients/me/profile', {
        contact_name: contactName,
        contact_phone: contactPhone,
        ...(password ? { password } : {})
      })
      toast.success('Данные сохранены')
      setPassword('')
      setPasswordConfirm('')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка')
    } finally { setLoading(false) }
  }

  if (!profile) return <div className="p-6 text-[#71717A]">Загрузка...</div>

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-2xl font-bold text-[#18181B] mb-4">Мой профиль</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-[#E4E4E7]">
        {[{ key: 'profile', label: 'Профиль' }, { key: 'billing', label: 'Реквизиты для счёта' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === t.key ? 'border-[#003399] text-[#003399]' : 'border-transparent text-[#71717A] hover:text-[#18181B]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Billing tab */}
      {tab === 'billing' && (
        <div className="card p-5 space-y-4">
          <div className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-1">Банковские реквизиты</div>
          <div className="text-xs text-[#A1A1AA] mb-3">Используются для выставления счётов. Данные хранятся только в вашем аккаунте.</div>
          {[
            { key: 'bank_name', label: 'Наименование банка', placeholder: 'ПАО Сбербанк' },
            { key: 'bik', label: 'БИК', placeholder: '044525225' },
            { key: 'account', label: 'Расчётный счёт', placeholder: '40702810000000000000' },
            { key: 'corr_account', label: 'Корреспондентский счёт', placeholder: '30101810400000000225' },
            { key: 'kpp', label: 'КПП', placeholder: '770101001' },
            { key: 'ogrn', label: 'ОГРН / ОГРНИП', placeholder: '1234567890123' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium mb-1">{f.label}</label>
              <input className="form-control" placeholder={f.placeholder}
                value={(billing as any)[f.key] || ''}
                onChange={e => setBilling(b => ({ ...b, [f.key]: e.target.value }))} />
            </div>
          ))}
          <div className="pt-2">
            <button onClick={handleSaveBilling} disabled={billingLoading}
              className="btn btn-primary w-full justify-center disabled:opacity-60">
              <Save size={15} /> {billingLoading ? 'Сохранение...' : 'Сохранить реквизиты'}
            </button>
          </div>
        </div>
      )}

      {/* Profile tab */}
      {tab === 'profile' && <>
      {/* Avatar */}
      <div className="card p-5 mb-4 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#003399] text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
          {profile.contact_name?.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="font-bold text-lg text-[#18181B]">{profile.contact_name}</div>
          <div className="text-sm text-[#71717A]">{profile.contact_email}</div>
          <div className="text-xs mt-1 text-[#71717A]">{profile.company_name}</div>
        </div>
      </div>

      {/* Company info — readonly */}
      <div className="card p-5 mb-4">
        <div className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-3">Данные организации</div>
        <div className="space-y-3">
          {[
            { label: 'Организация', value: profile.company_name },
            { label: 'ИНН', value: profile.inn },
            { label: 'Юридический адрес', value: profile.legal_address },
          ].map(f => (
            <div key={f.label}>
              <div className="text-xs font-semibold text-[#A1A1AA] mb-0.5">{f.label}</div>
              <div className="text-sm text-[#18181B]">{f.value || '—'}</div>
            </div>
          ))}
          <div className="text-[11px] text-[#A1A1AA] pt-1">Для изменения данных организации обратитесь к менеджеру</div>
        </div>
      </div>

      {/* Editable contact info */}
      <div className="card p-5 space-y-4">
        <div className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-2">Контактные данные</div>
        <div>
          <label className="block text-sm font-medium mb-1">Контактное лицо</label>
          <input className="form-control" value={contactName} onChange={e => setContactName(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Телефон</label>
          <input className="form-control" value={contactPhone} onChange={e => setContactPhone(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input className="form-control bg-[#FAFAFA]" value={profile.contact_email} disabled />
          <div className="text-[10px] text-[#A1A1AA] mt-0.5">Email изменить нельзя</div>
        </div>

        <div className="pt-3 border-t border-[#E4E4E7]">
          <div className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-3">Смена пароля</div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Новый пароль</label>
              <div className="relative">
                <input className="form-control pr-10" type={showPass ? 'text' : 'password'}
                  placeholder="Минимум 8 символов" autoComplete="new-password"
                  value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#71717A]">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Повторите пароль</label>
              <input className="form-control" type={showPass ? 'text' : 'password'}
                placeholder="Повторите новый пароль" autoComplete="new-password"
                value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="pt-3">
          <button onClick={handleSave} disabled={loading} className="btn btn-primary w-full justify-center disabled:opacity-60">
            <Save size={15} /> {loading ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </div>
      </>}
    </div>
  )
}
