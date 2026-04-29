import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import toast from 'react-hot-toast'
import { ShieldCheck, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const { loginUser, loginClient, user, client } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'staff' | 'client'>('staff')
  const [showPass, setShowPass] = useState(false)

  // 2FA step
  const [requires2fa, setRequires2fa] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [totpLoading, setTotpLoading] = useState(false)

  if (user) { navigate('/admin/dashboard', { replace: true }); return null }
  if (client) { navigate('/client/tickets', { replace: true }); return null }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Введите email и пароль'); return }
    setLoading(true)
    try {
      if (mode === 'staff') {
        const result = await loginUser(email, password)
        // Если loginUser вернул requires2fa
        if ((result as any)?.requires2fa) {
          setTempToken((result as any).tempToken)
          setRequires2fa(true)
          return
        }
        navigate('/admin/dashboard')
      } else {
        await loginClient(email, password)
        navigate('/client/tickets')
      }
    } catch (err: any) {
      // 429 — превышен лимит входов, отдельное понятное сообщение
      if (err.response?.status === 429) {
        toast.error(err.response?.data?.error || 'Слишком много попыток, попробуйте через 15 минут')
      } else {
        toast.error(err.response?.data?.error || 'Неверный email или пароль')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleTotp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!totpCode) { toast.error('Введите код'); return }
    setTotpLoading(true)
    try {
      const { data } = await api.post('/auth/2fa/verify-login', { tempToken, code: totpCode })
      // Сохраняем токен через loginUser с уже готовыми данными
      localStorage.setItem('token', data.token)
      window.location.href = '/admin/dashboard'
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Неверный код')
    } finally {
      setTotpLoading(false)
    }
  }

  // Экран ввода 2FA кода
  if (requires2fa) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(135deg, #18181B 0%, #27272A 50%, #003399 100%)'}}>
        <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-sm w-full max-w-[400px] p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 rounded-full bg-[#003399] flex items-center justify-center mb-3">
              <ShieldCheck size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-[#18181B]">Двухфакторная аутентификация</h1>
            <p className="text-sm text-[#71717A] mt-1 text-center">Введите 6-значный код из приложения Google Authenticator</p>
          </div>

          <form onSubmit={handleTotp}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-[#18181B] mb-1.5">Код из приложения</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9 ]*"
                maxLength={7}
                className="form-control text-center text-2xl font-bold tracking-[0.3em] py-3"
                placeholder="000000"
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
                autoFocus
                autoComplete="one-time-code"
              />
            </div>

            <button type="submit" disabled={totpLoading || totpCode.length < 6}
              className="btn btn-primary w-full justify-center py-3 text-base disabled:opacity-60">
              {totpLoading ? 'Проверка...' : 'Подтвердить'}
            </button>

            <button type="button" onClick={() => { setRequires2fa(false); setTotpCode('') }}
              className="mt-3 w-full text-center text-sm text-[#71717A] hover:text-[#18181B] transition-colors">
              ← Вернуться
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(135deg, #18181B 0%, #27272A 50%, #003399 100%)'}}>
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-sm w-full max-w-[400px] p-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <img src="/logo-icon.png" alt="Эффективная Техника" className="h-16 w-auto mb-3"
            onError={e => (e.currentTarget.style.display = 'none')} />
          <h1 className="text-xl font-bold text-[#18181B]">Сервисный Портал</h1>
          <div className="text-sm text-[#71717A] mt-0.5">Эффективная Техника</div>
        </div>

        {/* Toggle */}
        <div className="flex bg-[#F4F4F5] rounded-lg p-1 mb-6">
          <button type="button" onClick={() => setMode('staff')}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${mode === 'staff' ? 'bg-white text-[#18181B] shadow-sm' : 'text-[#71717A]'}`}>
            Сотрудник
          </button>
          <button type="button" onClick={() => setMode('client')}
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${mode === 'client' ? 'bg-white text-[#18181B] shadow-sm' : 'text-[#71717A]'}`}>
            Клиент
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-[#18181B] mb-1.5">Email</label>
            <input type="email" className="form-control"
              placeholder={mode === 'staff' ? 'email@vekpmt.ru' : 'email@company.ru'}
              value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium text-[#18181B] mb-1.5">Пароль</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} className="form-control pr-10" placeholder="Введите пароль"
                value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A1A1AA] hover:text-[#71717A]">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="btn btn-primary w-full justify-center py-3 text-base disabled:opacity-60">
            {loading ? 'Вход...' : 'Войти'}
          </button>
          <div className="mt-3 text-center">
            <Link to="/forgot-password" className="text-sm text-[#71717A] hover:text-[#003399] transition-colors">
              Забыли пароль?
            </Link>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-[#E4E4E7] text-center">
          {mode === 'client' ? (
            <Link to="/register" className="btn btn-secondary w-full justify-center py-2.5 text-sm">
              Зарегистрироваться
            </Link>
          ) : (
            <div className="py-[19px]" />
          )}
        </div>
      </div>
    </div>
  )
}
