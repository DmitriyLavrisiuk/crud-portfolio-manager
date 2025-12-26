import { useState } from 'react'

import { Button } from '../components/ui/button'

type HealthResponse = {
  ok: boolean
  ts: string
}

export default function LoginPage() {
  const [status, setStatus] = useState<HealthResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const pingApi = async () => {
    setIsLoading(true)
    setError(null)
    setStatus(null)

    try {
      const apiUrl = import.meta.env.VITE_API_URL
      const response = await fetch(`${apiUrl}/health`)
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      const data = (await response.json()) as HealthResponse
      setStatus(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Login</h1>
      <p className="text-muted-foreground">
        Ping the API health endpoint to verify connectivity.
      </p>
      <Button onClick={pingApi} disabled={isLoading}>
        {isLoading ? 'Pinging...' : 'Ping API'}
      </Button>
      {status ? (
        <div className="rounded-md border border-border bg-card p-4 text-sm">
          <div>ok: {String(status.ok)}</div>
          <div>ts: {status.ts}</div>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </section>
  )
}
