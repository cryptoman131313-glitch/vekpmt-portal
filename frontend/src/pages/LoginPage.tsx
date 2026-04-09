import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { loginUser, loginClient, user, client } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'staff' | 'client'>('staff')

  if (user) { navigate('/admin/dashboard', { replace: true }); return null }
  if (client) { navigate('/client/tickets', { replace: true }); return null }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Введите email и пароль'); return }
    setLoading(true)
    try {
      if (mode === 'staff') {
        await loginUser(email, password)
        navigate('/admin/dashboard')
      } else {
        await loginClient(email, password)
        navigate('/client/tickets')
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Неверный email или пароль')
    } finally {
      setLoading(false)
    }
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
            <input type="password" className="form-control" placeholder="Введите пароль"
              value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
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
