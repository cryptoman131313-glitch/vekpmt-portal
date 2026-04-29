import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../api/client'
import { getCache, setCache } from '../../api/cache'
import { useAuth } from '../../context/AuthContext'
import { formatDate, statusLabel, statusBadgeClass } from '../../utils/helpers'
import toast from 'react-hot-toast'
import { Trash2, Pencil, Save, X, Plus, Key, Lock, Unlock } from 'lucide-react'

interface Client { id: string; company_name: string; inn: string; legal_address: string; actual_address: string; contact_name: string; contact_phone: string; contact_email: string }
interface Equipment { id: string; model: string; serial_number: string; manufacturer: string; tickets_count: string }
interface Ticket { id: number; type_name: string; status: string; created_at: string; equipment_model: string }
interface ClientUser { id: string; email: string; name: string; is_active: boolean; created_at: string }

export default function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [client, setClient] = useState<Client | null>(null)
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Client>>({})

  // Учётки клиента (несколько сотрудников одной организации)
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([])
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '' })
  const [resetPwdUser, setResetPwdUser] = useState<ClientUser | null>(null)
  const [resetPwd, setResetPwd] = useState('')
  const [deleteUser, setDeleteUser] = useState<ClientUser | null>(null)

  const loadUsers = () => {
    if (!id) return
    api.get(`/clients/${id}/users`).then(r => setClientUsers(r.data)).catch(() => {})
  }

  const handleAddUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password) {
      toast.error('Заполните все поля'); return
    }
    if (newUser.password.length < 8) { toast.error('Пароль минимум 8 символов'); return }
    try {
      await api.post(`/clients/${id}/users`, newUser)
      toast.success('Сотрудник добавлен')
      setShowAddUser(false)
      setNewUser({ name: '', email: '', password: '' })
      loadUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка')
    }
  }

  const toggleUserActive = async (u: ClientUser) => {
    try {
      await api.patch(`/clients/${id}/users/${u.id}`, { is_active: !u.is_active })
      loadUsers()
    } catch { toast.error('Ошибка') }
  }

  const handleResetPwd = async () => {
    if (!resetPwdUser) return
    if (resetPwd.length < 8) { toast.error('Пароль минимум 8 символов'); return }
    try {
      await api.post(`/clients/${id}/users/${resetPwdUser.id}/reset-password`, { password: resetPwd })
      toast.success('Пароль обновлён')
      setResetPwdUser(null)
      setResetPwd('')
    } catch { toast.error('Ошибка') }
  }

  const handleDeleteUser = async () => {
    if (!deleteUser) return
    try {
      await api.delete(`/clients/${id}/users/${deleteUser.id}`)
      toast.success('Учётка удалена')
      setDeleteUser(null)
      loadUsers()
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка')
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Удалить клиента «${client?.company_name}»?\n\nБудут удалены все заявки и оборудование клиента.`)) return
    try {
      await api.delete(`/clients/${id}`)
      toast.success('Клиент удалён')
      navigate('/admin/clients')
    } catch { toast.error('Ошибка удаления') }
  }

  const handleSave = async () => {
    try {
      const { data } = await api.patch(`/clients/${id}`, form)
      setClient(data)
      setEditing(false)
      toast.success('Данные сохранены')
    } catch { toast.error('Ошибка сохранения') }
  }

  const startEdit = () => {
    setForm({
      company_name: client?.company_name,
      inn: client?.inn,
      legal_address: client?.legal_address,
      actual_address: client?.actual_address,
      contact_name: client?.contact_name,
      contact_phone: client?.contact_phone,
    })
    setEditing(true)
  }

  useEffect(() => {
    if (!id) return
    const cc = getCache(`client_${id}`); if (cc) setClient(cc)
    const ce = getCache(`client_${id}_eq`); if (ce) setEquipment(ce)
    const ct = getCache(`client_${id}_tk`); if (ct) setTickets(ct)
    api.get(`/clients/${id}`).then(r => { setCache(`client_${id}`, r.data); setClient(r.data) }).catch(() => navigate('/admin/clients'))
    api.get(`/clients/${id}/equipment`).then(r => { setCache(`client_${id}_eq`, r.data); setEquipment(r.data) }).catch(() => {})
    api.get(`/clients/${id}/tickets`).then(r => { setCache(`client_${id}_tk`, r.data); setTickets(r.data) }).catch(() => {})
    loadUsers()
  }, [id])

  if (!client) return <div className="p-6 text-[#71717A]">Загрузка...</div>

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#18181B]">{client.company_name}</h1>
        <div className="flex items-center gap-2">
          {!editing && (
            <button onClick={startEdit} className="btn btn-secondary flex items-center gap-2">
              <Pencil size={15} /> Редактировать
            </button>
          )}
          {editing && (
            <>
              <button onClick={handleSave} className="btn btn-primary flex items-center gap-2">
                <Save size={15} /> Сохранить
              </button>
              <button onClick={() => setEditing(false)} className="btn btn-secondary flex items-center gap-2">
                <X size={15} /> Отмена
              </button>
            </>
          )}
          {user?.role === 'director' && !editing && (
            <button onClick={handleDelete} className="btn btn-danger flex items-center gap-2">
              <Trash2 size={15} /> Удалить клиента
            </button>
          )}
        </div>
      </div>

      {/* Client info */}
      <div className="card p-5 mb-4">
        {editing ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#A1A1AA] mb-0.5">Организация</label>
              <input className="form-control text-sm" value={form.company_name || ''} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#A1A1AA] mb-0.5">ИНН</label>
              <input className="form-control text-sm" value={form.inn || ''} onChange={e => setForm(f => ({ ...f, inn: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#A1A1AA] mb-0.5">Юр. адрес</label>
              <input className="form-control text-sm" value={form.legal_address || ''} onChange={e => setForm(f => ({ ...f, legal_address: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#A1A1AA] mb-0.5">Факт. адрес</label>
              <input className="form-control text-sm" value={form.actual_address || ''} onChange={e => setForm(f => ({ ...f, actual_address: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#A1A1AA] mb-0.5">Контактное лицо</label>
              <input className="form-control text-sm" value={form.contact_name || ''} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#A1A1AA] mb-0.5">Телефон</label>
              <input className="form-control text-sm" value={form.contact_phone || ''} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Info label="Организация" value={client.company_name} />
            <Info label="ИНН" value={client.inn} />
            <Info label="Юр. адрес" value={client.legal_address} />
            <Info label="Факт. адрес" value={client.actual_address} />
            <Info label="Контактное лицо" value={client.contact_name} />
            <Info label="Телефон" value={client.contact_phone} />
            <Info label="Email" value={client.contact_email} />
          </div>
        )}
      </div>

      {/* Equipment */}
      <div className="card mb-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E4E4E7]">
          <h2 className="font-semibold text-[#18181B]">Оборудование</h2>
          <span className="text-sm text-[#71717A]">{equipment.length} ед.</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
              {['Модель', 'Производитель', 'Серийный №', 'Заявок'].map(h => (
                <th key={h} className="px-4 py-2 text-left font-semibold text-[#71717A]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {equipment.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-[#71717A]">Нет оборудования</td></tr>}
            {equipment.map(eq => (
              <tr key={eq.id} onClick={() => navigate(`/admin/equipment/${eq.id}`)}
                className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA] cursor-pointer transition-colors">
                <td className="px-4 py-2 font-medium">{eq.model}</td>
                <td className="px-4 py-2 text-[#71717A]">{eq.manufacturer || '—'}</td>
                <td className="px-4 py-2 text-[#71717A]">{eq.serial_number || '—'}</td>
                <td className="px-4 py-2 font-bold">{eq.tickets_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Учётные записи (сотрудники клиента) */}
      <div className="card mb-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E4E4E7]">
          <div>
            <h2 className="font-semibold text-[#18181B]">Сотрудники клиента</h2>
            <div className="text-xs text-[#71717A] mt-0.5">Учётные записи для входа в личный кабинет — могут создавать заявки от имени организации</div>
          </div>
          <button onClick={() => setShowAddUser(true)} className="btn btn-primary gap-1.5">
            <Plus size={14} /> Добавить
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
              {['Имя', 'Email', 'Статус', 'Создан', 'Действия'].map(h => (
                <th key={h} className="px-4 py-2 text-left font-semibold text-[#71717A]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clientUsers.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-[#71717A]">Нет ни одной учётки. Клиент пока не может войти в ЛК.</td></tr>
            )}
            {clientUsers.map(u => (
              <tr key={u.id} className="border-b border-[#F4F4F5]">
                <td className="px-4 py-2 font-medium">{u.name}</td>
                <td className="px-4 py-2 text-[#71717A]">{u.email}</td>
                <td className="px-4 py-2">
                  {u.is_active
                    ? <span className="badge badge-success">Активен</span>
                    : <span className="badge badge-cancelled">Заблокирован</span>}
                </td>
                <td className="px-4 py-2 text-[#71717A]">{formatDate(u.created_at)}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button onClick={() => { setResetPwdUser(u); setResetPwd('') }}
                      className="text-[#71717A] hover:text-[#003399] transition-colors" title="Сбросить пароль">
                      <Key size={15} />
                    </button>
                    <button onClick={() => toggleUserActive(u)}
                      className={u.is_active ? 'text-[#71717A] hover:text-[#CC0033] transition-colors' : 'text-[#16A34A] hover:text-[#15803D] transition-colors'}
                      title={u.is_active ? 'Заблокировать' : 'Разблокировать'}>
                      {u.is_active ? <Lock size={15} /> : <Unlock size={15} />}
                    </button>
                    {(user?.role === 'director' || user?.role === 'manager') && (
                      <button onClick={() => setDeleteUser(u)}
                        className="text-[#71717A] hover:text-[#CC0033] transition-colors" title="Удалить">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add user modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E4E4E7] w-full max-w-md p-6 shadow-lg">
            <h3 className="font-bold text-[#18181B] mb-4">Новый сотрудник клиента</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#71717A] mb-1">ФИО *</label>
                <input className="form-control" placeholder="Иванов Иван"
                  value={newUser.name} onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#71717A] mb-1">Email *</label>
                <input className="form-control" placeholder="ivan@company.ru" type="email"
                  value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#71717A] mb-1">Пароль * (минимум 8 символов)</label>
                <input className="form-control" type="text"
                  value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => { setShowAddUser(false); setNewUser({ name:'', email:'', password:'' }) }}
                className="btn btn-secondary flex-1 justify-center">Отмена</button>
              <button onClick={handleAddUser} className="btn btn-primary flex-[2] justify-center">Создать</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete user modal */}
      {deleteUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E4E4E7] w-full max-w-md p-6 shadow-lg">
            <h3 className="font-bold text-[#18181B] mb-2">Удалить учётку?</h3>
            <p className="text-sm text-[#71717A] mb-4">
              Учётная запись <strong>{deleteUser.name}</strong> ({deleteUser.email}) будет удалена. Этот сотрудник больше не сможет войти в ЛК. Заявки клиента сохраняются.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteUser(null)} className="btn btn-secondary flex-1 justify-center">Отмена</button>
              <button onClick={handleDeleteUser} className="btn btn-danger flex-[2] justify-center">Удалить</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetPwdUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-[#E4E4E7] w-full max-w-md p-6 shadow-lg">
            <h3 className="font-bold text-[#18181B] mb-2">Сбросить пароль</h3>
            <p className="text-sm text-[#71717A] mb-4">Новый пароль для <strong>{resetPwdUser.name}</strong> ({resetPwdUser.email})</p>
            <input className="form-control mb-4" type="text" placeholder="Минимум 8 символов"
              value={resetPwd} onChange={e => setResetPwd(e.target.value)} autoFocus />
            <div className="flex gap-3">
              <button onClick={() => { setResetPwdUser(null); setResetPwd('') }}
                className="btn btn-secondary flex-1 justify-center">Отмена</button>
              <button onClick={handleResetPwd} className="btn btn-primary flex-[2] justify-center">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* Tickets */}
      <div className="card">
        <div className="px-5 py-3 border-b border-[#E4E4E7]">
          <h2 className="font-semibold text-[#18181B]">Заявки клиента</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E4E4E7] bg-[#FAFAFA]">
              {['#', 'Дата', 'Оборудование', 'Тип', 'Статус'].map(h => (
                <th key={h} className="px-4 py-2 text-left font-semibold text-[#71717A]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-[#71717A]">Нет заявок</td></tr>}
            {tickets.map(t => (
              <tr key={t.id} onClick={() => navigate(`/admin/tickets/${t.id}`)}
                className="border-b border-[#F4F4F5] hover:bg-[#FAFAFA] cursor-pointer transition-colors">
                <td className="px-4 py-2 font-bold text-[#CC0033]">#{t.id}</td>
                <td className="px-4 py-2 text-[#71717A]">{formatDate(t.created_at)}</td>
                <td className="px-4 py-2">{t.equipment_model || '—'}</td>
                <td className="px-4 py-2">{t.type_name || '—'}</td>
                <td className="px-4 py-2"><span className={`badge ${statusBadgeClass(t.status)}`}>{statusLabel(t.status)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-[#A1A1AA] mb-0.5">{label}</div>
      <div className="text-sm text-[#18181B]">{value || '—'}</div>
    </div>
  )
}
