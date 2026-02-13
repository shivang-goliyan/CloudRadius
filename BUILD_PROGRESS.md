# BUILD PROGRESS — CloudRadius SaaS Platform

**Last Updated:** February 2026
**Current Phase:** Phase 8 In Progress (Deployment)

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

## PHASE 5: Vouchers, Hotspot Portal & CRM — COMPLETE

### What was built:

#### Prisma Schema additions:
- **6 new enums:** `VoucherStatus`, `TicketStatus`, `TicketPriority`, `TicketCategory`, `LeadStatus`, `LeadSource`
- **6 new models:** `VoucherBatch`, `Voucher`, `Ticket`, `TicketComment`, `Lead`, `CaptivePortalConfig`
- Updated `Tenant`, `User`, `Subscriber`, `Plan`, `Location` models with Phase 5 relations
- Multi-tenant isolation via `tenantId` on all models

#### Voucher System (`src/services/voucher.service.ts`)
- **Batch generation** — Create batches of unique alphanumeric voucher codes
- **Code generation** — Cryptographically random, avoids confusing chars (0/O/1/I)
- **Voucher lifecycle** — Generated → Sold → Redeemed → Expired
- **Batch management** — List, delete, export CSV
- **Print-ready cards** — Grid layout with plan details, voucher code, pricing
- **Redemption** — Validates code, creates RADIUS entries, assigns plan
- **Stats** — Total, generated, sold, redeemed, expired counts

#### Voucher UI (`src/app/(admin)/vouchers/`)
- `page.tsx` — Stats cards + batch list view
- `voucher-table.tsx` — Batch cards with status breakdown, actions (view, print, export CSV, delete)
- `generate-form.tsx` — Dialog form to create batch (plan, quantity, prefix, code length, validity)
- `[batchId]/page.tsx` — Voucher list within batch
- `[batchId]/voucher-list.tsx` — Table with select, mark as sold, search
- `[batchId]/print/page.tsx` — Print-ready voucher cards page
- `[batchId]/print/printable-cards.tsx` — Printable grid cards with plan info and voucher code
- `actions.ts` — Server actions: generateVoucherBatch, markVouchersSold, deleteVoucherBatch, exportCsv

#### CRM & Helpdesk (`src/services/ticket.service.ts`)
- **Ticket CRUD** — Create, update, delete with tenant isolation
- **Auto ticket numbering** — TKT-001, TKT-002, etc.
- **Status transitions** — Open → Assigned → In Progress → Resolved → Closed
- **Comment threads** — Public comments and internal notes
- **Assignment** — Assign/reassign to staff members
- **Priority levels** — Low, Medium, High, Critical
- **Categories** — Connectivity, Billing, Speed, Installation, Other
- **Stats** — Counts by status, open ticket count for sidebar badge

#### Ticket UI (`src/app/(admin)/complaints/`)
- `page.tsx` — Stats cards (6 statuses) + ticket list
- `ticket-table.tsx` — Filterable ticket list with status/priority filters, quick status actions
- `ticket-form.tsx` — Dialog form to create ticket with subscriber/assignee selection
- `[id]/page.tsx` — Ticket detail page
- `[id]/ticket-detail.tsx` — Full ticket view with:
  - Comment thread (public + internal notes with different styling)
  - Sidebar: status/priority/assignee controls, subscriber info card
  - Add comment with internal note toggle
- `actions.ts` — Server actions: createTicket, updateTicket, addComment, deleteTicket

#### Lead Management (`src/services/lead.service.ts`)
- **Lead CRUD** — Create, update, delete with tenant isolation
- **Lead pipeline** — New → Contacted → Site Survey → Installation Scheduled → Converted → Lost
- **Convert to subscriber** — Pre-fills subscriber form with lead data
- **Source tracking** — Walk In, Referral, Website, Phone, Social Media, Other
- **Stats** — Counts by status, conversion rate

#### Lead UI (`src/app/(admin)/leads/`)
- `page.tsx` — Stats cards (7 metrics including conversion rate) + lead table
- `lead-table.tsx` — Table with search, status filter, quick "Next" advancement button, edit, delete
- `lead-form.tsx` — Dialog form for add/edit lead with location selection
- `actions.ts` — Server actions: createLead, updateLead, updateLeadStatus, deleteLead, markLeadConverted

