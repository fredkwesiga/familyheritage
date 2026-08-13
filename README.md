# Family Heritage

Preserve a family's lineage, photographs and stories across generations.

**Status: Phase 1 — project foundation.** The frontend, API and database are wired together
and nothing else exists yet. Authentication is Phase 3.

---

## What you need installed

| Tool | Version | Check | If missing |
|---|---|---|---|
| Node.js | 22.12+ | `node -v` | [nodejs.org](https://nodejs.org) or `nvm install 22` |
| npm | 10+ | `npm -v` | Ships with Node |
| Docker + Compose | any current | `docker compose version` | [Docker Desktop](https://docs.docker.com/get-docker/) |
| Git | any | `git --version` | [git-scm.com](https://git-scm.com) |

Nothing else. No global CLIs, no database installed on your machine, no paid accounts.

If you would rather not run Docker, any PostgreSQL 14+ works — point `DATABASE_URL` at it
and skip `npm run db:up`.

---

## First run

```bash
git clone <your-repo-url> family-heritage
cd family-heritage

cp .env.example .env                    # docker-compose settings
cp apps/api/.env.example apps/api/.env  # API configuration
cp apps/web/.env.example apps/web/.env  # web client configuration

npm install        # installs all three workspaces, generates the Prisma client
npm run db:up      # starts PostgreSQL in Docker
npm run dev        # shared watcher + API on :3000 + web on :5173
```

Open **http://localhost:5173**. You should see "The foundation is in place" and a system
status card showing `family-heritage-api 0.1.0 · ok` and `postgres · ok`.

Also available:
- **http://localhost:3000/api/v1/health** — raw health JSON
- **http://localhost:3000/api/docs** — Swagger UI

### Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Everything, watched |
| `npm run api:dev` | API only |
| `npm run web:dev` | Web only |
| `npm run db:up` / `db:down` | Start / stop PostgreSQL |
| `npm run db:reset` | Destroy the volume and start fresh |
| `npm run typecheck` | Typecheck all workspaces |
| `npm run build` | Production build of everything |
| `npm run format` | Prettier |

---

## Repository layout

```
family-heritage/
├─ apps/
│  ├─ api/                 NestJS + Fastify + Prisma
│  │  ├─ prisma/           schema.prisma, migrations
│  │  └─ src/
│  │     ├─ common/        filters, guards, pipes — cross-cutting only
│  │     ├─ config/        Zod-validated environment
│  │     ├─ health/        the one feature module that exists today
│  │     └─ prisma/        PrismaService
│  └─ web/                 React + Vite + Tailwind
│     └─ src/
│        ├─ app/           providers, router, query client
│        ├─ components/ui/ shadcn/ui primitives
│        ├─ features/      one folder per feature: api, hooks, components
│        ├─ layouts/
│        ├─ lib/           api client, utils
│        ├─ pages/         route-level components only
│        └─ styles/        design tokens
└─ packages/
   └─ shared/              Zod schemas + types used by BOTH sides
```

**The rule that keeps this clean:** `packages/shared` holds the contract. A schema is
defined once there, the API validates against it, and the web client parses responses with
it. When the two drift, TypeScript says so at build time instead of the UI rendering
`undefined` at runtime.

Feature code lives in `features/`. `pages/` only composes. `components/ui/` never imports
from `features/`.

---

## Environment variables

Every variable is validated at boot by `apps/api/src/config/env.schema.ts`. A missing or
malformed value fails the process immediately with a readable message.

### `apps/api/.env`

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development` / `test` / `production` |
| `PORT` | no | `3000` | API listen port |
| `WEB_ORIGIN` | no | `http://localhost:5173` | Comma-separated CORS allowlist |
| `DATABASE_URL` | **yes** | — | PostgreSQL connection string |
| `LOG_LEVEL` | no | `info` | Log verbosity |
| `SWAGGER_ENABLED` | no | `true` | Serve `/api/docs`. Turn off in production |
| `AI_ENABLED` | no | `false` | Global AI kill switch (Phase 16) |
| `AI_API_KEY` | only if `AI_ENABLED=true` | — | Provider key. **Server-side only** |
| `AI_MODEL` | no | `claude-sonnet-4-6` | Model identifier |
| `CLOUDINARY_CLOUD_NAME` | Phase 9 | — | Cloudinary account |
| `CLOUDINARY_API_KEY` | Phase 9 | — | Cloudinary key |
| `CLOUDINARY_API_SECRET` | Phase 9 | — | **Never sent to the browser** |

### `apps/web/.env`

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `/api/v1` | API base path. Relative in dev so the Vite proxy handles it |
| `VITE_API_PROXY_TARGET` | `http://localhost:3000` | Where the dev proxy forwards `/api` |

Anything prefixed `VITE_` is compiled into the browser bundle and is **public**. Never put a
secret there.

`.env` is gitignored. `.env.example` is committed. Keep them in step.

---

## Where things are going

Cost and free-tier constraints: **[FREE-TIER-AND-COST-ASSUMPTIONS.md](./FREE-TIER-AND-COST-ASSUMPTIONS.md)** —
read this before deploying anything.

Build order: foundation → database → auth → families → members → relationships →
relationship engine → tree → photos → deceased treatment → profiles → stories → onboarding →
invitations → search → AI story assistant → audit → export → testing → deployment.
