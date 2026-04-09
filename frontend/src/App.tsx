import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'

// Admin pages
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import AdminLayout from './components/layout/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import TicketsList from './pages/admin/TicketsList'
import TicketDetail from './pages/admin/TicketDetail'
import TicketNew from './pages/admin/TicketNew'
import ClientsList from './pages/admin/ClientsList'
import ClientDetail from './pages/admin/ClientDetail'
import EquipmentList from './pages/admin/EquipmentList'
import EquipmentDetail from './pages/admin/EquipmentDetail'
import RegistrationsList from './pages/admin/RegistrationsList'
import Settings from './pages/admin/Settings'
import DocumentsPage from './pages/admin/DocumentsPage'
import ProfilePage from './pages/admin/ProfilePage'

// Client pages
import ClientLayout from './components/layout/ClientLayout'
import ClientTickets from './pages/client/ClientTickets'
import ClientTicketDetail from './pages/client/ClientTicketDetail'
import ClientTicketNew from './pages/client/ClientTicketNew'
import ClientEquipment from './pages/client/ClientEquipment'
import ClientEquipmentDetail from './pages/client/ClientEquipmentDetail'
import ClientDocs from './pages/client/ClientDocs'
import ClientProfile from './pages/client/ClientProfile'

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div className="flex items-center justify-center h-screen text-gray-400">Загрузка...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function ClientGuard({ children }: { children: React.ReactNode }) {
  const { client, isLoading } = useAuth()
  if (isLoading) return <div className="flex items-center justify-center h-screen text-gray-400">Загрузка...</div>
  if (!client) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RootRedirect() {
  const { user, client } = useAuth()
  if (user) return <Navigate to="/admin/dashboard" replace />
  if (client) return <Navigate to="/client/tickets" replace />
  return <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Admin panel */}
          <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="tickets" element={<TicketsList />} />
            <Route path="tickets/new" element={<TicketNew />} />
            <Route path="tickets/:id" element={<TicketDetail />} />
            <Route path="clients" element={<ClientsList />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="equipment" element={<EquipmentList />} />
            <Route path="equipment/:id" element={<EquipmentDetail />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="registrations" element={<RegistrationsList />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          {/* Client LK */}
          <Route path="/client" element={<ClientGuard><ClientLayout /></ClientGuard>}>
            <Route index element={<Navigate to="tickets" replace />} />
            <Route path="tickets" element={<ClientTickets />} />
            <Route path="tickets/new" element={<ClientTicketNew />} />
            <Route path="tickets/:id" element={<ClientTicketDetail />} />
            <Route path="equipment" element={<ClientEquipment />} />
            <Route path="equipment/:id" element={<ClientEquipmentDetail />} />
            <Route path="docs" element={<ClientDocs />} />
            <Route path="profile" element={<ClientProfile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
