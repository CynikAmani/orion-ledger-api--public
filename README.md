# Orion Ledger API

Backend for **Orion Ledger**, an Orion Systems product that helps microfinance institutions run day-to-day operations on one multi-tenant platform.

Each tenant is an institution. Platform operators run the network; tenant staff manage lending for their organisation; customers register once on the platform and can apply, borrow, and repay across institutions.

This repository is the NestJS API. Routes resolve under `/api/v1`. Implementation conventions for contributors live in [`CONTEXT_PRIMER.txt`](./CONTEXT_PRIMER.txt).

## What the API covers

| Area | Operations |
| --- | --- |
| Identity & access | Sign-in, MFA, Google OAuth, password reset, account invites |
| Tenants | Onboard institutions, public directory, brand, membership |
| People | Platform customers, tenant staff, roles, and permissions |
| Lending | Loan types, rates, promotions, applications, issuance, portfolio, repayments, reports |
| Daily ops | Dashboards, special offers, support tickets, announcements, approvals |

Customers are **platform users**. Platform operators and tenant staff have role-based access to institutional operations.

## Tech stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js, TypeScript |
| Framework | NestJS 11 |
| ORM | Prisma 7 |
| Database | PostgreSQL |
| Queue / email | Redis (BullMQ) + Brevo |
| Auth | Passport JWT, bcrypt, Google OAuth |
| Rate limiting | `@nestjs/throttler` |
| Validation | class-validator, Joi |

## Architecture

`AppModule` wires config, throttling, database, `CoreModule`, and feature modules. `CoreModule` registers the cross-cutting stack: JWT, permission guards, logging, exception filters, and audit.

Feature controllers do not re-implement auth or error shaping.

```
Request
  → ThrottlerGuard (global)
  → JwtAuthGuard (unless @Public())
  → PermissionGuard (if @Permission() is set)
  → Controller (auth, DTO parsing, audit context)
  → Domain service (storage, audit emission)
```

| Path | Responsibility |
| --- | --- |
| `src/main.ts` | Bootstrap: `/api` prefix, URI version `v1`, CORS, Helmet, Swagger |
| `src/core/` | Config, database, audit, email, storage, notifications, schedule |
| `src/common/` | Filters, interceptors, exceptions, helpers |
| `src/modules/` | Domain APIs |

```
src/modules/
├── auth/                    # authentication and authorization
├── users/                   # user management
├── roles/                   # role management
├── tenants/                 # tenant management
├── customers/               # customer operations
├── loans/                   # loan operations
├── loan-configurations/     # loan configuration
├── dashboards/              # dashboards
├── special-offers/
├── support/
├── approvals/
├── content-management/      # content and brand management
├── system-configurations/   # system settings
├── repayment-details/
├── lookups/
├── districts/
└── genders/
```

Parent aggregate modules only import and export children. Controllers live in the child modules.

## Authentication and authorization

All routes require authentication unless marked `@Public()`.

Permissions use a two-prefix catalog:

- `platform:*` — platform infrastructure and customer operations
- `tenant:*` — institution staff operations

| Endpoint | Access |
| --- | --- |
| `POST /api/v1/auth/login` | Public |
| `POST /api/v1/auth/refresh` | Public |
| `POST /api/v1/auth/logout` | Authenticated |
| Other routes | Authenticated (unless `@Public()`) |

## Getting started

### Prerequisites

- Node.js 20+
- PostgreSQL
- Redis (for email queue)
- npm

### Install

```bash
npm install
```

### Environment

Copy [`.env.example`](./.env.example) to `.env`. See the example file for required configuration variables.

### Database

Set up and seed the database:

```bash
npm run db:reset
```

### Run

```bash
npm run redis:up           # local Redis for email delivery
npm run start:dev          # watch mode
npm run build && npm run start:prod
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run start:dev` | Watch mode |
| `npm run start:prod` | Run compiled build |
| `npm run build` | Compile |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests |
| `npm run test:e2e` | E2E tests |
| `npm run db:reset` | Reset database and seed |
| `npm run redis:up` / `redis:down` | Local Redis service |

## License

UNLICENSED — Orion Systems, private product.
