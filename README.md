# MedEtherial

**Connected care and emergency response.** MedEtherial puts patients, doctors, paramedics, dispatchers and hospital staff on one secure platform: appointment booking, health records, e-prescriptions and **live GPS ambulance dispatch and tracking**.

[![CI](https://github.com/VJnCode/MedEtherial/actions/workflows/ci.yml/badge.svg)](https://github.com/VJnCode/MedEtherial/actions/workflows/ci.yml)
[![CodeQL](https://github.com/VJnCode/MedEtherial/actions/workflows/codeql.yml/badge.svg)](https://github.com/VJnCode/MedEtherial/actions/workflows/codeql.yml)

---

## Features

| Area | What it does |
| --- | --- |
| **Identity & access** | OAuth 2.0 / **OpenID Connect** via Keycloak (Authorization Code + PKCE). There are six realm roles mapped to fine-grained permissions. The API verifies every JWT against the IdP's JWKS and also enforces **object-level** access, e.g. a doctor can only open charts of their own patients. |
| **Appointments** | Doctors publish weekly availability. Patients book 30-minute slots, and double-booking is impossible because of a unique partial index. Lifecycle: requested → confirmed → completed / cancelled / no-show. |
| **Health records** | Clinical notes with vitals and diagnosis, e-prescriptions, and a patient-editable medical profile (allergies, conditions, emergency contacts). |
| **Emergency SOS** | One-tap SOS with GPS, rule-based **triage**, **nearest-unit dispatch** using a MongoDB `$geoNear` query (ALS units first for critical cases), and atomic unit claiming so a unit can never be double-assigned. Hospital selection weighs distance, ER beds and trauma capability. |
| **Live tracking** | Crew phones stream GPS over authenticated **Socket.IO**. Routes come from **OSRM** and maps from **OpenStreetMap** with Leaflet. ETA updates on every fix, and the receiving ER gets a pre-arrival alert with vitals. |
| **Simulator** | Demo ambulances drive along real road routes and step incidents through their full lifecycle. A real crew device takes over automatically as soon as it reports a position. |
| **Operations** | Dispatch centre with a live fleet map and manual reassignment, response-time KPIs (avg and p90), fleet and ER capacity, an incidents log, and an admin console for users and roles that writes through to Keycloak. |
| **Compliance** | Append-only **audit log** of every access to health data. GPS breadcrumbs expire after 7 days (time-series collection with a TTL). |
| **UX** | Next.js 15, shadcn/ui, Framer Motion, **dark and light mode** (the maps follow the theme), fully responsive. |

## Architecture

```
┌──────────────┐  OIDC (PKCE)  ┌──────────────┐
│  Next.js web │ ────────────▶ │   Keycloak   │──▶ Postgres
│   (Vercel)   │ ◀──────────── │   (Render)   │
└──────┬───────┘   tokens      └──────▲───────┘
       │ REST + WebSocket (Bearer JWT)│ JWKS / Admin REST
┌──────▼───────────────────────────────┴──────┐
│ Express API + Socket.IO + simulator (Render) │──▶ OSRM (routing)
└──────────────────────┬──────────────────────┘
                       ▼
               MongoDB Atlas (geo + time-series)
```

```
apps/web          Next.js 15 (App Router, TypeScript, Tailwind v4, shadcn/ui, motion, Auth.js v5)
apps/api          Express 5, Socket.IO, Mongoose, zod, pino, OpenAPI (Swagger UI at /docs)
packages/shared   RBAC matrix, state machines, zod schemas, triage & geo helpers, socket event types
infra/keycloak    Production Keycloak image and the version-controlled realm (roles, clients, demo users)
```

## Local development

**Prerequisites:** Node 22+, Docker, and corepack (`corepack enable`).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # set MONGODB_URI (Atlas) — or use the local-db profile
cp apps/web/.env.example apps/web/.env      # set AUTH_SECRET (npx auth secret)

docker compose up -d                        # Keycloak :8080 (+ Postgres). Add --profile local-db for MongoDB
pnpm seed                                   # demo hospitals, doctors, patients, fleet, history
pnpm dev                                    # web :3000 · api :8000 · docs :8000/docs
```

### Demo accounts

The local password is `Demo@12345`. In production it comes from `DEMO_USER_PASSWORD`.

| E-mail | Role |
| --- | --- |
| patient@medetherial.dev | Patient |
| rahul@medetherial.dev | Patient |
| dr.rao@medetherial.dev | Doctor (Cardiology) |
| paramedic@medetherial.dev | Paramedic (crew of MYS-ALS-01) |
| dispatch@medetherial.dev | Dispatcher |
| hospital@medetherial.dev | Hospital admin |
| admin@medetherial.dev | Administrator |

The Keycloak admin console is at http://localhost:8080 (admin / admin, local only).

### Quality gates

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm --filter @medetherial/web e2e          # Playwright smoke tests (after build)
```

The API integration tests run against an in-memory MongoDB, with a locally signed JWKS standing in for Keycloak.

## Deployment

### 1. Keycloak and API on Render

1. In Render, choose **New → Blueprint** and point it at this repo. `render.yaml` creates `medetherial-keycloak`, its Postgres database and `medetherial-api`.
2. Fill the `sync: false` variables:
   - **Keycloak:** `KC_DB_URL` (`jdbc:postgresql://<internal-host>:5432/keycloak`), `KC_HOSTNAME` (its public URL) and `WEB_URL` (your Vercel URL).
   - **API:** `MONGODB_URI`, `OIDC_ISSUER` (`https://<keycloak>/realms/medetherial`), `CORS_ORIGINS` (your Vercel URL) and `KEYCLOAK_ADMIN_CLIENT_SECRET` (same value as the Keycloak service's `KC_ADMIN_CLIENT_SECRET`).
3. In MongoDB Atlas → Network Access, allow Render's outbound IPs.
4. Seed once from the Render shell: `node dist/scripts/seed.js`.

> Keycloak needs about 512 MB+ of RAM, so use at least the Starter plan. Render's free Postgres expires after 30 days. For long-lived setups, use a paid instance or an external Postgres (e.g. Neon) via `KC_DB_URL`.

### 2. Web on Vercel

1. Import the repo into Vercel and set **Root Directory** to `apps/web`. The install and build commands come from `apps/web/vercel.json`.
2. Set these environment variables:
   - `AUTH_SECRET`, `AUTH_URL` (the site URL)
   - `AUTH_KEYCLOAK_ID=medetherial-web`
   - `AUTH_KEYCLOAK_SECRET` (the Keycloak service's `KC_WEB_CLIENT_SECRET`)
   - `AUTH_KEYCLOAK_ISSUER`
   - `NEXT_PUBLIC_API_URL` (the Render API URL)
   - `NEXT_PUBLIC_KEYCLOAK_ACCOUNT_URL`
   - optionally `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true`

### 3. CI/CD (GitHub Actions)

| Workflow | Trigger | Jobs |
| --- | --- | --- |
| `ci.yml` | PRs and pushes to `main` | lint, typecheck, unit/integration tests, build → Playwright smoke tests → Docker image builds |
| `deploy.yml` | push to `main` | runs CI, then triggers the Render deploy hooks and waits for `/readyz`, then `vercel build` + `vercel deploy --prod` |
| `codeql.yml` | PRs, `main`, weekly | security analysis |

Repository **secrets** (environment `production`):

- `RENDER_API_DEPLOY_HOOK`, `RENDER_KEYCLOAK_DEPLOY_HOOK`
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`

Repository **variable**: `API_URL`, used for the post-deploy health check.

Render services use `autoDeploy: false`, so production only changes after CI passes. Disable Vercel's Git auto-deploy for production too, or keep it for preview deployments only.

## Maps & routing

- Tiles come from the OpenStreetMap standard tile server by default. For heavy production traffic, set `NEXT_PUBLIC_MAP_TILE_URL` (and `NEXT_PUBLIC_MAP_TILE_ORIGIN` for the CSP) to a self-hosted or commercial tile server, per the [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
- Routing uses the public OSRM demo server. Point `OSRM_URL` at your own OSRM instance for production. If routing is unavailable, the API falls back to a straight-line estimate so dispatch is never blocked.

## Security notes

- Tokens: 5-minute access tokens with refresh-token rotation, encrypted session cookie (Auth.js), and RP-initiated logout at Keycloak.
- API: helmet, strict CORS allowlist, rate limits (tighter on SOS), a 100 kB body limit, zod validation on every route, RFC 7807 error responses, and request IDs in the logs.
- Web: strict CSP, HSTS, `frame-ancestors 'none'`, and a `Permissions-Policy` that only allows geolocation for the site itself.
- Demo users ship in the realm for convenience. **Delete them or rotate `DEMO_USER_PASSWORD` before going live with real patients.**

> MedEtherial supports clinical workflows but is not a substitute for public emergency services.

## License

MIT