#### Captive Portal — Public Login Page
- `src/app/hotspot/[tenantSlug]/page.tsx` — Public-facing hotspot login page
- `src/app/hotspot/[tenantSlug]/login-form.tsx` — Mobile-first login form with:
  - **Username/Password** — RADIUS subscriber authentication
  - **OTP via SMS** — Send and verify OTP for phone-based login
  - **Voucher Code** — Instant access with pre-purchased voucher
  - Tab switching between login methods
  - Terms of Service acceptance
  - Post-login redirect
  - Tenant-branded (logo, colors, background, welcome message)

#### Captive Portal — Admin Settings
- `src/app/(admin)/settings/captive-portal/page.tsx` — Portal configuration page with portal URL display
- `src/app/(admin)/settings/captive-portal/portal-config-form.tsx` — Full settings form:
  - Enable/disable toggle with preview link
  - Branding: logo URL, background image URL, primary color picker
  - Welcome title and message
  - Login method toggles (Username/Password, OTP, Voucher)
  - Terms of Service text area
  - Post-login redirect URL
- `src/app/(admin)/settings/captive-portal/actions.ts` — Server action: saveCaptivePortalConfig

#### Captive Portal Service (`src/services/captive-portal.service.ts`)
- Get config by tenant slug (for public page)
- Get/upsert config by tenant ID (for admin settings)
- Authenticate via username/password (bcrypt compare against subscriber)
- Authenticate via voucher code (redeem + create RADIUS entries)

#### Hotspot API Routes
- `/api/hotspot/login` — POST: Authenticate with username/password or voucher code
- `/api/hotspot/otp/send` — POST: Send OTP for hotspot login
- `/api/hotspot/otp/verify` — POST: Verify OTP for hotspot login

#### RADIUS Integration for Vouchers
- On voucher redemption: creates `radcheck` entry (voucher code as password)
- Maps voucher user to plan group in `radusergroup` for bandwidth enforcement
- MikroTik authenticates voucher users the same way as regular subscribers

#### Validation Schemas (`src/lib/validations/`)
- `voucher.schema.ts` — Batch generation and mark-sold validation
- `ticket.schema.ts` — Create ticket, update ticket, add comment validation
- `lead.schema.ts` — Lead create/update validation

#### Sidebar Navigation Updates
- Added "Captive Portal" entry with Globe icon under Settings
- Vouchers, Complaints, Leads entries already existed from Phase 0 scaffolding

#### Seed Data
- 1 voucher batch (BATCH-001) with 20 vouchers: 15 generated, 3 sold, 2 redeemed
- 5 tickets with varied statuses and priorities, with comments on first ticket
- 5 leads across all pipeline stages (new, contacted, site survey, scheduled, lost)
- Captive portal config enabled for demo-isp tenant

### Key files:
- Schema: `prisma/schema.prisma` (Phase 5 enums + 6 new models)
- Voucher service: `src/services/voucher.service.ts`
- Ticket service: `src/services/ticket.service.ts`
- Lead service: `src/services/lead.service.ts`
- Portal service: `src/services/captive-portal.service.ts`
- Voucher UI: `src/app/(admin)/vouchers/`
- Ticket UI: `src/app/(admin)/complaints/`
- Lead UI: `src/app/(admin)/leads/`
- Portal settings: `src/app/(admin)/settings/captive-portal/`
- Hotspot login: `src/app/hotspot/[tenantSlug]/`
- Hotspot API: `src/app/api/hotspot/`
- Validations: `src/lib/validations/{voucher,ticket,lead}.schema.ts`
- Seed: `prisma/seed.ts` (updated with Phase 5 data)

### Captive Portal URL:
```
/hotspot/{tenant-slug}
Example: /hotspot/demo-isp
```

### Dependencies (already installed):
No new dependencies needed. Uses existing bcryptjs, prisma, and Next.js features.

---

## PHASE 6: Reports, Dashboard & Subscriber Portal — COMPLETE

### What was built:

#### 1. Admin Dashboard (default landing page)
- **8 Real KPI Cards:** Total subscribers, active, expired, new this month, MRR, collections this month, outstanding amount, online now (from radAcct)
- **4 Recharts Charts:** Subscriber growth (LineChart, 12 months), Revenue trend (BarChart, 12 months), Plan distribution (PieChart/donut), Area-wise subscribers (horizontal BarChart)
- **Recent Activity Feed:** Mixed feed of latest subscribers, payments, invoices, tickets — color-coded icons, relative timestamps
- **Quick Action Buttons:** Add Subscriber, Record Payment

