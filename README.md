# CRUD Portfolio Manager (v0.3.0)

Monorepo scaffold with a Vite + React web app and a NestJS API.

## Prerequisites

- Node.js 18+
- pnpm
- Docker (for MongoDB)

## Setup

```bash
pnpm i
```

## Environment

Copy example env files and adjust if needed:

- `apps/web/.env.example` -> `apps/web/.env`
- `apps/api/.env.example` -> `apps/api/.env`

### API env (auth)

- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL` (e.g. `15m`)
- `JWT_REFRESH_TTL` (e.g. `7d`)
- `COOKIE_SECURE` (`true`/`false`)

## Run database

```bash
pnpm dev:db
```

## Run apps (web + api)

```bash
pnpm dev
```

## Ports

- Web: http://localhost:5173
- API: http://localhost:4000
- MongoDB: localhost:27017

## Health check

- API: `GET http://localhost:4000/health`

## Auth flow (v0.2.0)

- Register: `POST http://localhost:4000/auth/register`
- Login: `POST http://localhost:4000/auth/login`
- Refresh (cookie): `POST http://localhost:4000/auth/refresh`
- Logout: `POST http://localhost:4000/auth/logout`
- Me (access token): `GET http://localhost:4000/auth/me`

## Admin users (v0.3.0)

- The first registered user becomes `admin`.
- After login as admin, open `http://localhost:5173/admin/users` to manage users and roles.

## Troubleshooting

- If API fails to start, confirm `MONGO_URI` is set in `apps/api/.env`.
- If web cannot reach API, confirm `VITE_API_URL` in `apps/web/.env`.
