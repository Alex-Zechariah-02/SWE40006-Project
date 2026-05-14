# Balance

Balance is a platform for converting transaction documents into structured records. It handles receipts, invoices, and proofs of purchase, covering use cases such as refunds, reimbursements, claims, approvals, and document review.

## What Balance is about

Transaction documents are commonly spread across email inboxes, downloads folders, chat threads, cloud drives, and physical paper. That distribution makes them difficult to search, difficult to verify, and prone to being unavailable when they are actually needed.

The platform is built around four core principles:

- keep the original document
- convert it into a structured record
- make that record usable across personal and team workflows
- retain enough context for review, correction, and accountability

The goal is a document workflow, not just a storage layer.

## Who it is for

Balance is designed for individuals and teams.

### Individuals

- tracking receipts and proofs of purchase
- retrieving old records when needed
- managing documents for refunds, warranties, reimbursements, or claims
- reviewing personal transaction history

### Teams and organizations

- reviewing submitted documents consistently
- verifying extracted details before processing
- recording status, notes, and review outcomes
- auditing what was submitted, checked, approved, or rejected

## How Balance works at a high level

Balance is planned as a single platform with role-aware views over a shared document lifecycle. A document moves from personal record to structured data to formal review without losing its link to the original source. That shared lifecycle across all stages is the core architectural intent.

## Current repository state

The repository is an early, deployable foundation. It is not a complete product.

Today it includes:

- a web shell for the main browser experience
- an API shell with health, readiness, and version responses
- a desktop shell reflecting the multi-surface product direction
- shared packages for configuration, types, UI components, and runtime helpers
- Docker and Compose assets for local, staging, and production environments
- CI and deployment workflows for build, verification, packaging, and smoke checks

The scope is intentional. The focus at this stage is establishing product shape, project structure, runtime wiring, and deployment path. Document processing and review workflows come later.

## Current capabilities

- public web routes at `/`, `/login`, and `/app`
- API endpoints for `/health`, `/ready`, and `/version`
- proxy-friendly web-to-API routing through `/api/*`
- a desktop shell with a secure preload bridge
- local, staging, and production container definitions
- automated lint, typecheck, test, build, and smoke-check support

## Observability

Balance includes an observability layer to support service health checks, host resource visibility, and container runtime visibility without changing the public web and API access model.

## Architecture at a glance

Balance is currently structured as a pnpm monorepo:

- `apps/web` for the web application
- `apps/api` for the API
- `apps/desktop` for the desktop application
- `packages/config`, `packages/types`, `packages/ui`, and `packages/utils` for shared building blocks

## Local development

Use Node `24.15.0` and pnpm `10.33.1`.

```bash
corepack enable
corepack prepare pnpm@10.33.1 --activate
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

Useful local routes:

- `http://localhost:3000/`
- `http://localhost:3000/login`
- `http://localhost:3000/app`
- `http://localhost:3000/api/health`
- `http://localhost:3000/api/ready`
- `http://localhost:3000/api/version`

## Direction

The longer-term direction is a fuller document-to-record workflow platform covering richer document intake, structured extraction, review flows, and role-aware experiences over shared underlying records.

This repository is the starting point.
