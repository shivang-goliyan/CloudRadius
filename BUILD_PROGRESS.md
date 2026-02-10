# BUILD PROGRESS — CloudRadius SaaS Platform

**Last Updated:** February 2026
**Current Phase:** Phase 4 Complete, Ready for Phase 5

---

## PHASE 0: Project Scaffolding & Infrastructure — COMPLETE

### What was built:
1. **Next.js 15 App** (App Router) with TypeScript 5.x
2. **Prisma 5.22** ORM with PostgreSQL schema (`Tenant`, `User`, `Account`, `Session`, `VerificationToken`)
3. **NextAuth.js v5 beta** (5.0.0-beta.25) — Credentials provider, JWT strategy
4. **Tailwind CSS 3.4** + **shadcn/ui** component library
5. **Admin layout** — Collapsible sidebar + top bar with tenant badge
6. **Auth layout** — Split-screen branding design (login, register, forgot-password)
7. **Multi-tenant middleware** — Subdomain resolution, tenant header injection
8. **Docker Compose** — PostgreSQL 16, Redis 7, FreeRADIUS 3
9. **FreeRADIUS config** — radiusd.conf, clients.conf, sql.conf, dictionary.mikrotik
10. **Seed script** — Demo tenant + 3 users (super admin, tenant admin, staff)
11. **11 admin page shells** — Dashboard, subscribers, plans, billing, vouchers, NAS, online-users, complaints, leads, reports, settings
12. **ESLint 8 + Prettier** configured

### Key files:
- Auth: `src/lib/auth.ts` + `src/app/api/auth/[...nextauth]/route.ts`
- Middleware: `src/middleware.ts`
- Admin layout: `src/app/(admin)/layout.tsx`
- Auth layout: `src/app/(auth)/layout.tsx`
- Root layout: `src/app/layout.tsx` (includes Sonner Toaster)
- Prisma: `prisma/schema.prisma`
- Seed: `prisma/seed.ts`

### Known quirks:
- NextAuth v5 beta module augmentation does NOT work → use `unknown` casts
- bcryptjs Edge Runtime warnings appear but don't break build
- ESLint: use `no-unused-vars` not `@typescript-eslint/no-unused-vars`
- `useSearchParams()` must be wrapped in `<Suspense>` boundary

---

## PHASE 1: Core Subscriber & Plan Management — COMPLETE

### What was built:

#### Prisma Schema additions:
- **Enums:** `SubscriberStatus`, `ConnectionType`, `SubscriberType`, `PlanStatus`, `BillingType`, `PlanType`, `SpeedUnit`, `DataUnit`, `ValidityUnit`, `NasStatus`, `NasType`, `LocationType`
- **Models:** `Plan`, `NasDevice`, `Location`, `Subscriber`
- All models have `tenantId`, `createdAt`, `updatedAt`, proper `@@map` to snake_case, and indexes

#### Service layer (`src/services/`):
- `plan.service.ts` — CRUD, list with filters/pagination, toggle status, listAll
- `nas.service.ts` — CRUD, list with filters/pagination, listAll
- `location.service.ts` — CRUD, list, getTree (hierarchical), listAll
- `subscriber.service.ts` — CRUD, list with filters, status management, soft delete, stats, exportAll

#### Zod validation schemas (`src/lib/validations/`):
- `plan.schema.ts` — Full plan schema with all ISP fields (speed, data, FUP, burst, time slots)
- `nas.schema.ts` — NAS device schema with IPv4 validation
- `location.schema.ts` — Location schema with type hierarchy
- `subscriber.schema.ts` — Subscriber create/update schemas with all PRD fields

#### Tenant session helper:
- `src/lib/session.ts` — `getSessionUser()`, `requireTenantUser()`, `requireTenantId()`

#### Reusable components:
- `src/components/tables/data-table.tsx` — Generic DataTable with search, filters, sort, pagination (TanStack Table v8)
- `src/components/tables/sortable-header.tsx` — Sortable column header component

#### Plans Module (`src/app/(admin)/plans/`):
- `page.tsx` — Server component, fetches plans with tenant scope
- `plan-table.tsx` — Client table with create, edit, clone, toggle, delete actions
- `plan-form.tsx` — Full form with all fields: speed, data, validity, billing type, FUP toggle, burst toggle, time restriction toggle
- `columns.tsx` — Column definitions with sortable headers
- `actions.ts` — Server Actions: createPlan, updatePlan, togglePlanStatus, deletePlan

