# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Early stage. This is the **backend repo** of a multi-tenant platform for sports schools (pilot: Argentinos Juniors, 4 venues, ~200 players). It is a sibling of `../escuelas-front` (separate repo, own history and deploy); the parent folder `escuelas-deportivas-app/` is not a repo and holds a copy of `docs/` and a root `AGENTS.md`.

Spec 01 (`specs/01-fundaciones-backend.md`, backend foundations) is in progress. Built so far: the npm workspace, `packages/domain` (roles, membership, ports, `ChangeMembershipRole`, in-memory fakes), Emulator Suite config, deny-all `firestore.rules`/`storage.rules` proven by tests, Firestore adapters, the authorization helper, the `listMyMemberships` and `changeMembershipRole` callables, and the seed script. CI and deploy-to-dev workflows are written in `.github/workflows/` (ADR 0006) but have not run on GitHub yet. The functions, rules and indexes are deployed to `dev` (us-central1, Node 24), `dev` is seeded and `npm run smoke:dev` passes there. What remains for spec 01 is verifying the acceptance criteria and CI on a real GitHub PR. No business modules yet (venues, players, payments…): those are later specs, see `specs/ROADMAP.md`. Architecture overview: `docs/arquitectura.md`; decisions of this spec: `docs/adr/`.

Source of truth (Spanish): `docs/producto.md` (product, edge cases C1–C22, open questions Q1–Q15) and `docs/plan-tecnico.md` (decisions D-01…D-19, each `Acordado` or `Por decidir`; only `Acordado` is binding). `docs/` in this repo is the editing copy: replicate every change to `../escuelas-front/docs/` (and `../docs/`) in the same session.

## Commands

Run from the repo root (Node 24 per `engines`, TypeScript 6, ESLint 8 with Google config, Vitest 3). Strict TDD: write the failing test first.

- `npm run build`: builds `packages/domain` (`dist/`), then typechecks `functions` and bundles it with esbuild into `functions/lib/index.js` (the domain is inlined; see `docs/adr/0001-empaquetado-del-workspace.md`)
- `npm run lint`: ESLint for `functions`, `packages/domain` (also forbids Firebase imports there) and `scripts/`
- `npm run typecheck`: builds the domain, then `tsc --noEmit` for every package and `scripts/`
- `npm run test:domain`: Vitest on `packages/domain`, no emulator
- `npm run test:rules`: Firestore/Storage rules tests under `firebase emulators:exec` (project `demo-escuelas-rules`)
- `npm run test:integration`: builds, then runs adapter, callable (over HTTP) and seed tests under `emulators:exec` with Auth + Firestore + Functions (project `demo-escuelas-integration`)
- `npm run seed:emulator` (inside an emulator session) / `SEED_PASSWORD=... npm run seed:dev`: idempotent seed; `--target` is mandatory and `prod` does not exist
- `npm run smoke:dev` (needs `SEED_PASSWORD` and `FIREBASE_API_KEY`, the dev project's Web API key): signs in as seeded users and exercises the deployed callables; `npm run smoke:emulator` runs the same script locally
- From `functions/`: `npm run serve` (build + functions emulator) and `npm run deploy` (`firebase deploy --only functions`; predeploy runs lint + build)

Firebase aliases in `.firebaserc`: `default` and `dev` → `escuelas-deportivas-dev`; `prod` is added when that project exists. The `test:*` scripts use `demo-*` projects and never touch `dev`. Lint line limit is 80 columns (Google config), including imports.

## Architecture (do not violate)

- **npm workspace internal to this repo (D-01):** `functions/` (Cloud Functions 2nd gen), `packages/domain` (pure business rules, use cases, ports; must not import Firebase) and `scripts/` (seed). Callable contracts: the back is the source of truth; zod schemas of each callable's input and output live next to the callable in `functions/src/callables/<name>/schema.ts` and nothing is published (the front keeps its own copy in its data adapter); a breaking change keeps the old callable until the front ships. Runtime dependencies of `functions` go in `dependencies` (devDependencies get bundled by esbuild).
- **Hexagonal (D-02):** `domain` defines ports; `functions` implements Firestore adapters and exposes use cases as callables. Built so far: `MembershipRepository`, `AuditLogWriter`, `UnitOfWork`, `Clock`. The payment ports (`PaymentRepository`, `ReceiptNumberGenerator`, `PaymentProvider`, `InvoicingProvider`) come in Phase 2. To add a use case see `docs/guias/agregar-caso-de-uso.md`.
- **Everything is a callable (D-03):** the client never touches Firestore or Storage. Security/Storage rules stay deny-all, proven by emulator tests (D-07).
- **Tenancy by path (D-05, D-06):** data lives under `tenants/{tenantId}/...` (one shared frontend/backend for all tenants). Never trust a client-sent `tenantId`; every call reads `memberships/{uid}_{tenantId}` for role and scope. No custom claims for tenant or role.
- **Files (D-08):** signed URLs issued by functions; files never pass through them.
- **Money and history:** integer COP (no floats); nothing is deleted (voids are reversing movements); rates versioned; `auditLog` create-only; dates in UTC, displayed in America/Bogota.
- **Receipts (D-09, D-12, D-19):** gap-free per-org consecutive number from a counter doc in a transaction; offline cash is numbered on sync (C22); receipts must say "Recibo interno, no válido como factura".
- **Policies are configuration:** overdue behavior and proration (C9) are per-school settings. Until C14 is decided, one active benefit per player.
- **Deploy scope:** this repo deploys `--only functions,firestore,storage`; the front deploys hosting only. Only this repo runs the Emulator Suite. Firestore and Functions share one region, fixed at creation (D-14).

## Workflow

Conventional commits. Docs ship with code (README per package, architecture doc, how-tos, ADRs). CI is GitHub Actions: PRs run lint, typecheck, tests; the `dev` environment always mirrors the `dev` branch (a push to `dev` deploys to the `dev` Firebase project; PRs target `dev` or `main`); `prod` needs manual approval. Phases: 0 Foundations → 1 Structure and players → 2 Money → 3 Field and control.
