import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'

import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

type UserRole = 'admin' | 'user'

type UserRow = {
  id: string
  email: string
  role: UserRole
  createdAt?: string
}

const API_URL = import.meta.env.VITE_API_URL

async function authRequest(
  path: string,
  options: RequestInit,
  accessToken: string | null,
  refresh: () => Promise<string | null>,
) {
  const makeRequest = (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

  const response = await makeRequest(accessToken)
  if (response.status === 401) {
    const newToken = await refresh()
    if (newToken) {
      return makeRequest(newToken)
    }
  }
  return response
}

async function safeErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { message?: string }
    return data?.message ?? `Request failed (${response.status})`
  } catch {
    return `Request failed (${response.status})`
  }
}

export default function AdminUsersPage() {
  const { accessToken, refresh, user } = useAuth()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'admin'

  const usersQuery = useQuery({
    queryKey: ['users'],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await authRequest(
        '/users',
        { method: 'GET' },
        accessToken,
        refresh,
      )
      if (response.status === 403) {
        return { accessDenied: true, users: [] as UserRow[] }
      }
      if (!response.ok) {
        throw new Error(await safeErrorMessage(response))
      }
      const data = (await response.json()) as UserRow[]
      return { accessDenied: false, users: data }
    },
  })

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: UserRole }) => {
      const response = await authRequest(
        `/users/${id}`,
        { method: 'PATCH', body: JSON.stringify({ role }) },
        accessToken,
        refresh,
      )
      if (!response.ok) {
        throw new Error(await safeErrorMessage(response))
      }
      return (await response.json()) as UserRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await authRequest(
        `/users/${id}`,
        { method: 'DELETE' },
        accessToken,
        refresh,
      )
      if (!response.ok) {
        throw new Error(await safeErrorMessage(response))
      }
      return (await response.json()) as { ok: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const data = usersQuery.data?.users ?? []
  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        accessorKey: 'email',
        header: 'Email',
        cell: ({ getValue }) => getValue(),
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: ({ row }) => (
          <Badge
            variant={row.original.role === 'admin' ? 'default' : 'secondary'}
          >
            {row.original.role}
          </Badge>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
        cell: ({ row }) =>
          row.original.createdAt
            ? new Date(row.original.createdAt).toLocaleDateString()
            : '—',
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const isSelf = row.original.id === user?.id
          return (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={row.original.role}
                onValueChange={(value) => {
                  updateRoleMutation.mutate({
                    id: row.original.id,
                    role: value as UserRole,
                  })
                }}
                disabled={updateRoleMutation.isPending}
              >
                <SelectTrigger className="h-8 w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">user</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={isSelf || deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete user?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate(row.original.id)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )
        },
      },
    ],
    [deleteMutation, updateRoleMutation, user?.id],
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <section className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Manage roles and access.</CardDescription>
        </CardHeader>
        <CardContent>
          {!isAdmin && (
            <p className="text-sm text-muted-foreground">Access denied.</p>
          )}
          {isAdmin && usersQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading users...</p>
          )}
          {isAdmin && usersQuery.data?.accessDenied && (
            <p className="text-sm text-muted-foreground">Access denied.</p>
          )}
          {isAdmin && usersQuery.error instanceof Error && (
            <p className="text-sm text-destructive">
              {usersQuery.error.message}
            </p>
          )}
          {isAdmin &&
            !usersQuery.isLoading &&
            !usersQuery.data?.accessDenied && (
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id}>
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={columns.length}>
                          No users found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
        </CardContent>
      </Card>
    </section>
  )
}
