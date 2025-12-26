import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { useAuth } from '@/auth/AuthProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  deleteBinanceCredentials,
  getBinanceCredentials,
  saveBinanceCredentials,
  testBinanceCredentials,
} from '@/lib/binance'

const binanceSchema = z.object({
  apiKey: z.string().min(10, 'API key must be at least 10 characters'),
  apiSecret: z.string().min(10, 'API secret must be at least 10 characters'),
})

type BinanceFormValues = z.infer<typeof binanceSchema>

const defaultValues = {
  apiKey: '',
  apiSecret: '',
}

function formatDateTime(value?: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString()
}

export default function SettingsPage() {
  const { accessToken, refresh } = useAuth()
  const queryClient = useQueryClient()
  const [isUpdateOpen, setIsUpdateOpen] = useState(false)
  const [isDisconnectOpen, setIsDisconnectOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [testError, setTestError] = useState<string | null>(null)

  const credentialsQuery = useQuery({
    queryKey: ['binanceCredentials'],
    queryFn: () =>
      getBinanceCredentials({
        accessToken,
        onUnauthorized: refresh,
      }),
  })

  const status = credentialsQuery.data

  const createForm = useForm<BinanceFormValues>({
    resolver: zodResolver(binanceSchema),
    defaultValues,
  })

  const updateForm = useForm<BinanceFormValues>({
    resolver: zodResolver(binanceSchema),
    defaultValues,
  })

  const saveMutation = useMutation({
    mutationFn: (values: BinanceFormValues) =>
      saveBinanceCredentials(values, { accessToken, onUnauthorized: refresh }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['binanceCredentials'] })
      createForm.reset(defaultValues)
      setFormError(null)
    },
    onError: (error) => {
      setFormError(
        error instanceof Error ? error.message : 'Failed to save credentials.',
      )
    },
  })

  const updateMutation = useMutation({
    mutationFn: (values: BinanceFormValues) =>
      saveBinanceCredentials(values, { accessToken, onUnauthorized: refresh }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['binanceCredentials'] })
      updateForm.reset(defaultValues)
      setIsUpdateOpen(false)
      setFormError(null)
    },
    onError: (error) => {
      setFormError(
        error instanceof Error
          ? error.message
          : 'Failed to update credentials.',
      )
    },
  })

  const testMutation = useMutation({
    mutationFn: () =>
      testBinanceCredentials({ accessToken, onUnauthorized: refresh }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['binanceCredentials'] })
      setTestError(data.ok ? null : (data.message ?? 'Connection failed.'))
    },
    onError: (error) => {
      setTestError(
        error instanceof Error ? error.message : 'Connection test failed.',
      )
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteBinanceCredentials({ accessToken, onUnauthorized: refresh }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['binanceCredentials'] })
      setIsDisconnectOpen(false)
      setTestError(null)
    },
  })

  const testStatus = useMemo(() => {
    if (!status?.lastTestedAt) return null
    const label = status.lastTestOk ? 'Last test: ok' : 'Last test: failed'
    return {
      label,
      time: formatDateTime(status.lastTestedAt),
      ok: Boolean(status.lastTestOk),
      error: status.lastTestError,
    }
  }, [status?.lastTestedAt, status?.lastTestOk, status?.lastTestError])

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Configure your preferences.</p>
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>Binance Integration</CardTitle>
          <CardDescription>
            Store encrypted API keys and verify Spot access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {credentialsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading status...</p>
          ) : credentialsQuery.error instanceof Error ? (
            <p className="text-sm text-destructive">
              {credentialsQuery.error.message}
            </p>
          ) : status?.connected ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Connected</Badge>
                <span className="text-sm text-muted-foreground">
                  API key ****{status.apiKeyLast4}
                </span>
                {status.updatedAt ? (
                  <span className="text-xs text-muted-foreground">
                    Updated {formatDateTime(status.updatedAt)}
                  </span>
                ) : null}
              </div>
              {testStatus ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={testStatus.ok ? 'default' : 'destructive'}>
                    {testStatus.label}
                  </Badge>
                  {testStatus.time ? (
                    <span className="text-muted-foreground">
                      {testStatus.time}
                    </span>
                  ) : null}
                  {!testStatus.ok && testStatus.error ? (
                    <span className="text-destructive">{testStatus.error}</span>
                  ) : null}
                </div>
              ) : null}
              {testError ? (
                <p className="text-sm text-destructive">{testError}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFormError(null)
                    setTestError(null)
                    updateForm.reset(defaultValues)
                    setIsUpdateOpen(true)
                  }}
                >
                  Update keys
                </Button>
                <Button
                  variant="outline"
                  onClick={() => testMutation.mutate()}
                  disabled={testMutation.isPending}
                >
                  {testMutation.isPending ? 'Testing...' : 'Test connection'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setIsDisconnectOpen(true)}
                  disabled={deleteMutation.isPending}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={createForm.handleSubmit((values) =>
                saveMutation.mutate(values),
              )}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="binance-api-key">API key</Label>
                  <Input
                    id="binance-api-key"
                    autoComplete="off"
                    {...createForm.register('apiKey')}
                  />
                  {createForm.formState.errors.apiKey ? (
                    <p className="text-sm text-destructive">
                      {createForm.formState.errors.apiKey.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="binance-api-secret">API secret</Label>
                  <Input
                    id="binance-api-secret"
                    type="password"
                    autoComplete="off"
                    {...createForm.register('apiSecret')}
                  />
                  {createForm.formState.errors.apiSecret ? (
                    <p className="text-sm text-destructive">
                      {createForm.formState.errors.apiSecret.message}
                    </p>
                  ) : null}
                </div>
              </div>
              {formError ? (
                <p className="text-sm text-destructive">{formError}</p>
              ) : null}
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Dialog open={isUpdateOpen} onOpenChange={setIsUpdateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Binance keys</DialogTitle>
            <DialogDescription>
              Replace your API key and secret securely.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={updateForm.handleSubmit((values) =>
              updateMutation.mutate(values),
            )}
          >
            <div className="space-y-2">
              <Label htmlFor="update-api-key">API key</Label>
              <Input
                id="update-api-key"
                autoComplete="off"
                {...updateForm.register('apiKey')}
              />
              {updateForm.formState.errors.apiKey ? (
                <p className="text-sm text-destructive">
                  {updateForm.formState.errors.apiKey.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="update-api-secret">API secret</Label>
              <Input
                id="update-api-secret"
                type="password"
                autoComplete="off"
                {...updateForm.register('apiSecret')}
              />
              {updateForm.formState.errors.apiSecret ? (
                <p className="text-sm text-destructive">
                  {updateForm.formState.errors.apiSecret.message}
                </p>
              ) : null}
            </div>
            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUpdateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Updating...' : 'Update'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDisconnectOpen} onOpenChange={setIsDisconnectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Binance?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes your encrypted API credentials from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