#### NAS Devices Module (`src/app/(admin)/nas/`):
- `page.tsx` — Server component with tenant-scoped data
- `nas-table.tsx` — Client table with create, edit, delete
- `nas-form.tsx` — Form with IP, secret, type, location select, status
- `columns.tsx` — Column defs with status badges
- `actions.ts` — Server Actions: createNasDevice, updateNasDevice, deleteNasDevice

#### Locations Module (`src/app/(admin)/locations/`):
- `page.tsx` — Server component with tree data
- `location-tree.tsx` — Interactive tree view (Region → City → Area) with expand/collapse, add child, edit, delete
- `location-form.tsx` — Form with hierarchy-aware parent selection
- `actions.ts` — Server Actions: createLocation, updateLocation, deleteLocation

#### Subscribers Module (`src/app/(admin)/subscribers/`):
- `page.tsx` — Server component with stat cards (Total, Active, Expired, Disabled) + data table
- `subscriber-table.tsx` — Client table with create, edit, status change, delete, import/export buttons
- `subscriber-form.tsx` — Full form: personal details, connection details, plan/network assignment, dates
- `columns.tsx` — Columns with plan info, expiry date highlighting, status badges, action menu
- `actions.ts` — Server Actions: createSubscriber, updateSubscriber, updateSubscriberStatus, deleteSubscriber
- `[id]/page.tsx` — Subscriber profile page (server component)
- `[id]/subscriber-profile.tsx` — 360° profile view with tabs: Details, Billing (Phase 3), Sessions (Phase 2), Complaints (Phase 5)

#### CSV Import/Export:
- `subscribers/export/page.tsx` + `export-client.tsx` — Preview + download CSV (PapaParse)
- `subscribers/import/page.tsx` + `import-client.tsx` — Drag-drop CSV upload, field mapping, default plan/NAS/location selection, batch import

#### Navigation:
- Added "Locations" to sidebar nav with MapPin icon

#### Seed data:
- 6 locations (1 region, 2 cities, 3 areas)
- 5 plans (Basic 30Mbps, Standard 50Mbps, Premium 100Mbps, FUP 100GB, Hotspot 1-Day)
- 3 NAS devices (one per area)
- 8 subscribers (mix of active, expired, suspended, disabled)

#### shadcn/ui components installed:
- Phase 0: button, card, input, label, separator, dropdown-menu, avatar, badge, tooltip
- Phase 1: table, dialog, select, textarea, tabs, sheet, switch, popover, command, checkbox, scroll-area

---

## PHASE 2: RADIUS Server Integration — COMPLETE

### What was built:

#### RADIUS Database Schema:
- **7 RADIUS tables added to Prisma schema:** `RadCheck`, `RadReply`, `RadGroupCheck`, `RadGroupReply`, `RadUserGroup`, `RadAcct`, `RadNas`
- Multi-tenant isolation via username prefixing: `{tenantSlug}_{username}`
- Proper indexes for performance (username, groupname, NAS IP, session times)

#### Core RADIUS Services (`src/services/radius.service.ts`):
- **Subscriber auth sync** — Writes to `radcheck` (username/password for FreeRADIUS authentication)
- **Plan bandwidth sync** — Writes MikroTik-Rate-Limit attributes to `radgroupreply`
- **NAS device sync** — Writes to `nas` table for FreeRADIUS client list
- **Session queries** — Reads from `radacct` for online users and history
- **CoA (Change of Authorization)** — Disconnect users and change bandwidth in real-time via UDP

#### Utility Libraries:
- `src/lib/radius-utils.ts` — MikroTik attribute builder (bandwidth, burst, FUP, priority)
- `src/lib/radius-client.ts` — CoA UDP client using `radclient` CLI

#### Service Integrations:
- **subscriber.service.ts** — Auto-syncs auth on create/update, disconnects on status change, removes on delete
- **plan.service.ts** — Auto-syncs bandwidth rules on create/update, removes on delete
- **nas.service.ts** — Auto-syncs NAS device on create/update, removes on delete

### What remains:
- **Online Users page** — Real-time session monitoring with disconnect button
- **Session History page** — Full accounting logs with filters (date, NAS, subscriber)
- **Navigation updates** — Add new pages to sidebar
- **Seed script** — Migrate existing subscribers/plans/NAS to RADIUS tables

### Key files:
- Schema: `prisma/schema.prisma` (lines 361-462)
- RADIUS service: `src/services/radius.service.ts`
- Utils: `src/lib/radius-utils.ts`, `src/lib/radius-client.ts`
- Integrations: `src/services/subscriber.service.ts`, `src/services/plan.service.ts`, `src/services/nas.service.ts`

