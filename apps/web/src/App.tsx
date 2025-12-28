import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'

import ProtectedRoute from './auth/ProtectedRoute'
import { useAuth } from './auth/AuthProvider'
import AdminUsersPage from './routes/AdminUsersPage'
import DashboardPage from './routes/DashboardPage'
import DealsPage from './routes/DealsPage'
import LoginPage from './routes/LoginPage'
import RegisterPage from './routes/RegisterPage'
import SettingsPage from './routes/SettingsPage'
import SpotPage from './routes/SpotPage'
import TransactionsPage from './routes/TransactionsPage'

function Layout() {
  const { user } = useAuth()
  const location = useLocation()
  const isDealsRoute = location.pathname.startsWith('/deals')
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <nav className="mx-auto flex w-full max-w-4xl items-center gap-6 px-6 py-4">
          <NavLink to="/login" className={linkClass}>
            Login
          </NavLink>
          <NavLink to="/register" className={linkClass}>
            Register
          </NavLink>
          <NavLink to="/dashboard" className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            Settings
          </NavLink>
          <NavLink to="/transactions" className={linkClass}>
            Transactions
          </NavLink>
          <NavLink to="/deals" className={linkClass}>
            Deals
          </NavLink>
          <NavLink to="/spot" className={linkClass}>
            Spot
          </NavLink>
          {user?.role === 'admin' && (
            <NavLink to="/admin/users" className={linkClass}>
              Users
            </NavLink>
          )}
        </nav>
      </header>
      <main
        className={`mx-auto w-full px-6 py-8 ${isDealsRoute ? 'max-w-none' : 'max-w-4xl'}`}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <TransactionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/deals"
            element={
              <ProtectedRoute>
                <DealsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/spot"
            element={
              <ProtectedRoute>
                <SpotPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute>
                <AdminUsersPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return <Layout />
}
