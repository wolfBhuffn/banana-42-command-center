# BANANA_42 Command Center

A private shift and pay ledger for independent operators to track work hours, record completed shifts, and review earnings.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the shared API server
- `pnpm --filter @workspace/banana42-command-center run dev` — run the web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required environment: `DATABASE_URL`; Clerk keys are provisioned through Replit Auth setup.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web: React, Vite, Tailwind CSS, Clerk
- API: Express 5 with Clerk session validation
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- API build: esbuild bundle

## Where things live

- `artifacts/banana42-command-center/` — public landing page, Clerk auth routes, dashboard, and shift history
- `artifacts/api-server/src/routes/shifts.ts` — authenticated shift and dashboard endpoints
- `lib/db/src/schema/shifts.ts` — persistent shift records and database constraints
- `lib/api-spec/openapi.yaml` — source of truth for API request and response contracts

## Architecture decisions

- Clerk is the identity provider; shift ownership is derived from the verified session, never from client-supplied owner IDs.
- Hourly rates are stored as integer cents per shift; the initial default is $20/hour, matching the uploaded prototype.
- One active shift per account is enforced by a partial unique index; manual entries reject overlapping time ranges.
- Dashboard week-to-date totals use Monday 00:00 UTC as the boundary.

## Product

- Sign up and sign in with managed authentication.
- Start and end a live shift with a per-shift hourly rate and optional note.
- Add completed shifts, review paginated history, and delete completed records.
- See current-week and all-time hours and estimated pay.

## User preferences

- Preserve the BANANA_42 / WOLFX__XSABYTERS identity from the uploaded project.

## Gotchas

- Browser API calls use same-origin Clerk session cookies; do not add bearer-token handling to the web app.
- Run API code generation after every OpenAPI change.
- Publish applies managed PostgreSQL schema changes to production.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
