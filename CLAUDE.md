# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Early scaffold. This is the **backend repo** of a multi-tenant platform for sports schools (pilot: Argentinos Juniors, 4 venues, ~200 players). It is a sibling of `../escuelas-front` (separate repo, own history and deploy); the parent folder `escuelas-deportivas-app/` is not a repo and holds a copy of `docs/` and a root `AGENTS.md`.

Today the code is only the Firebase Functions starter: `functions/src/index.ts` just calls `setGlobalOptions({maxInstances: 10})`. No git commits yet, no tests, no emulator config, no `firestore.rules`/`storage.rules`. Everything below under "Planned" comes from the docs and is not built yet.

Source of truth (Spanish): `docs/producto.md` (product, edge cases C1–C22, open questions Q1–Q15) and `docs/plan-tecnico.md` (decisions D-01…D-19, each `Acordado` or `Por decidir`; only `Acordado` is binding). `docs/` in this repo is the editing copy: replicate every change to `../escuelas-front/docs/` (and `../docs/`) in the same session.

## Commands

Run from `functions/` (Node 24 per `engines`, TypeScript 6, ESLint 8 with Google config):

- `npm run build`: `tsc` to `functions/lib/`
- `npm run lint`: `eslint --ext .js,.ts .`
- `npm run serve`: build + `firebase emulators:start --only functions`
- `npm run deploy`: `firebase deploy --only functions` (predeploy runs lint + build)

Default Firebase project alias is `escuelas-deportivas-dev` (`.firebaserc`). No test runner is configured yet; the plan calls for Vitest (strict TDD in `domain` and `functions`, `@firebase/rules-unit-testing` for rules). Add the real test commands here when they exist.

## Planned architecture (do not violate)

- **npm workspace internal to this repo (D-01):** `functions/` (Cloud Functions 2nd gen), `packages/domain` (pure business rules, use cases, ports; must not import Firebase). Callable contracts: the back is the source of truth; zod schemas of each callable's input and output live next to the callable in `functions/` and nothing is published (the front keeps its own copy in its data adapter); a breaking change keeps the old callable until the front ships. The current `functions/` is still a standalone npm package.
- **Hexagonal (D-02):** `domain` defines ports (`PaymentRepository`, `Clock`, `ReceiptNumberGenerator`, `PaymentProvider`, `InvoicingProvider`); `functions` implements Firestore adapters and exposes use cases as callables.
- **Everything is a callable (D-03):** the client never touches Firestore or Storage. Security/Storage rules stay deny-all, proven by emulator tests (D-07).
- **Tenancy by path (D-05, D-06):** data lives under `tenants/{tenantId}/...` (one shared frontend/backend for all tenants). Never trust a client-sent `tenantId`; every call reads `memberships/{uid}_{tenantId}` for role and scope. No custom claims for tenant or role.
- **Files (D-08):** signed URLs issued by functions; files never pass through them.
- **Money and history:** integer COP (no floats); nothing is deleted (voids are reversing movements); rates versioned; `auditLog` create-only; dates in UTC, displayed in America/Bogota.
- **Receipts (D-09, D-12, D-19):** gap-free per-org consecutive number from a counter doc in a transaction; offline cash is numbered on sync (C22); receipts must say "Recibo interno, no válido como factura".
- **Policies are configuration:** overdue behavior and proration (C9) are per-school settings. Until C14 is decided, one active benefit per player.
- **Deploy scope:** this repo deploys `--only functions,firestore,storage`; the front deploys hosting only. Only this repo runs the Emulator Suite. Firestore and Functions share one region, fixed at creation (D-14).

## Workflow

Conventional commits. Docs ship with code (README per package, architecture doc, how-tos, ADRs). CI is GitHub Actions: PRs run lint, typecheck, tests; merge to `main` deploys to `dev`; `prod` needs manual approval. Phases: 0 Foundations → 1 Structure and players → 2 Money → 3 Field and control.
