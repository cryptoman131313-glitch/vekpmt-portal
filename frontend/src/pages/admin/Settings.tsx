import { useEffect, useState } from 'react'
import api from '../../api/client'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, UserPlus, ChevronDown, ChevronRight, Check, X, Camera } from 'lucide-react'
import AvatarCropModal from '../../components/AvatarCropModal'

interface User {
  id: string; name: string; email: string; role: string;
  is_active: boolean; permissions: Record<string, boolean>;
  avatar: string; avatar_url?: string; show_avatar?: boolean;
}
interface TicketStatus { key: string; label: string; color: string }
interface AutoStatuses { created?: string; assigned?: string; staff_replied?: string; client_replied?: string }
interface TicketType { id: string; name: string; color: string; statuses: TicketStatus[]; auto_statuses: AutoStatuses }

const ROLES = [
  { value: 'manager', label: 'Менеджер' },
  { value: 'engineer', label: 'Инженер' },
]

const PERMISSIONS = [
  { key: 'can_view_clients', label: 'Видеть раздел «Клиенты»', group: 'Разделы меню' },
  { key: 'can_view_registrations', label: 'Видеть раздел «Регистрации»', group: 'Разделы меню' },
  { key: 'can_view_equipment', label: 'Видеть раздел «Оборудование»', group: 'Разделы меню' },
  { key: 'can_view_documents', label: 'Видеть раздел «Документация»', group: 'Разделы меню' },
  { key: 'can_edit_messages', label: 'Редактировать и удалять свои сообщения', group: 'Действия' },
  { key: 'can_write_appeal', label: 'Писать в Обращение (чат с клиентом)', group: 'Действия' },
  { key: 'can_write_service', label: 'Писать в Служебный чат', group: 'Действия' },
  { key: 'can_write_notes', label: 'Писать в Примечания', group: 'Действия' },
  { key: 'can_approve_registrations', label: 'Одобрять регистрации', group: 'Действия' },
  { key: 'can_edit_equipment', label: 'Редактировать характеристики оборудования', group: 'Действия' },
]