#### 2. Reports Module (10 report types)
- **Shared Components:** `ReportFilters` (date range, status, plan, location, NAS, method filters + export buttons), `ReportTable` (generic paginated table with column definitions), `export-utils.ts` (CSV via PapaParse, Excel via SheetJS, print)
- **Report Types:**
  1. **Subscriber Report** — List by status, plan, area, NAS, date range
  2. **Billing Report** — Invoices with summary cards (total invoiced, paid, outstanding)
  3. **Collection Report** — Payments with by-method breakdown summary
  4. **Revenue Report** — Revenue by plan with Recharts BarChart visualization
  5. **Expiry Report** — Subscribers expiring in next N days with color-coded urgency badges
  6. **Churn Report** — Expired subscribers with churn rate, churned, and active summary cards
  7. **Session Report** — RadAcct sessions with total upload/download/session time summaries
  8. **Usage Report** — Per-subscriber data consumption from radAcct
  9. **Voucher Report** — Voucher status counts (generated/sold/redeemed/expired)
  10. **NAS Report** — NAS devices with subscriber counts
- All reports support: pagination, CSV export, Excel export, print

#### 3. Subscriber Self-Service Portal (mobile-first)
- **Route Group:** `(portal)/portal/` with own layout, separate from admin
- **Auth:** JWT-based (jose library), HTTP-only `portal-token` cookie, separate from admin NextAuth
- **Login:** Username/phone + password, bcrypt verification, gradient UI
- **Portal Dashboard:** Plan info, speed, data usage, expiry countdown, balance due
- **Portal Billing:** Invoice list with status badges and amounts
- **Portal Complaints:** Ticket list + new complaint dialog with auto-generated ticket numbers
- **Portal Profile:** Edit name, phone, email, address
- **Mobile-First Layout:** Bottom tab navigation, max-w-lg container, responsive design

#### 4. API Routes
- `POST /api/portal/login` — Subscriber authentication, JWT issuance
- `POST /api/portal/logout` — Cookie deletion
- `POST /api/portal/tickets` — Create support ticket
- `PUT /api/portal/profile` — Update subscriber profile

### Key files:
- Dashboard service: `src/services/dashboard.service.ts`
- Dashboard page: `src/app/(admin)/dashboard/page.tsx`
- Dashboard charts: `src/app/(admin)/dashboard/dashboard-charts.tsx`
- Recent activity: `src/app/(admin)/dashboard/recent-activity.tsx`
- Report service: `src/services/report.service.ts`
- Reports hub: `src/app/(admin)/reports/page.tsx`
- Report shared: `src/app/(admin)/reports/{report-filters,report-table,export-utils}.tsx`
- Report actions: `src/app/(admin)/reports/actions.ts`
- 10 report pages: `src/app/(admin)/reports/{subscribers,billing,collections,revenue,expiry,churn,sessions,usage,vouchers,nas}/`
- Portal service: `src/services/portal.service.ts`
- Portal session: `src/lib/portal-session.ts`
- Portal layout: `src/app/(portal)/layout.tsx`
- Portal auth layout: `src/app/(portal)/portal/(authenticated)/layout.tsx`
- Portal nav: `src/app/(portal)/portal/portal-nav.tsx`
- Portal pages: `src/app/(portal)/portal/(authenticated)/{dashboard,billing,complaints,profile}/`
- Portal login: `src/app/(portal)/portal/login/`
- Portal API: `src/app/api/portal/{login,logout,tickets,profile}/`

### Dependencies (already installed):
No new dependencies needed. Uses existing recharts, xlsx (SheetJS), jose, bcryptjs, date-fns, and Next.js features.

---

## PHASE 7: RBAC, Multi-Location, Settings & Polish — COMPLETE

### What was built:

#### 1. RBAC (Role-Based Access Control)
- **Permission matrix** in `src/lib/rbac.ts` mapping 7 roles to module:action permissions
- **5 operational roles:** Super Admin, Admin (TENANT_ADMIN), Manager, Operator (STAFF), Viewer (COLLECTOR) + Franchise + Subscriber
- **Module permissions:** dashboard, subscribers, plans, billing, payments, vouchers, nas, locations, online_users, sessions, complaints, leads, reports, settings, users, super_admin
- **Action types:** view, create, edit, delete, export with wildcard support (`module:*`, `*`)
- **`authorize()`** function for server actions and API routes — throws on permission denied
- **`hasPermission()`** and **`hasAnyPermission()`** for client-side checks
- **Role-based sidebar navigation** — each role sees only their permitted modules
- **Role labels and badge styling** per role