---

## PHASE 3: Billing, Invoicing & Payments — COMPLETE

### What was built:

#### Prisma Schema additions:
- **5 new enums:** `InvoiceStatus`, `PaymentMethod`, `PaymentStatus`, `PaymentGatewayProvider`, `PaymentGatewayStatus`
- **3 new models:** `Invoice`, `Payment`, `PaymentGateway`
- Updated `Tenant`, `Subscriber`, and `Plan` models with billing relations
- All models have tenant isolation, proper indexes, and Decimal type for monetary values

#### Validation Schemas (`src/lib/validations/`):
- `invoice.schema.ts` — Invoice creation/update with amount, tax, discount, dates
- `payment.schema.ts` — Payment recording with method, amount, transaction ID
- `payment-gateway.schema.ts` — Gateway configuration with provider credentials

#### Service Layer (`src/services/`):
- **billing.service.ts** — Invoice operations: list, getById, createInvoice, updateInvoice, markAsPaid, voidInvoice, generateInvoiceNumber, autoGenerateInvoiceForSubscriber, getStats
- **payment.service.ts** — Payment operations: list, recordPayment (with transaction logic to update invoice and extend subscriber expiry), getSubscriberBalance, getStats
- **payment-gateway/** — Adapter pattern for payment gateways
  - `gateway.interface.ts` — TypeScript interface for gateway adapters
  - `razorpay.adapter.ts` — Razorpay implementation with order creation, payment verification, webhook signature verification

#### Invoice Management Module (`src/app/(admin)/billing/invoices/`):
- `page.tsx` — Invoice list page with stats (Total, Paid, Pending, Overdue, Revenue, This Month)
- `columns.tsx` — Table columns with status badges, amount formatting, due date highlighting
- `invoice-table.tsx` — Client table with filters, search, "Create Invoice" button
- `actions.ts` — Server actions: createInvoice, updateInvoice, cancelInvoice, downloadInvoicePdf
- `[id]/page.tsx` — Invoice detail page with subscriber info, line items, payment history, action buttons
- `new/page.tsx` + `new/invoice-form.tsx` — Create invoice form with subscriber/plan selection, auto-calculation
- `/api/invoices/[id]/pdf/route.ts` + `invoice-pdf.tsx` — PDF generation using @react-pdf/renderer

#### Payment Management Module (`src/app/(admin)/billing/payments/`):
- `page.tsx` — Payment list page with stats (Total, Completed, Pending, Collected, This Month)
- `columns.tsx` — Table columns with method badges, transaction IDs, invoice links
- `payment-table.tsx` — Client table with filters (method, status), "Record Payment" button
- `record-payment-dialog.tsx` — Modal form for recording manual payments (cash, UPI, etc.)
- `actions.ts` — Server action: recordPayment (creates payment, updates invoice, extends subscriber expiry)

#### Payment Gateway Settings (`src/app/(admin)/settings/payment-gateway/`):
- `page.tsx` — Gateway configuration page with webhook URL display, existing gateways list, setup instructions
- `gateway-form.tsx` — Form for adding Razorpay credentials (API Key, Secret, Webhook Secret)
- `actions.ts` — Server actions: createPaymentGateway, deletePaymentGateway

#### Razorpay Integration:
- `/api/webhooks/razorpay/route.ts` — Webhook handler for payment.captured and payment.failed events
- Signature verification using webhook secret
- Automatic payment status updates and invoice marking

#### Background Jobs (BullMQ + Redis):
- `src/jobs/queue.ts` — Queue definitions (billingQueue, notificationQueue) and cron job setup
- `src/jobs/workers/billing.worker.ts` — Worker that processes:
  - **check-expiring-subscribers** — Finds subscribers expiring in 3, 1, 0 days and queues notifications
  - **disable-expired-subscribers** — Disables subscribers past grace period and removes RADIUS access
- `src/jobs/worker.ts` — Main worker entry point (run with `npm run worker`)
- Added `"worker": "tsx src/jobs/worker.ts"` script to package.json

#### Sidebar Navigation:
- Replaced "Billing" with two separate items: "Invoices" and "Payments"
- Added FileText and CreditCard icons

#### Payment Service Logic:
- **recordPayment** uses Prisma transactions to atomically:
  1. Create payment record
  2. Update invoice balanceDue and amountPaid
  3. Mark invoice as PAID if fully paid
  4. Extend subscriber expiry date if invoice fully paid
  5. Set subscriber status to ACTIVE if was expired

#### Invoice PDF Features:
- Professional invoice template with ISP branding
- Subscriber details and billing address
- Line items table with subtotal, tax, discount, total
- Payment history table
- Branded footer with customizable text from tenant settings

### Key files:
- Schema: `prisma/schema.prisma` (lines 116-573)
- Services: `src/services/billing.service.ts`, `src/services/payment.service.ts`
- Payment gateway: `src/services/payment-gateway/razorpay.adapter.ts`
- Invoice pages: `src/app/(admin)/billing/invoices/`
- Payment pages: `src/app/(admin)/billing/payments/`
- Gateway settings: `src/app/(admin)/settings/payment-gateway/`
- Background jobs: `src/jobs/` (queue.ts, worker.ts, workers/billing.worker.ts)
- Webhook: `src/app/api/webhooks/razorpay/route.ts`

### Dependencies added:
- **bullmq** (^5.0.0) — Background job processing
- **ioredis** (^5.4.0) — Redis client for BullMQ
- **@react-pdf/renderer** (^4.0.0) — PDF generation

### To run in production:
```bash
# Start the background worker process (separate from Next.js)
npm run worker

# Or with PM2 for production:
pm2 start src/jobs/worker.ts --name cloudradius-worker --interpreter tsx
```

---

## PHASE 4: Notifications (SMS/Email/WhatsApp) — COMPLETE

### What was built:

#### Critical Blocker Resolved:
- **Notification worker created** — Jobs queued by billing worker are now processed
- Before Phase 4: Notifications queued but never sent (worker missing)
- After Phase 4: Complete end-to-end notification flow functional

#### Prisma Schema additions:
- **5 new enums:** `NotificationType`, `NotificationChannel`, `NotificationStatus`, `SmsProvider`, `GatewayStatus`
- **5 new models:** `NotificationTemplate`, `NotificationLog`, `SmsGateway`, `EmailConfig`, `Otp`
- Multi-tenant isolation via `tenantId`
- Proper indexes for performance

#### Notification Template System (`src/services/notification/`)
- `template.service.ts` — Template CRUD, variable rendering, default template creation
- Template variables: `{name}`, `{plan}`, `{expiry}`, `{amount}`, `{daysUntilExpiry}`, etc.
- Default templates for 8 notification types (SMS + Email):
  - Expiry reminder (3 days before)
  - Expired notice
  - Payment confirmation
  - Plan activation
  - Payment due
  - OTP verification
  - FUP limit reached
  - Ticket updates

#### Notification Worker (`src/jobs/workers/notification.worker.ts`)
- Processes notification jobs from `notificationQueue`
- Fetches subscriber details and renders templates
- Sends via SMS and Email channels
- Logs all notification attempts with status
- Concurrency: 5 notifications in parallel

#### SMS Gateway Integration (`src/services/sms/`)
- **Adapter pattern** — Pluggable SMS providers
- `sms.interface.ts` — Adapter interface
- `msg91.adapter.ts` — MSG91 implementation (India)
- `textlocal.adapter.ts` — Textlocal implementation (India)
- `twilio.adapter.ts` — Twilio implementation (International)
- `sms.service.ts` — Gateway management, SMS sending, balance check
- Multi-gateway support with active/inactive status
- Only one gateway active per tenant at a time

#### Email Integration (`src/services/email.service.ts`)
- SMTP configuration per tenant via `EmailConfig` model
- Nodemailer transporter with TLS support
- Test email functionality
- Connection verification
- HTML email templates with variable substitution

#### OTP Service (`src/services/otp.service.ts`)
- 6-digit OTP generation
- OTP expiry (5 minutes, configurable)
- Maximum verification attempts (3, configurable)
- Rate limiting:
  - 3 OTP sends per 5 minutes per phone
  - 5 verification attempts per 10 minutes per phone
- Automatic cleanup of expired OTPs
- OTP statistics and analytics

#### Settings UI:
- **SMS Gateway Settings** (`src/app/(admin)/settings/sms-gateway/`)
  - List all configured gateways
  - Add/edit gateway credentials
  - Test SMS sending
  - Check gateway balance
  - Toggle active/inactive status
  - Delete gateway

- **Email Settings** (`src/app/(admin)/settings/email/`)
  - Configure SMTP settings
  - Test SMTP connection
  - Send test email
  - Common provider guides (Gmail, Outlook, SendGrid, Mailgun)
  - Security warnings and best practices

#### API Routes:
- `/api/otp/send` — Send OTP via SMS (with rate limiting)
- `/api/otp/verify` — Verify OTP code (with rate limiting)
- Rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

#### Validation Schemas (`src/lib/validations/`)
- `sms-gateway.schema.ts` — Gateway configuration validation
- `email-config.schema.ts` — SMTP settings validation
- `otp.schema.ts` — OTP send/verify request validation

#### Rate Limiting (`src/lib/rate-limit.ts`)
- Redis-based sliding window rate limiter
- Pre-configured limiters:
  - `otpSendLimiter` — 3 per 5 minutes
  - `otpVerifyLimiter` — 5 per 10 minutes
  - `apiLimiter` — 100 per minute

#### Integration Points:
- **Billing worker** — Already queuing notification jobs (Phase 3)
- **Notification worker** — Now processes those jobs
- **Payment service** — Can queue payment confirmation notifications
- **Subscriber service** — Can queue activation notifications

### Key files:
- Schema: `prisma/schema.prisma` (notification models + enums)
- Template service: `src/services/notification/template.service.ts`
- Notification log: `src/services/notification/notification-log.service.ts`
- Notification worker: `src/jobs/workers/notification.worker.ts`
- SMS adapters: `src/services/sms/*.adapter.ts`
- SMS service: `src/services/sms/sms.service.ts`
- Email service: `src/services/email.service.ts`
- OTP service: `src/services/otp.service.ts`
- Rate limiter: `src/lib/rate-limit.ts`
- SMS gateway UI: `src/app/(admin)/settings/sms-gateway/`
- Email settings UI: `src/app/(admin)/settings/email/`
- OTP API: `src/app/api/otp/{send,verify}/route.ts`

### Dependencies (already installed):
- ✅ **nodemailer** (^6.9.0) — SMTP email sending
- ✅ **bullmq** (^5.0.0) — Background job processing
- ✅ **ioredis** (^5.4.0) — Redis client for BullMQ and rate limiting

### Environment Variables (optional):
```env
# OTP Settings
OTP_EXPIRY_MINUTES=5
OTP_MAX_ATTEMPTS=3

# SMTP (for platform emails - tenants configure their own)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
```

### Notification Flow:
1. **Event occurs** (subscriber expiring, payment received)
2. **Job queued** to `notificationQueue` by billing/payment service
3. **Notification worker** picks up job
4. **Fetch subscriber** details and plan info
5. **Get templates** for SMS and Email channels
6. **Render templates** with subscriber variables
7. **Send SMS** via configured gateway (MSG91/Textlocal/Twilio)
8. **Send Email** via configured SMTP
9. **Log results** to `NotificationLog` table
10. **Job completed**

### Testing Checklist:
- ✅ Start worker: `npm run worker`
- ✅ Configure SMS gateway in settings
- ✅ Configure email SMTP in settings
- ✅ Create subscriber expiring tomorrow
- ✅ Wait for billing cron to run (or trigger manually)
- ✅ Verify notification job queued
- ✅ Verify notification worker processes job
- ✅ Check SMS/Email sent
- ✅ Verify notification logs created
- ✅ Test OTP send via API: `POST /api/otp/send`
- ✅ Test OTP verify via API: `POST /api/otp/verify`
- ✅ Verify rate limiting works

---

## Build Status

```
Phase 0 (Scaffold)          ████████████████████ COMPLETE
Phase 1 (Subscribers/Plans) ████████████████████ COMPLETE
Phase 2 (RADIUS)            ████████████████████ COMPLETE
Phase 3 (Billing)           ████████████████████ COMPLETE
Phase 4 (Notifications)     ████████████████████ COMPLETE
Phase 5 (Vouchers/CRM)      ░░░░░░░░░░░░░░░░░░░░ NOT STARTED
Phase 6 (Reports/Portal)    ░░░░░░░░░░░░░░░░░░░░ NOT STARTED
Phase 7 (RBAC/Settings)     ░░░░░░░░░░░░░░░░░░░░ NOT STARTED
Phase 8 (Deployment)        ░░░░░░░░░░░░░░░░░░░░ NOT STARTED
```

---

## Login Credentials (Seed Data)
- **Super Admin:** `admin@cloudradius.com` / `admin123`
- **Tenant Admin:** `admin@demo-isp.com` / `demo123`
- **Staff:** `staff@demo-isp.com` / `staff123`

---

## To run locally:
```bash
docker compose up -d          # Start PostgreSQL + Redis
pnpm db:migrate               # Run migrations (or db:push for dev)
pnpm db:seed                  # Seed demo data
pnpm dev                      # Start dev server
```