export default function Settings() {
  const [tab, setTab] = useState('users')
  const [users, setUsers] = useState<User[]>([])
  const [types, setTypes] = useState<TicketType[]>([])
  const [showUserForm, setShowUserForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [cropData, setCropData] = useState<{ file: File; userId: string } | null>(null)

  const [userForm, setUserForm] = useState({ name: '', email: '', role: 'manager', password: '', permissions: {} as Record<string, boolean> })

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(() => {})
    api.get('/users/ticket-types').then(r => setTypes(r.data)).catch(() => {})
  }, [])

  const saveUser = async () => {
    try {
      if (editUser) {
        await api.patch(`/users/${editUser.id}`, userForm)
        toast.success('Сотрудник обновлён')
      } else {
        await api.post('/users', userForm)
        toast.success('Сотрудник создан')
      }
      setShowUserForm(false)
      setEditUser(null)
      api.get('/users').then(r => setUsers(r.data))
    } catch (err: any) { toast.error(err.response?.data?.error || 'Ошибка') }
  }

  const openEdit = (u: User) => {
    setEditUser(u)
    setUserForm({ name: u.name, email: u.email, role: u.role, password: '', permissions: u.permissions || {} })
    setShowUserForm(true)
  }

  const toggleActive = async (u: User) => {
    try {
      await api.patch(`/users/${u.id}`, { is_active: !u.is_active })
      api.get('/users').then(r => setUsers(r.data))
      toast.success(u.is_active ? 'Сотрудник деактивирован' : 'Сотрудник активирован')
    } catch { toast.error('Ошибка') }
  }

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>, userId: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCropData({ file, userId })
    e.target.value = ''
  }

  const handleAvatarUpload = async (blob: Blob, userId: string) => {
    const fd = new FormData()
    fd.append('avatar', blob, 'avatar.jpg')
    try {
      const { data } = await api.post(`/users/${userId}/avatar`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const urlWithBust = data.avatar_url + '?t=' + Date.now()
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, avatar_url: urlWithBust, show_avatar: data.show_avatar } : u))
      setEditUser(prev => prev ? { ...prev, avatar_url: urlWithBust, show_avatar: data.show_avatar } : null)
      toast.success('Фото загружено')
    } catch { toast.error('Ошибка загрузки') }
  }

  const handleToggleAvatar = async (userId: string, show: boolean) => {
    try {
      const { data } = await api.patch(`/users/${userId}/show-avatar`, { show_avatar: show })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, show_avatar: data.show_avatar } : u))
      setEditUser(prev => prev ? { ...prev, show_avatar: data.show_avatar } : null)
    } catch { toast.error('Ошибка') }
  }

  return (
    <div className="p-6">
      {cropData && (
        <AvatarCropModal
          file={cropData.file}
          onConfirm={blob => { handleAvatarUpload(blob, cropData.userId); setCropData(null) }}
          onClose={() => setCropData(null)}
        />
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#18181B]">Настройки</h1>
      </div>

      <div className="flex gap-1 mb-4 border-b border-[#E4E4E7]">
        {[{ key: 'users', label: 'Сотрудники' }, { key: 'types', label: 'Типы заявок' }, { key: 'equipment_fields', label: 'Характеристики оборудования' }, { key: 'doc_types', label: 'Типы документов' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === t.key ? 'border-[#CC0033] text-[#CC0033]' : 'border-transparent text-[#71717A] hover:text-[#18181B]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {tab === 'users' && (
        <div>
          <div className="flex justify-end mb-3">
            <button onClick={() => { setEditUser(null); setUserForm({ name: '', email: '', role: 'manager', password: '', permissions: {} }); setShowUserForm(true) }}
              className="btn btn-primary"><UserPlus size={15} /> Добавить сотрудника</button>
          </div>
          <div className="card divide-y divide-[#F4F4F5]">
            {users.length === 0 && <div className="py-8 text-center text-[#A1A1AA] text-sm">Нет сотрудников</div>}
            {users.map(u => (
              <div key={u.id} onClick={() => openEdit(u)}
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-[#FAFAFA] transition-colors">
                <div className="w-11 h-11 rounded-full flex-shrink-0 overflow-hidden bg-[#CC0033] flex items-center justify-center">
                  {u.show_avatar && u.avatar_url
                    ? <img src={u.avatar_url} alt={u.name} className="w-full h-full object-cover" />
                    : <span className="text-white text-sm font-bold">{u.avatar || u.name.slice(0,2).toUpperCase()}</span>
                  }
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-[#18181B]">{u.name}</div>
                  <div className="text-xs text-[#71717A]">{u.email} · {u.role === 'director' ? 'Руководитель' : u.role === 'manager' ? 'Менеджер' : 'Инженер'}</div>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {u.is_active ? 'Активен' : 'Деактивирован'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Types tab */}
      {tab === 'types' && (
        <TypesConstructor />
      )}

      {/* Equipment fields tab */}
      {tab === 'equipment_fields' && (
        <EquipmentFieldsConstructor />
      )}

      {/* Doc types tab */}
      {tab === 'doc_types' && (
        <SimpleListConstructor settingKey="document_types" label="тип документа" />
      )}

      {/* Employee Drawer */}
      {showUserForm && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => { setShowUserForm(false); setEditUser(null) }} />
          <div className="fixed right-0 top-0 h-full w-[440px] bg-white shadow-2xl z-50 flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E4E4E7]">
              <h3 className="font-bold text-[#18181B] text-lg">{editUser ? 'Карточка сотрудника' : 'Новый сотрудник'}</h3>
              <button onClick={() => { setShowUserForm(false); setEditUser(null) }}
                className="text-[#71717A] hover:text-[#18181B] transition-colors"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Avatar block */}
              {editUser && (
                <div className="flex flex-col items-center gap-3 pb-5 border-b border-[#F4F4F5]">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full overflow-hidden bg-[#CC0033] flex items-center justify-center">
                      {editUser.show_avatar && editUser.avatar_url
                        ? <img src={editUser.avatar_url} alt={editUser.name} className="w-full h-full object-cover" />
                        : <span className="text-white text-2xl font-bold">{editUser.avatar || editUser.name.slice(0,2).toUpperCase()}</span>
                      }
                    </div>
                    <label className="absolute bottom-0 right-0 w-8 h-8 bg-[#003399] border-2 border-white rounded-full flex items-center justify-center cursor-pointer hover:bg-[#0044cc] transition-colors shadow-md">
                      <Camera size={14} className="text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleAvatarSelect(e, editUser.id)} />
                    </label>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-[#18181B]">{editUser.name}</div>
                    <div className="text-sm text-[#71717A]">{editUser.role === 'director' ? 'Руководитель' : editUser.role === 'manager' ? 'Менеджер' : 'Инженер'}</div>
                  </div>
                  {editUser.avatar_url && (
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <div onClick={() => handleToggleAvatar(editUser.id, !editUser.show_avatar)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${editUser.show_avatar ? 'bg-[#003399]' : 'bg-[#D4D4D8]'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${editUser.show_avatar ? 'left-5' : 'left-0.5'}`} />
                      </div>
                      <span className="text-sm text-[#52525B]">Показывать фото</span>
                    </label>
                  )}
                </div>
              )}

              {/* Fields */}
              <div>
                <label className="block text-sm font-medium mb-1">ФИО <span className="text-[#CC0033]">*</span></label>
                <input className="form-control" placeholder="Иванов Сергей Петрович" autoComplete="off"
                  value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email <span className="text-[#CC0033]">*</span></label>
                <input className="form-control" type="email" placeholder="ivanov@vekpmt.ru" autoComplete="off"
                  value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              {editUser?.role !== 'director' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Роль</label>
                  <select className="form-control" value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">{editUser ? 'Новый пароль' : 'Пароль *'}</label>
                <input className="form-control" type="password" autoComplete="new-password"
                  placeholder={editUser ? 'Оставьте пустым если не менять' : 'Минимум 8 символов'}
                  value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              {editUser?.role !== 'director' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Права доступа</label>
                  {['Разделы меню', 'Действия'].map(group => (
                    <div key={group} className="mb-3">
                      <div className="text-[10px] font-semibold text-[#A1A1AA] uppercase mb-1.5">{group}</div>
                      <div className="space-y-2 p-3 bg-[#FAFAFA] rounded-lg border border-[#E4E4E7]">
                        {PERMISSIONS.filter(p => p.group === group).map(p => (
                          <label key={p.key} className="flex items-center gap-2.5 cursor-pointer">
                            <input type="checkbox" className="accent-[#CC0033]"
                              checked={!!userForm.permissions[p.key]}
                              onChange={e => setUserForm(f => ({ ...f, permissions: { ...f.permissions, [p.key]: e.target.checked } }))} />
                            <span className="text-sm text-[#52525B]">{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Drawer footer */}
            <div className="border-t border-[#E4E4E7] p-4 flex gap-3">
              {editUser && editUser.role !== 'director' && (
                <button onClick={() => toggleActive(editUser)}
                  className={`btn ${editUser.is_active ? 'btn-danger' : 'btn-success'} text-sm`}>
                  {editUser.is_active ? 'Деактивировать' : 'Активировать'}
                </button>
              )}
              <button onClick={saveUser} className="btn btn-primary flex-1 justify-center">
                {editUser ? 'Сохранить' : 'Создать сотрудника'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

interface EquipmentField { id: string; name: string; unit: string }

function EquipmentFieldsConstructor() {
  const [fields, setFields] = useState<EquipmentField[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', unit: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', unit: '' })

  const load = () => {
    api.get('/settings/equipment_fields').then(r => setFields(r.data || [])).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const save = async (newFields: EquipmentField[]) => {
    try {
      await api.put('/settings/equipment_fields', { value: newFields })
      setFields(newFields)
    } catch { toast.error('Ошибка сохранения') }
  }

  const addField = async () => {
    if (!form.name.trim()) { toast.error('Введите название'); return }
    const id = form.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-zа-яё0-9_]/gi, '') + '_' + Date.now()
    await save([...fields, { id, name: form.name, unit: form.unit }])
    setShowForm(false)
    setForm({ name: '', unit: '' })
  }

  const saveEdit = async (id: string) => {
    if (!editForm.name.trim()) { toast.error('Введите название'); return }
    await save(fields.map(f => f.id === id ? { ...f, name: editForm.name, unit: editForm.unit } : f))
    setEditId(null)
  }

  const deleteField = async (id: string) => {
    if (!confirm('Удалить характеристику? Значения у оборудования также удалятся.')) return
    await save(fields.filter(f => f.id !== id))
  }

  const moveUp = async (idx: number) => {
    if (idx === 0) return
    const arr = [...fields]
    ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
    await save(arr)
  }

  const moveDown = async (idx: number) => {
    if (idx === fields.length - 1) return
    const arr = [...fields]
    ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
    await save(arr)
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(true)} className="btn btn-primary"><Plus size={15} /> Добавить поле</button>
      </div>

      {showForm && (
        <div className="card p-4 mb-4 border-2 border-[#CC0033]/20">
          <div className="font-semibold text-[#18181B] mb-3">Новое поле</div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Название</label>
              <input className="form-control" placeholder="Производительность" autoFocus
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addField()} />
            </div>
            <div style={{ width: 140 }}>
              <label className="block text-sm font-medium mb-1">Единица измерения</label>
              <input className="form-control" placeholder="уп/мин"
                value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={addField} className="btn btn-primary">Добавить</button>
            <button onClick={() => { setShowForm(false); setForm({ name: '', unit: '' }) }} className="btn btn-secondary">Отмена</button>
          </div>
        </div>
      )}

      <div className="card divide-y divide-[#F4F4F5]">
        {fields.length === 0 && <div className="py-8 text-center text-[#A1A1AA] text-sm">Поля не добавлены</div>}
        {fields.map((f, idx) => (
          <div key={f.id} className="flex items-center gap-3 p-4">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => moveUp(idx)} className="text-[#D4D4D8] hover:text-[#71717A] leading-none text-xs">▲</button>
              <button onClick={() => moveDown(idx)} className="text-[#D4D4D8] hover:text-[#71717A] leading-none text-xs">▼</button>
            </div>
            {editId === f.id ? (
              <div className="flex gap-2 items-center flex-1">
                <input className="form-control" style={{ maxWidth: 220 }} value={editForm.name}
                  onChange={e => setEditForm(v => ({ ...v, name: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && saveEdit(f.id)} autoFocus />
                <input className="form-control" style={{ maxWidth: 120 }} placeholder="ед. изм."
                  value={editForm.unit} onChange={e => setEditForm(v => ({ ...v, unit: e.target.value }))} />
                <button onClick={() => saveEdit(f.id)} className="btn btn-primary py-1 px-3 text-xs">Сохранить</button>
                <button onClick={() => setEditId(null)} className="btn btn-secondary py-1 px-3 text-xs">Отмена</button>
              </div>
            ) : (
              <>
                <div className="flex-1">
                  <span className="font-medium text-[#18181B]">{f.name}</span>
                  {f.unit && <span className="text-xs text-[#A1A1AA] ml-2">{f.unit}</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditId(f.id); setEditForm({ name: f.name, unit: f.unit }) }}
                    className="btn btn-secondary p-1.5"><Pencil size={13} /></button>
                  <button onClick={() => deleteField(f.id)}
                    className="btn btn-danger p-1.5"><Trash2 size={13} /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function pluralStatus(n: number) {
  const mod10 = n % 10, mod100 = n % 100
  if (mod100 >= 11 && mod100 <= 14) return 'статусов'
  if (mod10 === 1) return 'статус'
  if (mod10 >= 2 && mod10 <= 4) return 'статуса'
  return 'статусов'
}

const STATUS_COLORS = [
  '#16A34A', '#2563EB', '#CC0033', '#EA580C', '#CA8A04',
  '#7C3AED', '#0891B2', '#6B7280', '#DB2777', '#059669',
]

function TypesConstructor() {
  const [types, setTypes] = useState<TicketType[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  // Форма нового типа
  const [showTypeForm, setShowTypeForm] = useState(false)
  const [typeForm, setTypeForm] = useState({ name: '', color: '#16A34A' })

  // Редактирование типа
  const [editTypeId, setEditTypeId] = useState<string | null>(null)
  const [editTypeForm, setEditTypeForm] = useState({ name: '', color: '' })

  // Форма нового статуса
  const [showStatusForm, setShowStatusForm] = useState<string | null>(null)
  const [statusForm, setStatusForm] = useState({ label: '', color: '#16A34A' })

  // Редактирование статуса: `${typeId}::${statusKey}`
  const [editStatusId, setEditStatusId] = useState<string | null>(null)
  const [editStatusForm, setEditStatusForm] = useState({ label: '', color: '' })

  const load = () => {
    api.get('/users/ticket-types').then(r => {
      setTypes(r.data.map((t: any) => ({
        ...t,
        statuses: Array.isArray(t.statuses)
          ? t.statuses.map((s: any) => typeof s === 'string' ? { key: s, label: s, color: '#6B7280' } : s)
          : [],
        auto_statuses: t.auto_statuses || {}
      })))
    }).catch(() => {})
  }

  useEffect(() => { load() }, [])

  const addType = async () => {
    if (!typeForm.name.trim()) { toast.error('Введите название'); return }
    try {
      await api.post('/users/ticket-types', { name: typeForm.name, color: typeForm.color, statuses: [] })
      toast.success('Тип добавлен')
      setShowTypeForm(false)
      setTypeForm({ name: '', color: '#16A34A' })
      load()
    } catch { toast.error('Ошибка') }
  }

  const saveType = async (id: string) => {
    try {
      await api.patch(`/users/ticket-types/${id}`, editTypeForm)
      toast.success('Сохранено')
      setEditTypeId(null)
      load()
    } catch { toast.error('Ошибка') }
  }

  const deleteType = async (id: string) => {
    if (!confirm('Удалить тип заявки? Заявки этого типа останутся, но тип будет удалён.')) return
    try {
      await api.delete(`/users/ticket-types/${id}`)
      toast.success('Удалено')
      load()
    } catch { toast.error('Ошибка') }
  }

  const addStatus = async (type: TicketType) => {
    if (!statusForm.label.trim()) { toast.error('Введите название статуса'); return }
    const key = statusForm.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-zа-яё0-9_]/gi, '')
    const newStatuses = [...type.statuses, { key: key || Date.now().toString(), label: statusForm.label, color: statusForm.color }]
    try {
      await api.patch(`/users/ticket-types/${type.id}`, { statuses: newStatuses })
      setShowStatusForm(null)
      setStatusForm({ label: '', color: '#16A34A' })
      load()
    } catch { toast.error('Ошибка') }
  }

  const deleteStatus = async (type: TicketType, statusKey: string) => {
    const newStatuses = type.statuses.filter(s => s.key !== statusKey)
    try {
      await api.patch(`/users/ticket-types/${type.id}`, { statuses: newStatuses })
      load()
    } catch { toast.error('Ошибка') }
  }

  const saveAutoStatus = async (type: TicketType, event: string, value: string) => {
    const newAuto = { ...type.auto_statuses, [event]: value || undefined }
    if (!value) delete newAuto[event]
    try {
      await api.patch(`/users/ticket-types/${type.id}`, { auto_statuses: newAuto })
      load()
    } catch { toast.error('Ошибка') }
  }

  const saveStatus = async (type: TicketType, statusKey: string) => {
    if (!editStatusForm.label.trim()) { toast.error('Введите название'); return }
    const newStatuses = type.statuses.map(s =>
      s.key === statusKey ? { ...s, label: editStatusForm.label, color: editStatusForm.color } : s
    )
    try {
      await api.patch(`/users/ticket-types/${type.id}`, { statuses: newStatuses })
      setEditStatusId(null)
      load()
    } catch { toast.error('Ошибка') }
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowTypeForm(true)} className="btn btn-primary">
          <Plus size={15} /> Добавить тип
        </button>
      </div>

      {/* Форма добавления типа */}
      {showTypeForm && (
        <div className="card p-4 mb-4 border-2 border-[#CC0033]/20">
          <div className="font-semibold text-[#18181B] mb-3">Новый тип заявки</div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Название</label>
              <input className="form-control" placeholder="Например: Консультация"
                value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addType()} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Цвет</label>
              <div className="flex gap-1.5 flex-wrap" style={{ maxWidth: 220 }}>
                {STATUS_COLORS.map(c => (
                  <button key={c} onClick={() => setTypeForm(f => ({ ...f, color: c }))}
                    className="w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all"
                    style={{ background: c, borderColor: typeForm.color === c ? '#18181B' : 'transparent' }}>
                    {typeForm.color === c && <Check size={13} color="#fff" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={addType} className="btn btn-primary">Добавить</button>
            <button onClick={() => { setShowTypeForm(false); setTypeForm({ name: '', color: '#16A34A' }) }}
              className="btn btn-secondary">Отмена</button>
          </div>
        </div>
      )}

      {/* Список типов */}
      <div className="space-y-2">
        {types.length === 0 && !showTypeForm && (
          <div className="card py-10 text-center text-[#A1A1AA] text-sm">Типы заявок не добавлены</div>
        )}
        {types.map(type => (
          <div key={type.id} className="card">
            {/* Заголовок типа */}
            <div className="flex items-center gap-3 p-4 cursor-pointer select-none"
              onClick={() => setExpanded(expanded === type.id ? null : type.id)}>
              <div className="text-[#A1A1AA]">
                {expanded === type.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: type.color }} />

              {editTypeId === type.id ? (
                <div className="flex gap-2 items-center flex-1" onClick={e => e.stopPropagation()}>
                  <input className="form-control" style={{ maxWidth: 200 }}
                    value={editTypeForm.name} onChange={e => setEditTypeForm(f => ({ ...f, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && saveType(type.id)} autoFocus />
                  <div className="flex gap-1">
                    {STATUS_COLORS.map(c => (
                      <button key={c} onClick={() => setEditTypeForm(f => ({ ...f, color: c }))}
                        className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                        style={{ background: c, borderColor: editTypeForm.color === c ? '#18181B' : 'transparent' }}>
                        {editTypeForm.color === c && <Check size={10} color="#fff" />}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => saveType(type.id)} className="btn btn-primary py-1 px-3 text-xs">Сохранить</button>
                  <button onClick={() => setEditTypeId(null)} className="btn btn-secondary py-1 px-3 text-xs">Отмена</button>
                </div>
              ) : (
                <>
                  <span className="font-semibold text-[#18181B] flex-1">{type.name}</span>
                  <span className="text-xs text-[#A1A1AA] mr-2">{type.statuses.length} {pluralStatus(type.statuses.length)}</span>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditTypeId(type.id); setEditTypeForm({ name: type.name, color: type.color }) }}
                      className="btn btn-secondary p-1.5"><Pencil size={13} /></button>
                    <button onClick={() => deleteType(type.id)}
                      className="btn btn-danger p-1.5"><Trash2 size={13} /></button>
                  </div>
                </>
              )}
            </div>

            {/* Статусы */}
            {expanded === type.id && (
              <div className="border-t border-[#F4F4F5] px-4 py-3">
                <div className="space-y-1 mb-3">
                  {type.statuses.length === 0 && (
                    <div className="text-sm text-[#A1A1AA] py-2">Статусы не добавлены</div>
                  )}
                  {type.statuses.map(s => {
                    const eid = `${type.id}::${s.key}`
                    return editStatusId === eid ? (
                      <div key={s.key} className="flex gap-2 items-center py-1.5 px-2">
                        <input className="form-control text-sm" style={{ maxWidth: 160 }}
                          value={editStatusForm.label}
                          onChange={e => setEditStatusForm(f => ({ ...f, label: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && saveStatus(type, s.key)}
                          autoFocus />
                        <div className="flex gap-1">
                          {STATUS_COLORS.map(c => (
                            <button key={c} onClick={() => setEditStatusForm(f => ({ ...f, color: c }))}
                              className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                              style={{ background: c, borderColor: editStatusForm.color === c ? '#18181B' : 'transparent' }}>
                              {editStatusForm.color === c && <Check size={10} color="#fff" />}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => saveStatus(type, s.key)} className="btn btn-primary py-1 px-2.5 text-xs">Сохранить</button>
                        <button onClick={() => setEditStatusId(null)} className="btn btn-secondary py-1 px-2.5 text-xs">Отмена</button>
                      </div>
                    ) : (
                      <div key={s.key} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-[#FAFAFA] group">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                        <span className="text-sm text-[#18181B] flex-1">{s.label}</span>
                        <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-all">
                          <button onClick={() => { setEditStatusId(eid); setEditStatusForm({ label: s.label, color: s.color }) }}
                            className="text-[#A1A1AA] hover:text-[#003399]"><Pencil size={13} /></button>
                          <button onClick={() => deleteStatus(type, s.key)}
                            className="text-[#A1A1AA] hover:text-[#CC0033]"><X size={14} /></button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Авто-статусы */}
                {type.statuses.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#F4F4F5]">
                    <div className="text-xs font-semibold text-[#71717A] uppercase tracking-wide mb-2">Автоматические статусы</div>
                    <div className="space-y-2">
                      {[
                        { event: 'created', label: 'При создании заявки' },
                        { event: 'assigned', label: 'При назначении сотрудника' },
                        { event: 'staff_replied', label: 'Сотрудник ответил клиенту' },
                        { event: 'client_replied', label: 'Клиент ответил' },
                      ].map(({ event, label }) => (
                        <div key={event} className="flex items-center gap-3">
                          <span className="text-sm text-[#52525B] w-48 flex-shrink-0">{label}</span>
                          <select
                            className="form-control text-sm"
                            style={{ maxWidth: 200 }}
                            value={type.auto_statuses[event as keyof AutoStatuses] || ''}
                            onChange={e => saveAutoStatus(type, event, e.target.value)}
                          >
                            <option value="">— не менять —</option>
                            {type.statuses.map(s => (
                              <option key={s.key} value={s.key}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Форма нового статуса */}
                {showStatusForm === type.id ? (
                  <div className="flex gap-2 items-end pt-2 border-t border-[#F4F4F5]">
                    <div className="flex-1">
                      <input className="form-control text-sm" placeholder="Название статуса"
                        value={statusForm.label} onChange={e => setStatusForm(f => ({ ...f, label: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && addStatus(type)} autoFocus />
                    </div>
                    <div className="flex gap-1">
                      {STATUS_COLORS.map(c => (
                        <button key={c} onClick={() => setStatusForm(f => ({ ...f, color: c }))}
                          className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                          style={{ background: c, borderColor: statusForm.color === c ? '#18181B' : 'transparent' }}>
                          {statusForm.color === c && <Check size={10} color="#fff" />}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => addStatus(type)} className="btn btn-primary py-1.5 px-3 text-xs">Добавить</button>
                    <button onClick={() => { setShowStatusForm(null); setStatusForm({ label: '', color: '#16A34A' }) }}
                      className="btn btn-secondary py-1.5 px-3 text-xs">Отмена</button>
                  </div>
                ) : (
                  <button onClick={() => { setShowStatusForm(type.id); setStatusForm({ label: '', color: '#16A34A' }) }}
                    className="btn btn-secondary text-xs py-1.5 mt-1">
                    <Plus size={13} /> Добавить статус
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}


function SimpleListConstructor({ settingKey, label }: { settingKey: string; label: string }) {
  const [items, setItems] = useState<{ id: string; name: string }[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const load = () => api.get(`/settings/${settingKey}`).then(r => setItems(r.data || [])).catch(() => {})
  useEffect(() => { load() }, [settingKey])

  const save = async (newItems: { id: string; name: string }[]) => {
    try {
      await api.put(`/settings/${settingKey}`, { value: newItems })
      setItems(newItems)
    } catch { toast.error('Ошибка') }
  }

  const add = async () => {
    if (!name.trim()) { toast.error('Введите название'); return }
    const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-zа-яё0-9_]/gi, '') + '_' + Date.now()
    await save([...items, { id, name }])
    setShowForm(false); setName('')
  }

  const saveEdit = async (id: string) => {
    if (!editName.trim()) { toast.error('Введите название'); return }
    await save(items.map(i => i.id === id ? { ...i, name: editName } : i))
    setEditId(null)
  }

  const del = async (id: string) => {
    if (!confirm('Удалить?')) return
    await save(items.filter(i => i.id !== id))
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowForm(true)} className="btn btn-primary"><Plus size={15} /> Добавить {label}</button>
      </div>
      {showForm && (
        <div className="card p-4 mb-4 border-2 border-[#CC0033]/20">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Название</label>
              <input className="form-control" placeholder="Название..." autoFocus
                value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={add} className="btn btn-primary">Добавить</button>
            <button onClick={() => { setShowForm(false); setName('') }} className="btn btn-secondary">Отмена</button>
          </div>
        </div>
      )}
      <div className="card divide-y divide-[#F4F4F5]">
        {items.length === 0 && <div className="py-8 text-center text-[#A1A1AA] text-sm">Нет элементов</div>}
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-3 p-4">
            {editId === item.id ? (
              <div className="flex gap-2 items-center flex-1">
                <input className="form-control" style={{ maxWidth: 260 }} value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveEdit(item.id)} autoFocus />
                <button onClick={() => saveEdit(item.id)} className="btn btn-primary py-1 px-3 text-xs">Сохранить</button>
                <button onClick={() => setEditId(null)} className="btn btn-secondary py-1 px-3 text-xs">Отмена</button>
              </div>
            ) : (
              <>
                <span className="flex-1 font-medium text-[#18181B]">{item.name}</span>
                <div className="flex gap-1">
                  <button onClick={() => { setEditId(item.id); setEditName(item.name) }}
                    className="btn btn-secondary p-1.5"><Pencil size={13} /></button>
                  <button onClick={() => del(item.id)}
                    className="btn btn-danger p-1.5"><Trash2 size={13} /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
