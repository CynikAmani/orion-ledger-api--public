# Orion Ledger API

Orion Ledger is a multi-tenant operations platform for microfinance institutions. It provides platform-level administration, institution workspaces for staff, and customer-facing account and lending workflows. The product is intended to support day-to-day institutional operations, from configuring loan products and reviewing applications through issuing loans, recording repayments, and monitoring portfolio performance.

This repository contains the **NestJS backend and HTTP API**; it is not the web application. The API uses the `/api/v1` route prefix and is organized into domain modules. Contributor conventions are documented in [`CONTEXT_PRIMER.txt`](./CONTEXT_PRIMER.txt).

## Capabilities

| Area | Implemented capabilities |
| --- | --- |
| Institutions and tenancy | Institution onboarding and profiles, tenant-scoped staff roles, branding, subscriptions, and institution-specific loan settings. Platform customers are distinct from tenant staff and can interact with multiple institutions. |
| Identity and access | Password sign-in, JWT access and refresh sessions, email PIN-based MFA, Google OAuth, password recovery, account access, and account lifecycle controls. |
| Authorization | Platform- and tenant-scoped roles with permission assignments. Controllers declare granular permissions that are checked by a global permission guard. |
| Lending | Loan product and rate configuration, applications, review and approval, loan issuance and renewal, loan records, status tracking, repayment recording, and customer loan history. |
| Portfolio operations | Tenant loan reports and insights, staff/customer/platform dashboards, period metrics, and an Excel export of tenant loan records. |
| Operational controls | Approval workflows, audit-log queries, in-app notifications, support tickets, tenant content and branding, and subscription administration. |
| Communications and payments | Transactional email delivered through a Redis/BullMQ queue and Brevo; PayChangu integration for online payment flows and webhook settlement. |

The Prisma model includes loan applications, issued loans, repayments, tenant-scoped configurations, users, roles and permissions, audit logs, notifications, subscriptions, and payment transactions. The seed data includes Malawi district reference data; loan application amount settings are expressed in whole MWK units.

## Architecture

The backend is built with NestJS 11 and TypeScript. `AppModule` composes the domain modules and global configuration, validation, throttling, and database access. `CoreModule` provides cross-cutting infrastructure such as authentication and authorization guards, audit event handling, email, notifications, scheduled tasks, storage, request-origin handling, logging, and exception filters.

Controllers handle HTTP concerns and DTO validation; domain services implement business workflows and use Prisma for persistence. Shared infrastructure lives outside the feature modules so that domain modules can remain focused on their responsibilities.

```text
HTTP request
  -> global throttling, authentication, permission, and subscription guards
  -> controller and validated DTO
  -> domain service
  -> Prisma / PostgreSQL
  -> audit events, notifications, queued email, or scheduled work as needed
```

| Component | Responsibility |
| --- | --- |
| NestJS | HTTP application, dependency injection, feature modules, guards, pipes, and scheduled-task integration |
| PostgreSQL and Prisma | Relational persistence and typed data access; Prisma schema declares model relationships, indexes, and uniqueness constraints |
| Redis and BullMQ | Redis-backed email delivery queue |
| Brevo | Provider for transactional email |
| PayChangu | Online payment provider integration |
| Swagger / OpenAPI | API document generation and interactive API UI, controlled by environment configuration |

## Tenancy and authorization

Platform-level users and institution staff have different scopes. In the data model, a user with no `tenantId` is a platform user; a staff user's `tenantId` identifies their exclusive institution membership. Tenant-owned records carry a tenant reference, and domain services and queries scope institution operations to that tenant. Tenant-facing endpoints resolve the caller's membership rather than accepting an arbitrary tenant context; where a tenant selector header is supported, it must agree with the caller's membership.

Authorization is enforced centrally:

- JWT authentication is applied globally unless a route is explicitly public or permits optional authentication.
- A global permission guard checks route-declared permissions against the authenticated user's permission set. Routes without the required declaration fail closed.
- Permission and role records distinguish platform and tenant administration scopes.
- A subscription guard participates in the global request checks for subscription-gated operations.

The application does not configure PostgreSQL row-level security in the Prisma schema; tenant isolation is implemented through the application authorization and tenant-scoped data-access paths.

## Lending, reporting, and accountability

Loan applications are associated with a tenant and applicant. Application workflows snapshot relevant rate, return, and offer values so that later catalog changes do not silently rewrite the terms recorded at application time. Staff can review applications and issue loans; repayment recording validates the loan's tenant and remaining balance, persists repayment and clearance changes in a database transaction, and then dispatches customer notifications and email.

Tenant reports combine portfolio totals with period cash flow, disbursements, application metrics, and borrower activity. Dashboards are provided for platform, institution staff, and customers. Authorized staff can download tenant loan records as an Excel workbook. Scheduled task implementations include loan overdue lifecycle processing and promotion lifecycle synchronization.

Important operations emit audit events that are persisted with actor and request context, tenant, module, action, target, and normalized payload fields. Tenant and platform audit-log endpoints support filtered access to those records. Audit logging supports operational traceability; it does not by itself establish compliance with a particular standard.

## Security and data integrity

- Passwords are hashed with bcrypt. JWT/session logic, global authentication, permission checks, optional MFA, and account lifecycle checks are implemented in the auth modules.
- Email PIN MFA enforces expiry and bounded verification attempts. Google sign-in is implemented through Passport's Google OAuth strategy.
- A global Nest validation pipe transforms DTOs, strips unknown fields, and rejects requests containing non-whitelisted fields. Environment variables are validated with Joi at application startup.
- Helmet, configured CORS origins, and global request throttling are enabled during bootstrap.
- Prisma relations, foreign keys, unique constraints, and indexes encode important ownership and lookup relationships. Transactions are used for coordinated workflows, including repayments and payment settlement; they are not a blanket claim that every workflow is transactional.
- Runtime database access uses `DATABASE_URL`; Prisma CLI schema operations use `DIRECT_URL`. Keep credentials and provider secrets in an untracked environment file or secret manager, not in source control.
- Uploaded media is written under `public/uploads`. Deployments using ephemeral filesystems need a persistence strategy for those files.

