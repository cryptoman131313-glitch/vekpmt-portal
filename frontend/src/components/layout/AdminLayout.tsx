import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useEffect, useState } from 'react'
import api from '../../api/client'
import {
  LayoutDashboard, FileText, Users, Wrench, UserPlus,
  Settings, LogOut, FolderOpen
} from 'lucide-react'
import NotificationPanel from '../NotificationPanel'

const roleLabels: Record<string, string> = {
  director: 'Руководитель',
  manager: 'Менеджер',
  engineer: 'Инженер',
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [regCount, setRegCount] = useState(0)

  useEffect(() => {
    api.get('/registrations/count').then(r => setRegCount(r.data.count)).catch(() => {})
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAFA]">
      {/* Sidebar */}
      <aside className="w-[220px] min-w-[220px] bg-[#18181B] flex flex-col h-full">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 px-4 py-5 border-b border-[#333]">
          <img src="/logo-icon.png" alt="Logo" className="h-12 w-auto rounded" onError={e => (e.currentTarget.style.display='none')} />
          <div className="text-center">
            <div className="font-bold text-sm text-white leading-tight">Сервисный Портал</div>
            <div className="text-[11px] text-[#A1A1AA] leading-tight mt-0.5">Эффективная Техника</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          <div className="text-[10px] font-semibold text-[#CCCCCC] uppercase px-2 mb-1">Основное</div>
          <NavItem to="/admin/dashboard" icon={<LayoutDashboard size={20} />} label="Дашборд" />
          <NavItem to="/admin/tickets" icon={<FileText size={20} />} label="Заявки" />

          <div className="text-[10px] font-semibold text-[#CCCCCC] uppercase px-2 mt-4 mb-1">Справочники</div>
          {(user?.role === 'director' || user?.permissions?.can_view_clients) && (
            <NavItem to="/admin/clients" icon={<Users size={20} />} label="Клиенты" />
          )}
          {(user?.role === 'director' || user?.permissions?.can_view_registrations) && (
            <NavItem to="/admin/registrations" icon={<UserPlus size={20} />} label="Регистрации" badge={regCount} />
          )}
          {(user?.role === 'director' || user?.permissions?.can_view_equipment) && (
            <NavItem to="/admin/equipment" icon={<Wrench size={20} />} label="Оборудование" />
          )}
          {(user?.role === 'director' || user?.permissions?.can_view_documents) && (
            <NavItem to="/admin/documents" icon={<FolderOpen size={20} />} label="Документация" />
          )}

          {user?.role === 'director' && (
            <>
              <div className="text-[10px] font-semibold text-[#CCCCCC] uppercase px-2 mt-4 mb-1">Управление</div>
              <NavItem to="/admin/settings" icon={<Settings size={20} />} label="Настройки" />
            </>
          )}
        </nav>

        {/* User */}
        <div className="border-t border-[#333] p-3 pb-10 flex items-center gap-2">
          <button onClick={() => navigate('/admin/profile')} className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left">
            <div className="w-8 h-8 rounded-full bg-[#CC0033] text-white flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
              {user?.show_avatar && user?.avatar_url
                ? <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                : (user?.avatar || user?.name?.slice(0, 2).toUpperCase())
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{user?.name}</div>
              <div className="text-[10px] text-[#A1A1AA]">{roleLabels[user?.role || ''] || user?.role}</div>
            </div>
          </button>
          <button onClick={handleLogout} className="text-[#71717A] hover:text-[#CC0033] transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-[#E4E4E7] px-6 py-3 flex items-center justify-end gap-3 flex-shrink-0">
          <NotificationPanel />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavItem({ to, icon, label, badge }: { to: string; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={to.endsWith('dashboard')}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-2 py-2 rounded text-base font-medium transition-colors mb-0.5 ` +
        (isActive
          ? 'bg-[#CC0033] text-white'
          : 'text-[#A1A1AA] hover:bg-[#27272A] hover:text-white')
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
      {badge != null && badge > 0 && (
        <span style={{ minWidth: 18, height: 18, padding: '0 5px', fontSize: 10, fontWeight: 700, borderRadius: 999, background: '#CC0033', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, flexShrink: 0 }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  )
}
