# CRUD Portfolio Manager (v0.1.0)

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

## Troubleshooting
- If API fails to start, confirm `MONGO_URI` is set in `apps/api/.env`.
- If web cannot reach API, confirm `VITE_API_URL` in `apps/web/.env`.
