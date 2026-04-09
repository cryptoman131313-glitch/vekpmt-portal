import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { FileText, Wrench, BookOpen, User, LogOut } from 'lucide-react'

export default function ClientLayout() {
  const { client, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAFA]">
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
          <NavItem to="/client/tickets" end icon={<FileText size={20} />} label="Мои заявки" />
          <NavItem to="/client/equipment" icon={<Wrench size={20} />} label="Моё оборудование" />
          <NavItem to="/client/docs" icon={<BookOpen size={20} />} label="Документация" />
          <NavItem to="/client/profile" icon={<User size={20} />} label="Профиль" />
        </nav>

        {/* User */}
        <div className="border-t border-[#333] p-3 pb-10 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#003399] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
            {client?.contact_name?.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white truncate">{client?.contact_name}</div>
            <div className="text-[10px] text-[#A1A1AA] truncate">{client?.company_name}</div>
          </div>
          <button onClick={handleLogout} className="text-[#71717A] hover:text-[#CC0033] transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavItem({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-2 py-2 rounded text-base font-medium transition-colors mb-0.5 ` +
        (isActive ? 'bg-[#CC0033] text-white' : 'text-[#A1A1AA] hover:bg-[#27272A] hover:text-white')
      }
    >
      {icon}
      <span className="flex-1">{label}</span>
    </NavLink>
  )
}
