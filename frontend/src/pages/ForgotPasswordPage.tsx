import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import toast from 'react-hot-toast'
import { ArrowLeft, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) { toast.error('Введите email'); return }
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch {
      toast.error('Ошибка сервера')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #18181B 0%, #27272A 50%, #003399 100%)' }}>
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-sm w-full max-w-[400px] p-8">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo-icon.png" alt="" className="h-16 w-auto mb-3" onError={e => (e.currentTarget.style.display='none')} />
          <h1 className="text-xl font-bold text-[#18181B]">Восстановление пароля</h1>
          <div className="text-sm text-[#71717A] mt-0.5 text-center">Сервисный Портал · Эффективная Техника</div>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail size={28} className="text-green-600" />
            </div>
            <div className="font-semibold text-[#18181B] mb-2">Письмо отправлено</div>
            <div className="text-sm text-[#71717A] mb-6">
              Если аккаунт с таким email существует — проверьте почту.<br />
              Ссылка действительна 1 час.
            </div>
            <Link to="/login" className="btn btn-primary w-full justify-center py-3">
              Вернуться ко входу
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="text-sm text-[#71717A] mb-5">
              Введите email вашего аккаунта сотрудника. Мы отправим ссылку для сброса пароля.
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-[#18181B] mb-1.5">Email</label>
              <input type="email" className="form-control" placeholder="email@vekpmt.ru"
                value={email} onChange={e => setEmail(e.target.value)} autoFocus />
            </div>
            <button type="submit" disabled={loading}
              className="btn btn-primary w-full justify-center py-3 disabled:opacity-60">
              {loading ? 'Отправка...' : 'Отправить ссылку'}
            </button>
            <Link to="/login" className="flex items-center justify-center gap-1.5 mt-4 text-sm text-[#71717A] hover:text-[#18181B] transition-colors">
              <ArrowLeft size={15} /> Вернуться ко входу
            </Link>
          </form>
        )}
      </div>
    </div>
  )
}
