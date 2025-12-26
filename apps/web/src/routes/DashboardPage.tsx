import { Button } from '@/components/ui/button'
import { useAuth } from '@/auth/AuthProvider'

export default function DashboardPage() {
  const { user, logout } = useAuth()

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">Hello, {user?.email}</p>
      <Button onClick={logout}>Logout</Button>
    </section>
  )
}