#### 2. Multi-Location / Franchise Scoping
- **User.locationId** added to Prisma schema — optional foreign key to Location
- **`userService.getLocationScope()`** — recursively gets all child location IDs for franchise/manager scoping
- **Location assignment** in user management — franchise operators see only their area's data
- **User-Location relation** with index on `[tenantId, locationId]`

#### 3. Super Admin Panel
- **Route group:** `(super-admin)/super-admin/` with own layout
- **Layout guard:** redirects non-SUPER_ADMIN users to `/dashboard`
- **Platform Dashboard:** 6 KPI cards (Total Tenants, Active, Trial, Suspended, Total Subscribers, Total Users) + recent tenants table
- **Tenant Management:** full CRUD — list all tenants with subscriber/user counts, create tenant (auto-creates admin user), suspend/activate tenants
- **System Settings:** placeholder page for RADIUS servers, platform billing, global defaults
- **Tenant service:** `src/services/tenant.service.ts` — list, create, update, suspend, activate, getPlatformStats

#### 4. User Management
- **Users & Roles page:** `src/app/(admin)/settings/users/` — full team management
- **User table** with role badges, status badges, location, last login
- **Invite user** dialog — React Hook Form + Zod validation, role selection, location assignment
- **Edit user** dialog — update role, status, location
- **Deactivate user** with confirmation dialog
- **User service:** `src/services/user.service.ts` — CRUD, bcrypt password hashing, location scoping

#### 5. Consolidated Settings
- **Settings hub** with 9 linked cards, filtered by role permissions
- **Company Profile** — edit name, domain, logo, address, phone, tax number (stored in Tenant.settings JSON)
- **Billing Preferences** — currency, invoice prefix, tax rate/label, grace period, auto-generate toggle
- **RADIUS Config** — read-only display of server connection details + MikroTik setup guide
- **Notification Templates** — table of existing templates with event, channel, variables, status
- **Existing settings preserved:** Payment Gateway, SMS Gateway, Email SMTP, Captive Portal

#### 6. Dark Mode
- **next-themes** installed and configured with ThemeProvider in root layout
- **Dark mode toggle** in topbar (Sun/Moon icon animation)
- **Class-based dark mode** — `.dark` CSS variables already defined in globals.css
- **System theme detection** enabled by default

#### 7. UI Polish
- **Loading skeletons** for Dashboard, Subscribers, Plans, Billing, Reports, Settings, Online Users, Super Admin Dashboard
- **Error boundaries** for admin and super-admin route groups with retry button
- **Skeleton component** (`src/components/ui/skeleton.tsx`) — reusable animated placeholder
- **Mobile hamburger menu** on sidebar with overlay
- **Responsive topbar** with smaller gaps on mobile
- **Responsive main content** with adjusted padding

#### 8. Middleware Updates
- **Role-based routing:** Super admins auto-redirected to `/super-admin/dashboard`
- **Route protection:** `/super-admin/*` routes blocked for non-super-admins
- **Portal/hotspot paths** allowed without admin auth

### Key files:
- RBAC: `src/lib/rbac.ts`
- User service: `src/services/user.service.ts`
- Tenant service: `src/services/tenant.service.ts`
- User validation: `src/lib/validations/user.schema.ts`
- Super admin layout: `src/app/(super-admin)/layout.tsx`
- Super admin dashboard: `src/app/(super-admin)/super-admin/dashboard/page.tsx`
- Tenant management: `src/app/(super-admin)/super-admin/tenants/`
- User management: `src/app/(admin)/settings/users/`
- Company profile: `src/app/(admin)/settings/company/`
- Billing preferences: `src/app/(admin)/settings/billing-preferences/`
- RADIUS config: `src/app/(admin)/settings/radius/page.tsx`
- Notification templates: `src/app/(admin)/settings/notifications/page.tsx`
- Updated sidebar: `src/components/layouts/sidebar.tsx`
- Updated topbar: `src/components/layouts/topbar.tsx`
- Updated middleware: `src/middleware.ts`
- Root layout: `src/app/layout.tsx` (ThemeProvider added)
- Skeleton: `src/components/ui/skeleton.tsx`
- Error boundaries: `src/app/(admin)/error.tsx`, `src/app/(super-admin)/error.tsx`
- Loading pages: `src/app/(admin)/{dashboard,subscribers,plans,billing,reports,settings,online-users}/loading.tsx`

