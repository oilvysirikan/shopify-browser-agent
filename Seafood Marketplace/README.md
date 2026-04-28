# Seafood Marketplace (Rails API + Frontend + Worker)

This repository is split into two clear apps:

- `apps/api` - Rails API backend
- `apps/frontend` - React + Vite frontend
- `facebook-feed-app` - Node.js worker for Shopify/Facebook sync

Legacy Shopify prototype files were moved to:

- `legacy/shopify-prototype`

## Architecture

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000`
- Worker: `http://localhost:4000`
- API health endpoint: `GET /health`

The frontend calls the API via `VITE_API_BASE_URL`.

## Prerequisites

- Docker + Docker Compose
- Node.js 18+

## 1) Install dependencies

```bash
npm install
npm run setup
```

## 2) Start full stack (API + Frontend + Worker)

```bash
npm run dev
```

This runs:

- `docker compose up --build api sidekiq` (and brings up Postgres + Redis via dependency)
- frontend dev server on `5173`
- worker dev server on `4000`

## Run apps separately

API only:

```bash
npm run dev:api
```

Frontend only:

```bash
npm run dev:frontend
```

Worker only:

```bash
npm run dev:worker
```

## Environment files

Copy examples if needed:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/frontend/.env.example apps/frontend/.env
cp facebook-feed-app/.env.example facebook-feed-app/.env
```

## Worker/API Integration Endpoints

- Worker -> Rails webhook forward:
  - `POST /webhooks/products/update` (worker)
  - `POST /webhooks/products/create` (worker)
  - `POST /webhooks/products/delete` (worker)
  - forwards to `POST /api/v1/webhooks/shopify/product_update` (Rails)
- Rails -> Worker sync:
  - `POST /api/v1/sync/facebook` (Rails queues job)
  - `POST /api/v1/sync/facebook/trigger` (manual trigger endpoint)
  - job calls `POST /sync/facebook` (worker)
- Worker -> Rails callback:
  - `POST /api/v1/sync/facebook/callback` (Rails)
  - `POST /api/v1/sync/google/callback` (Rails)

## Security Headers

- Worker webhooks verify Shopify HMAC (`X-Shopify-Hmac-Sha256`) before forwarding.
- Worker enforces topic allowlist via `X-Shopify-Topic` (`SHOPIFY_ALLOWED_TOPICS`).
- Worker also enforces endpoint/topic mapping:
  - `/webhooks/products/update` -> `products/update`
  - `/webhooks/products/create` -> `products/create`
  - `/webhooks/products/delete` -> `products/delete`
- Worker blocks replay by deduping `X-Shopify-Webhook-Id` for `SHOPIFY_WEBHOOK_TTL_SECONDS`.
  - Uses Redis if `REDIS_URL` is set.
  - Falls back to in-memory dedupe when Redis is unavailable.
- Worker -> Rails requests include:
  - `X-Worker-Token: <WORKER_SHARED_TOKEN>`
  - `X-Webhook-Verified: true` (for webhook forward path)
- Rails protected endpoints require `X-Worker-Token`.
- AdScale/Dashboard endpoints on worker require:
  - `X-Api-Key: <ADSCALE_API_KEY>`
