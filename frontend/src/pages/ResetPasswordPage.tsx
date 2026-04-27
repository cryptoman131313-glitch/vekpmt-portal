import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api/client'
import toast from 'react-hot-toast'
import { Eye, EyeOff, ArrowLeft } from 'lucide-react'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null) // null = проверяем

  // Проверяем токен на сервере при загрузке страницы
  useEffect(() => {
    if (!token) { setTokenValid(false); return }
    api.get(`/auth/validate-reset-token?token=${encodeURIComponent(token)}`)
      .then(({ data }) => setTokenValid(data.valid))
      .catch(() => setTokenValid(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { toast.error('Пароль минимум 8 символов'); return }
    if (password !== confirm) { toast.error('Пароли не совпадают'); return }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      toast.success('Пароль изменён')
      navigate('/login')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка')
    } finally { setLoading(false) }
  }

  const errorScreen = (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #18181B 0%, #27272A 50%, #003399 100%)' }}>
      <div className="bg-white rounded-xl p-8 max-w-sm w-full text-center">
        <div className="text-[#CC0033] font-semibold mb-2">Ссылка недействительна</div>
        <div className="text-sm text-[#71717A] mb-4">Ссылка для сброса пароля устарела или уже была использована. Запросите новую.</div>
        <Link to="/forgot-password" className="btn btn-primary justify-center w-full">Запросить заново</Link>
      </div>
    </div>
  )

  // Идёт проверка токена
  if (tokenValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #18181B 0%, #27272A 50%, #003399 100%)' }}>
        <div className="text-white text-sm opacity-60">Проверка ссылки...</div>
      </div>
    )
  }

  // Токен невалиден или истёк
  if (!tokenValid) return errorScreen

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #18181B 0%, #27272A 50%, #003399 100%)' }}>
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-sm w-full max-w-[400px] p-8">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo-icon.png" alt="" className="h-16 w-auto mb-3" onError={e => (e.currentTarget.style.display='none')} />
          <h1 className="text-xl font-bold text-[#18181B]">Новый пароль</h1>
          <div className="text-sm text-[#71717A] mt-0.5">Эффективная Техника</div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Новый пароль</label>
            <div className="relative">
              <input className="form-control pr-10" type={showPass ? 'text' : 'password'}
                placeholder="Минимум 8 символов" value={password}
                onChange={e => setPassword(e.target.value)} autoFocus />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA]">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Повторите пароль</label>
            <input className="form-control" type={showPass ? 'text' : 'password'}
              placeholder="Повторите пароль" value={confirm}
              onChange={e => setConfirm(e.target.value)} />
          </div>
          <button type="submit" disabled={loading}
            className="btn btn-primary w-full justify-center py-3 disabled:opacity-60">
            {loading ? 'Сохранение...' : 'Сохранить пароль'}
          </button>
          <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-[#71717A] hover:text-[#18181B] transition-colors">
            <ArrowLeft size={15} /> Вернуться ко входу
          </Link>
        </form>
      </div>
    </div>
  )
}
