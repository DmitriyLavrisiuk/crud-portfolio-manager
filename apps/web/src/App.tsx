import { NavLink, Navigate, Route, Routes } from 'react-router-dom'

import DashboardPage from './routes/DashboardPage'
import LoginPage from './routes/LoginPage'
import SettingsPage from './routes/SettingsPage'

function Layout() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <nav className="mx-auto flex w-full max-w-4xl items-center gap-6 px-6 py-4">
          <NavLink to="/login" className={linkClass}>
            Login
          </NavLink>
          <NavLink to="/dashboard" className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            Settings
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-4xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return <Layout />
}
