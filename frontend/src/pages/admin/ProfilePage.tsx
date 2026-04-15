import { useEffect, useState } from 'react'
import api from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Save, Camera } from 'lucide-react'
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

  useEffect(() => {
    if (user) {
      setName(user.name)
      setAvatarUrl(user.avatar_url)
    }
  }, [user])

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
    </div>
  )
}
