import { useEffect, useState } from 'react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Save, Camera, ShieldCheck, ShieldOff, QrCode } from 'lucide-react'
import AvatarCropModal from '../../components/AvatarCropModal'

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [name, setName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined)

  // 2FA
  const [totpEnabled, setTotpEnabled] = useState(false)
  const [totpStep, setTotpStep] = useState<'idle' | 'setup' | 'disable'>('idle')
  const [totpQr, setTotpQr] = useState('')
  const [totpSecret, setTotpSecret] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [totpLoading, setTotpLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name)
      setAvatarUrl(user.avatar_url)
    }
    api.get('/auth/2fa/status').then(r => setTotpEnabled(r.data.enabled)).catch(() => {})
  }, [user])

  const handleSetup2fa = async () => {
    setTotpLoading(true)
    try {
      const { data } = await api.post('/auth/2fa/setup')
      setTotpQr(data.qrCodeUrl)
      setTotpSecret(data.secret)
      setTotpStep('setup')
      setTotpCode('')
    } catch { toast.error('Ошибка настройки 2FA') }
    finally { setTotpLoading(false) }
  }

  const handleEnable2fa = async () => {
    if (!totpCode) { toast.error('Введите код'); return }
    setTotpLoading(true)
    try {
      await api.post('/auth/2fa/enable', { code: totpCode })
      setTotpEnabled(true)
      setTotpStep('idle')
      setTotpCode('')
      toast.success('2FA включена!')
    } catch (err: any) { toast.error(err.response?.data?.error || 'Неверный код') }
    finally { setTotpLoading(false) }
  }

  const handleDisable2fa = async () => {
    if (!totpCode) { toast.error('Введите код из приложения'); return }
    setTotpLoading(true)
    try {
      await api.post('/auth/2fa/disable', { code: totpCode })
      setTotpEnabled(false)
      setTotpStep('idle')
      setTotpCode('')
      toast.success('2FA отключена')
    } catch (err: any) { toast.error(err.response?.data?.error || 'Неверный код') }
    finally { setTotpLoading(false) }
  }

  const handleAvatarUpload = async (blob: Blob) => {
    if (!user) return
    const fd = new FormData()
    fd.append('avatar', blob, 'avatar.jpg')
    try {
      const { data } = await api.post(`/users/${user.id}/avatar`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setAvatarUrl(data.avatar_url + '?t=' + Date.now())
      toast.success('Фото обновлено')
      refreshUser()
    } catch { toast.error('Ошибка загрузки фото') }
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
      await api.patch('/users/me', { name, ...(password ? { password, currentPassword } : {}) })
      toast.success('Данные сохранены')
      setCurrentPassword('')
      setPassword('')
      setPasswordConfirm('')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка')
    } finally { setLoading(false) }
  }

  const roleLabel = user?.role === 'director' ? 'Руководитель' : user?.role === 'manager' ? 'Менеджер' : 'Инженер'

  return (
    <div className="p-6 max-w-lg">
      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onConfirm={blob => { handleAvatarUpload(blob); setCropFile(null) }}
          onClose={() => setCropFile(null)}
        />
      )}

      <h1 className="text-2xl font-bold text-[#18181B] mb-6">Мой профиль</h1>

      {/* Avatar */}
      <div className="card p-5 mb-4 flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-full bg-[#CC0033] text-white flex items-center justify-center text-2xl font-bold overflow-hidden">
            {avatarUrl
              ? <img src={avatarUrl} alt={user?.name} className="w-full h-full object-cover" />
              : (user?.avatar || user?.name?.slice(0, 2).toUpperCase())
            }
          </div>
          <label className="absolute bottom-0 right-0 w-8 h-8 bg-[#003399] border-2 border-white rounded-full flex items-center justify-center cursor-pointer hover:bg-[#0044cc] transition-colors shadow-md">
            <Camera size={14} className="text-white" />
            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setCropFile(f); e.target.value = '' }} />
          </label>
        </div>
        <div>
          <div className="font-bold text-lg text-[#18181B]">{user?.name}</div>
          <div className="text-sm text-[#71717A]">{user?.email}</div>
          <div className="text-xs mt-1">
            <span className="bg-[#E4E4E7] text-[#52525B] px-2 py-0.5 rounded font-semibold">{roleLabel}</span>
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="card p-5 space-y-4">
        <div className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-2">Основные данные</div>
        <div>
          <label className="block text-sm font-medium mb-1">ФИО</label>
          <input className="form-control" value={name} onChange={e => setName(e.target.value)} autoComplete="off" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input className="form-control bg-[#FAFAFA]" value={user?.email || ''} disabled />
          <div className="text-[10px] text-[#A1A1AA] mt-0.5">Email изменить нельзя</div>
        </div>

        <div className="pt-3 border-t border-[#E4E4E7]">
          <div className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-3">Смена пароля</div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Текущий пароль</label>
              <input className="form-control" type="password"
                placeholder="Введите текущий пароль" autoComplete="current-password"
                value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
            </div>
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

      {/* 2FA */}
      <div className="card p-5 mt-4">
        <div className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-3">Двухфакторная аутентификация</div>

        {totpStep === 'idle' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {totpEnabled
                ? <ShieldCheck size={22} className="text-green-600 flex-shrink-0" />
                : <ShieldOff size={22} className="text-[#A1A1AA] flex-shrink-0" />}
              <div>
                <div className="text-sm font-semibold text-[#18181B]">
                  {totpEnabled ? 'Включена' : 'Отключена'}
                </div>
                <div className="text-xs text-[#71717A]">
                  {totpEnabled ? 'При входе запрашивается код из приложения' : 'Защитите аккаунт с помощью Google Authenticator'}
                </div>
              </div>
            </div>
            <button
              onClick={totpEnabled ? () => { setTotpStep('disable'); setTotpCode('') } : handleSetup2fa}
              disabled={totpLoading}
              className={`btn text-sm px-4 py-2 disabled:opacity-60 ${totpEnabled ? 'btn-secondary text-red-600 border-red-200 hover:bg-red-50' : 'btn-primary'}`}>
              {totpLoading ? '...' : totpEnabled ? 'Отключить' : 'Включить'}
            </button>
          </div>
        )}

        {totpStep === 'setup' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-[#F4F4F5] rounded-lg">
              <QrCode size={18} className="text-[#003399] mt-0.5 flex-shrink-0" />
              <div className="text-sm text-[#18181B]">
                <div className="font-semibold mb-1">Как настроить:</div>
                <ol className="list-decimal ml-4 space-y-1 text-[#52525B]">
                  <li>Скачайте <strong>Google Authenticator</strong> или <strong>Яндекс Ключ</strong></li>
                  <li>Нажмите «+» → «Сканировать QR-код»</li>
                  <li>Отсканируйте код ниже</li>
                  <li>Введите 6 цифр из приложения</li>
                </ol>
              </div>
            </div>
            {totpQr && (
              <div className="flex justify-center">
                <img src={totpQr} alt="QR код" className="w-44 h-44 border border-[#E4E4E7] rounded-lg p-2 bg-white" />
              </div>
            )}
            <div className="text-xs text-center text-[#71717A]">
              Или введите ключ вручную: <span className="font-mono text-[#18181B] bg-[#F4F4F5] px-1 rounded">{totpSecret}</span>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Код подтверждения</label>
              <input className="form-control text-center text-xl tracking-widest" type="text" inputMode="numeric"
                maxLength={6} placeholder="000000" value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setTotpStep('idle'); setTotpCode('') }} className="btn btn-secondary flex-1 justify-center text-sm">Отмена</button>
              <button onClick={handleEnable2fa} disabled={totpLoading || totpCode.length < 6} className="btn btn-primary flex-1 justify-center text-sm disabled:opacity-60">
                {totpLoading ? 'Проверка...' : 'Подтвердить и включить'}
              </button>
            </div>
          </div>
        )}

        {totpStep === 'disable' && (
          <div className="space-y-4">
            <p className="text-sm text-[#52525B]">Введите текущий код из приложения для отключения 2FA:</p>
            <input className="form-control text-center text-xl tracking-widest" type="text" inputMode="numeric"
              maxLength={6} placeholder="000000" value={totpCode}
              onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            <div className="flex gap-2">
              <button onClick={() => { setTotpStep('idle'); setTotpCode('') }} className="btn btn-secondary flex-1 justify-center text-sm">Отмена</button>
              <button onClick={handleDisable2fa} disabled={totpLoading || totpCode.length < 6} className="btn text-sm flex-1 justify-center bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
                {totpLoading ? '...' : 'Отключить 2FA'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