## Getting started

### Prerequisites

- Node.js and npm versions compatible with NestJS 11 and Prisma 7
- PostgreSQL
- Docker Compose for the bundled local Redis service, or a separately managed Redis instance
- Google OAuth and Brevo credentials for the corresponding authentication and email flows

The project does not provision PostgreSQL. Configure an owner connection for Prisma CLI operations and an application database role for runtime access. Both database URLs must point to the intended database.

### Install and configure

1. Install dependencies (the `postinstall` script generates the Prisma client):

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and replace its placeholders with values for your local environment. For PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Configure the variables used by the app and tooling:

   | Purpose | Variables |
   | --- | --- |
   | Runtime and database | `NODE_ENV`, `PORT`, `PLATFORM_NAME`, `DATABASE_URL`, `DIRECT_URL` |
   | Authentication | `JWT_SECRET`, `JWT_EXPIRATION_TIME`; `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` when using Google OAuth |
   | Bootstrap account | Set `INITIAL_ADMIN_PASSWORD` before seeding the initial platform administrator |
   | Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_USERNAME`, `REDIS_TLS` |
   | Email and browser origins | `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `FRONTEND_BASE_URL`, `ALLOWED_ORIGINS` |
   | API docs and public URLs | `SWAGGER_ENABLED`, `SWAGGER_PATH`, and optionally `API_PUBLIC_BASE_URL` |
   | PayChangu | `PAYCHANGU_MODE` and the matching test or live keys/webhook secret when enabling payment flows |

   `DATABASE_URL` is used by NestJS and the seed script. `DIRECT_URL` is used by Prisma CLI schema operations and by the database-grant script. The application validates its required runtime variables at startup; see [`env.validation.ts`](./src/core/config/env.validation.ts), [`prisma.config.ts`](./prisma.config.ts), and [`.env.example`](./.env.example) for the concrete names and defaults. Set `INITIAL_ADMIN_PASSWORD` explicitly; do not rely on the seed's built-in fallback.

### Database setup

The checked-in Prisma workflow uses `prisma db push`; there is no checked-in migration history. For a new or intentionally schema-synchronized database, run:

```sh
npm run db:push
npm run db:grant
npm run db:seed
```

`db:push` applies the Prisma schema using `DIRECT_URL`; `db:grant` grants the runtime role represented by `DATABASE_URL` the required DML access; `db:seed` creates reference data, permission and role records, and the initial platform administrator. Ensure the referenced PostgreSQL roles already exist and that the owner connection can grant the required privileges.

**Warning:** `npm run db:reset` runs `prisma db push --force-reset` before granting access and seeding. It drops existing database data and should only be used for a database that can safely be reset.

### Redis and application startup

For local Redis, configure `REDIS_PASSWORD` in `.env`, then start the Compose service:

```sh
npm run redis:up
```

The Compose file starts Redis 7 with persistent Docker volume storage. Set `REDIS_HOST` and `REDIS_PORT` to match the Redis endpoint available to the API process. To stop the local service:

```sh
npm run redis:down
```

Start the API in watch mode:

```sh
npm run start:dev
```

The default application port is `3000`; `PORT` can override it. The checked-in `.env.example` supplies its own example port.

## API documentation

Swagger is configured by `SWAGGER_ENABLED` and `SWAGGER_PATH`. It is enabled by default outside production and disabled by default in production. When enabled, open:

```text
http://localhost:<PORT>/<SWAGGER_PATH>
```

`SWAGGER_PATH` is required and validated as a custom path of at least 12 characters; common defaults such as `docs` and `swagger` are rejected. The Swagger UI supports bearer-token authorization for protected endpoints.

## Project structure

| Directory or file | Responsibility |
| --- | --- |
| `src/main.ts` | Application bootstrap, `/api` prefix, URI versioning, CORS, Helmet, static mounts, and Swagger setup |
| `src/app.module.ts` | Application-wide configuration, throttling, validation, database, and feature-module composition |
| `src/core/` | Shared database, configuration, audit, auth infrastructure, email, notifications, scheduling, storage, and throttling |
| `src/common/` | Shared HTTP exceptions, filters, interceptors, and formatting utilities |
| `src/modules/` | Domain APIs, including auth, tenants, users, roles, loans, payments, subscriptions, approvals, support, and dashboards |
| `prisma/` | Prisma schema, seed data, and database role-grant script |
| `public/` | Email assets and local upload directories |
| `test/` | End-to-end Jest configuration and tests |

## Testing, build, and deployment

| Command | Purpose |
| --- | --- |
| `npm test` | Run unit tests under `src/` with Jest |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:cov` | Run unit tests and collect coverage |
| `npm run test:e2e` | Run end-to-end tests using `test/jest-e2e.json` |
| `npm run build` | Compile the NestJS application |
| `npm run start:prod` | Start the compiled application from `dist/main` |
| `npm run lint` | Run ESLint; this script includes `--fix` and may modify source files |

Build for production with:

```sh
npm run build
npm run start:prod
```

The only checked-in Compose service is Redis. The repository does not include an API or PostgreSQL container definition, a deployment manifest, or a CI/CD workflow. Production hosting, PostgreSQL provisioning, secret delivery, persistent upload storage, and operational monitoring therefore need to be supplied by the deployment environment.

## License

The package is marked `UNLICENSED`; no open-source license is declared.