### Dependencies added:
- `next-themes` v0.4.6 — dark mode support

---

## Build Status

```
Phase 0 (Scaffold)          ████████████████████ COMPLETE
Phase 1 (Subscribers/Plans) ████████████████████ COMPLETE
Phase 2 (RADIUS)            ████████████████████ COMPLETE
Phase 3 (Billing)           ████████████████████ COMPLETE
Phase 4 (Notifications)     ████████████████████ COMPLETE
Phase 5 (Vouchers/CRM)      ████████████████████ COMPLETE
Phase 6 (Reports/Portal)    ████████████████████ COMPLETE
Phase 7 (RBAC/Settings)     ████████████████████ COMPLETE
Phase 8 (Deployment)        ██████████░░░░░░░░░░ IN PROGRESS
```

---

## PHASE 8: Deployment & DevOps — IN PROGRESS

### What was built:
1. **Oracle Cloud Free Tier** chosen (ARM VM, 4 OCPU, 24 GB RAM, free forever)
2. **Production Docker Compose** — PostgreSQL + Redis (localhost-only, strong passwords)
3. **PM2 ecosystem config** — Next.js web + BullMQ worker processes
4. **Nginx reverse proxy** — SSL/TLS, rate limiting, gzip, security headers, static caching
5. **FreeRADIUS production configs** — Hardened clients.conf (no wildcard), DB-based NAS clients
6. **GitHub Actions CI/CD** — Auto-deploy on push to main (SSH → pull → build → restart)
7. **Health check script** — Checks all services, ports, memory, disk
8. **Database backup cron** — Daily pg_dump, 7-day retention
9. **Deployment guide** — Step-by-step from OCI signup to brother's router testing
10. **Defensive security hardening** — 23 vulnerabilities found and fixed pre-deployment

### Architecture:
- **Hybrid approach:** Docker for stateful services (PostgreSQL, Redis), native for everything else
- **Single ARM VM:** Next.js (PM2) + FreeRADIUS (systemd) + Nginx (SSL) + Docker (DB/Cache)
- **CI/CD:** Push to main → GitHub Actions SSH → pull → build → restart

### Key files:
- Deployment guide: `DEPLOYMENT_GUIDE.md`
- Production Docker Compose: `deploy/docker-compose.prod.yml`
- PM2 config: `deploy/ecosystem.config.cjs`
- Nginx config: `deploy/nginx/cloudradius`
- FreeRADIUS production: `deploy/freeradius/{radiusd.conf,sql.conf,clients.conf,default}`
- CI/CD: `.github/workflows/deploy.yml`
- Health check: `deploy/healthcheck.sh`
- Testing guide: `TESTING_WITH_BROTHER.md`

### Remaining:
- [ ] Create Oracle Cloud account and VM
- [ ] Buy domain and configure DNS
- [ ] Run deployment steps from DEPLOYMENT_GUIDE.md
- [ ] Brother tests with MikroTik router

---

## Login Credentials (Seed Data)
- **Super Admin:** `admin@cloudradius.com` / `admin123`
- **Tenant Admin:** `admin@demo-isp.com` / `demo123`
- **Staff:** `staff@demo-isp.com` / `staff123`

---

## Important: Prisma Client Custom Output

The Prisma client is generated to `src/generated/prisma/` (not the default `node_modules/.prisma/client/`).
This was done to work around root-owned files in `node_modules/.pnpm/@prisma+client*/`.

All imports use `@/generated/prisma` instead of `@prisma/client`.

### Fix root-owned files (one-time):
```bash
sudo chown -R $USER:$USER node_modules/.pnpm/@prisma+client* .next/build
```

---

## To run locally:
```bash
docker compose up -d          # Start PostgreSQL + Redis
npx prisma db push            # Sync schema
npx prisma generate           # Generate client to src/generated/prisma/
pnpm db:seed                  # Seed demo data
pnpm dev                      # Start dev server
```
