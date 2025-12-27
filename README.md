# CRUD Portfolio Manager (v0.7.1)

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

### Web env

- `VITE_API_URL` (required)

### API env

- `PORT` (required)
- `MONGO_URI` (required)
- `JWT_ACCESS_SECRET` (required)
- `JWT_REFRESH_SECRET` (required)
- `JWT_ACCESS_TTL` (required, e.g. `15m`)
- `JWT_REFRESH_TTL` (required, e.g. `7d`)
- `COOKIE_SECURE` (required, `true`/`false`)
- `MASTER_KEY_HEX` (required, 64 hex chars; AES-256-GCM key for encrypted fields)
- `BINANCE_SPOT_BASE_URL` (optional; use `https://testnet.binance.vision` for Spot testnet)

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

## Transactions (v0.4.0)

- Create: `POST http://localhost:4000/transactions`
- List: `GET http://localhost:4000/transactions?from&to&symbol&type&page&limit`
- Get by id: `GET http://localhost:4000/transactions/:id`
- Update: `PATCH http://localhost:4000/transactions/:id`
- Delete: `DELETE http://localhost:4000/transactions/:id`
- UI: `http://localhost:5173/transactions`

## Binance integration (v0.5.0)

- Credentials: `GET/PUT/DELETE http://localhost:4000/binance/credentials`
- Test: `POST http://localhost:4000/binance/credentials/test`
- UI: `http://localhost:5173/settings`

## Binance Spot trading (v0.6.0)

- Account: `GET http://localhost:4000/binance/spot/account`
- Open orders: `GET http://localhost:4000/binance/spot/open-orders?symbol=BTCUSDT`
- Place order: `POST http://localhost:4000/binance/spot/order`
- Cancel order: `DELETE http://localhost:4000/binance/spot/order`
- Query order: `GET http://localhost:4000/binance/spot/order?symbol=BTCUSDT&orderId=...`
- My trades: `GET http://localhost:4000/binance/spot/my-trades?symbol=BTCUSDT`
- Cancel replace: `POST http://localhost:4000/binance/spot/order/cancel-replace`
- UI: `http://localhost:5173/spot`
- Note: for TRADE endpoints, enable trading permissions for the key in Binance API management.

## Deals (v0.7.0)

- Create: `POST http://localhost:4000/deals`
- List: `GET http://localhost:4000/deals?from&to&symbol&status`
- Get by id: `GET http://localhost:4000/deals/:id`
- Update: `PATCH http://localhost:4000/deals/:id`
- Close: `POST http://localhost:4000/deals/:id/close`
- Import trades: `POST http://localhost:4000/deals/:id/import-trades`
- Delete: `DELETE http://localhost:4000/deals/:id`
- Stats: `GET http://localhost:4000/deals/stats?from&to&symbol&status`
- UI: `http://localhost:5173/deals`

## UI routes

- `/login`, `/register`
- `/transactions`
- `/deals`
- `/spot`
- `/settings`
- `/admin/users` (admin only)

## Version notes

- v0.7.0
  - Deals module (manual deals): CRUD, close flow, realized PnL via Big.js, stats endpoint.
  - Deals UI: list with filters, create/edit/close/delete dialogs, stats card synced to filters.
  - Spot UI continues to support testnet operations via configured base URL.
- v0.7.1
  - Import Binance spot trades into a deal to auto-fill entry/exit legs.

## Troubleshooting

- If API fails to start, confirm `MONGO_URI` is set in `apps/api/.env`.
- If web cannot reach API, confirm `VITE_API_URL` in `apps/web/.env`.
