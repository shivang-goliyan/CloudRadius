# CLAUDE.md — Master Instructions for Claude CLI

**Project:** CloudRadius — ISP Billing & Bandwidth Management SaaS
**Read these files IN ORDER before writing any code:**

---

## Required Reading (in order)

1. **PRODUCT_PHILOSOPHY.md** — Understand the soul of the product
2. **RESEARCH.md** — Understand what XceedNet does and how it works
3. **PRD.md** — Full functional requirements (this is your spec)
4. **TECH_STACK.md** — Mandatory technology choices (DO NOT DEVIATE)
5. **BUILD_ORDER.md** — Phase-by-phase build plan (follow this sequence)
6. **CONVENTIONS.md** — Code style and naming conventions
7. **BUILD_PROGRESS.md** — What has been built so far (Phase 0 + Phase 1 complete)

---

## Project Context

This is a multi-tenant SaaS platform for ISP operators. The core technical value is a cloud-hosted RADIUS server that ISP operators connect their MikroTik routers to. The app provides a web dashboard for managing subscribers, plans, billing, and support.

Think of it as "Stripe for ISPs" — ISPs sign up, connect their router, and run their entire business from our dashboard.

---

## Key Technical Decisions

- **Next.js 15 App Router** — full-stack, no separate backend
- **PostgreSQL + Prisma** — single database, multi-tenant with `tenant_id`
- **FreeRADIUS** — separate service, reads from PostgreSQL `radius` schema
- **BullMQ + Redis** — background jobs (notifications, billing cron)
- **shadcn/ui** — UI components (do NOT use Material UI, Ant Design, etc.)

---

## Multi-Tenancy Rules (CRITICAL)

1. Every database table (except `platform_*` tables) MUST have a `tenant_id` column
2. Every Prisma query MUST include `where: { tenantId: currentTenantId }`
3. Implement a Prisma middleware or extension that auto-injects `tenantId` filter
4. The current tenant is resolved from:
   - JWT session token (contains `tenantId`)
   - Subdomain (e.g., `myisp.cloudradius.com`)
5. API routes MUST validate that the requested resource belongs to the current tenant
6. NEVER allow cross-tenant data access

---

## RADIUS Integration Rules

- FreeRADIUS is configured with `rlm_sql_postgresql` to read from the `radius` schema
- When app creates/updates a subscriber, it MUST sync to `radius.radcheck` and `radius.radusergroup`
- When app creates/updates a plan, it MUST sync to `radius.radgroupcheck` and `radius.radgroupreply`
- When app creates/updates a NAS, it MUST sync to `radius.nas`
- RADIUS attributes for MikroTik: `Mikrotik-Rate-Limit = "{rx}/{tx} {burst_rx}/{burst_tx} {threshold_rx}/{threshold_tx} {burst_time}/{burst_time} {priority}"`
- Accounting data flows: FreeRADIUS writes to `radius.radacct` → App reads from it for session/usage data
- CoA (disconnect user): App sends UDP packet to NAS via `radclient` or custom Node.js UDP client

---

## Code Style Quick Reference

- **File naming:** kebab-case (`subscriber-form.tsx`, `billing.service.ts`)
- **Component naming:** PascalCase (`SubscriberForm`, `PlanTable`)
- **Function naming:** camelCase (`getSubscribers`, `createInvoice`)
- **Database columns:** snake_case via Prisma `@map` (TypeScript sees camelCase)
- **API routes:** `/api/[resource]` RESTful (e.g., `/api/subscribers`, `/api/plans`)
- **Server Actions:** Colocated in `actions.ts` files next to page components
- **Zod schemas:** Shared in `src/lib/validations/[entity].ts`
- **Service layer:** Business logic in `src/services/[entity].service.ts`

---

## Common Patterns to Follow

### Data Table Pages
Every list page (subscribers, plans, invoices, etc.) follows this pattern:
1. Server component fetches data with Prisma
2. Passes data to `<DataTable>` client component
3. DataTable uses TanStack Table with: column sorting, search input, filter dropdowns, pagination, row actions (edit, delete, view)
4. "Add New" button opens form (modal or new page)
5. Export button generates CSV/Excel

### Form Pages
1. Use React Hook Form + Zod resolver
2. Server Action for form submission
3. Loading state on submit button
4. Toast notification on success/error
5. Redirect after successful create/edit

### Service Layer
1. All business logic in service files (not in route handlers or actions)
2. Service functions accept typed params and return typed results
3. Service functions handle RADIUS sync when needed
4. Service functions emit events for notifications

---

## What NOT to Do

- ❌ Don't create separate Express/Fastify API server
- ❌ Don't use MongoDB or any NoSQL database
- ❌ Don't write raw SQL (except for RADIUS views)
- ❌ Don't use `any` type in TypeScript
- ❌ Don't skip tenant_id in queries
- ❌ Don't add npm packages not listed in TECH_STACK.md without checking first
- ❌ Don't put business logic in API route handlers (use services)
- ❌ Don't use `useEffect` for data fetching (use Server Components)
- ❌ Don't create custom CSS files (use Tailwind)
- ❌ Don't hardcode tenant-specific values anywhere
