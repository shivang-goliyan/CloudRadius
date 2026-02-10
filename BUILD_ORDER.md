# BUILD ORDER — CloudRadius SaaS Platform

**Total Estimated Phases:** 8
**Approach:** Monorepo, iterative vertical slices. Each phase delivers a working increment.

---

## PHASE 0: Project Scaffolding & Infrastructure
**Priority:** P0 — MUST DO FIRST
**Estimated Effort:** 1 session

### Tasks:
1. Initialize monorepo structure with pnpm workspaces
2. Set up Next.js 15 app (App Router) with TypeScript
3. Set up PostgreSQL database with Prisma ORM
4. Define base Prisma schema: `tenants`, `users`, `sessions` tables
5. Set up NextAuth.js v5 for authentication (credentials provider)
6. Set up Tailwind CSS + shadcn/ui component library
7. Create base layouts: Admin layout (sidebar + topbar), Auth layout
8. Set up environment variables (.env.example)
9. Set up ESLint + Prettier
10. Create seed script with demo tenant and admin user
11. Implement multi-tenant middleware (tenant resolution from subdomain or header)
12. Set up Docker Compose for local dev (PostgreSQL + Redis + FreeRADIUS)

### Deliverables:
- Running Next.js app with login page
- Admin dashboard shell (empty) with sidebar navigation
- Database connected with base tables
- Multi-tenant context available throughout app

---

## PHASE 1: Core Subscriber & Plan Management
**Priority:** P0 — Core Business Logic
**Estimated Effort:** 2-3 sessions

### Tasks:
1. Prisma schema: `subscribers`, `plans`, `locations`, `nas_devices`
2. **Plans Module:**
   - Plans list page (data table with search, filter, sort)
   - Create/Edit plan form (all bandwidth, quota, FUP, time fields)
   - Plan activation/deactivation
3. **NAS Devices Module:**
   - NAS list page
   - Add/Edit NAS form (name, IP, secret, type, location)
   - NAS status indicator
4. **Subscribers Module:**
   - Subscribers list page (data table with search, filter by status/plan/area)
   - Add subscriber form (personal details + connection details + plan assignment)
   - Edit subscriber form
   - Subscriber profile page (360° view — tabbed: details, billing, sessions, complaints)
   - Subscriber status management (activate, expire, disable, suspend)
   - Bulk import via CSV (upload + field mapping + validation + import)
   - Bulk export to CSV
5. **Locations Module:**
   - Location tree (region → city → area)
   - Add/Edit location

### Deliverables:
- Full subscriber CRUD with search and filtering
- Plan management with all ISP-specific fields
- NAS device management
- Location hierarchy
- CSV import/export working

---

## PHASE 2: RADIUS Server Integration
**Priority:** P0 — Core Technical Infrastructure
**Estimated Effort:** 2-3 sessions

### Tasks:
1. Set up FreeRADIUS server (Docker container)
2. Configure FreeRADIUS SQL module to read from PostgreSQL
3. Create RADIUS-specific DB views/tables:
   - `radcheck` — username/password pairs
   - `radreply` — bandwidth attributes per user
   - `radgroupcheck` — plan-based group checks
   - `radgroupreply` — plan-based bandwidth limits
   - `radusergroup` — user-to-plan mapping
   - `radacct` — accounting records
   - `nas` — NAS device table for RADIUS
4. Implement Sync Service: When subscriber/plan changes in app → sync to RADIUS tables
5. Implement MikroTik VSA (Vendor-Specific Attributes):
   - `Mikrotik-Rate-Limit` for bandwidth control
   - Burst parameters
   - Address pool assignment
6. Implement RADIUS accounting processor:
   - Parse Acct-Start, Interim-Update, Acct-Stop packets
   - Update subscriber session data in app DB
   - Calculate data usage per subscriber
7. Implement CoA (Change of Authorization):
   - Disconnect user API (sends CoA Disconnect to NAS)
   - Change bandwidth in real-time (CoA with new attributes)
8. **Online Users Page:**
   - Real-time list of currently connected subscribers
   - Session details (IP, MAC, NAS, uptime, data in/out)
   - "Disconnect" button per user
9. **Session History:**
   - Session log per subscriber
   - Filter by date range

### Deliverables:
- FreeRADIUS authenticating subscribers via PPPoE and Hotspot
- Bandwidth limits enforced per plan
- Real-time online user monitoring
- Session accounting and usage tracking
- CoA disconnect working

---

## PHASE 3: Billing, Invoicing & Payments
**Priority:** P0 — Revenue Engine
**Estimated Effort:** 2 sessions

### Tasks:
1. Prisma schema: `invoices`, `payments`, `payment_gateways`
2. **Invoice Module:**
   - Auto-generate invoice on plan activation
   - Invoice list page (filter by status, date, subscriber)
   - Invoice detail view
   - Invoice PDF generation (using @react-pdf/renderer or puppeteer)
   - Manual invoice creation
3. **Payment Module:**
   - Record manual payment (cash, cheque, bank transfer)
   - Payment list page
   - Payment receipt generation
   - Link payment to invoice
   - Outstanding balance tracking
4. **Payment Gateway Integration (Razorpay first):**
   - Gateway configuration page in settings (API key, secret)
   - Create Razorpay order on "Pay Now"
   - Handle Razorpay webhook for payment confirmation
   - Auto-update invoice and subscriber status on payment
   - Subscriber self-service payment link generation
5. **Auto-Billing Engine (Background Jobs):**
   - Cron: Check subscribers expiring in 3/1/0 days
   - Cron: Generate invoices for upcoming renewals
   - Cron: Disable subscribers after grace period
   - Cron: Auto-renew if prepaid balance available

### Deliverables:
- Complete billing lifecycle (invoice → payment → receipt)
- Razorpay integration working end-to-end
- Subscriber self-payment via link
- Auto-expiry and renewal engine

---

## PHASE 4: Notifications (SMS/Email/WhatsApp)
**Priority:** P1 — Critical for Operations
**Estimated Effort:** 1-2 sessions

### Tasks:
1. Prisma schema: `notification_templates`, `notification_logs`, `sms_gateways`
2. **Notification Engine:**
   - Queue-based notification processing (BullMQ + Redis)
   - Template system with variables ({name}, {plan}, {expiry}, {amount}, etc.)
   - Channel router (SMS, Email, WhatsApp)
3. **SMS Integration:**
   - Pluggable SMS adapter (interface: `sendSMS(to, message)`)
   - Implement MSG91 adapter
   - Implement Textlocal adapter
   - Gateway configuration page in settings
   - SMS templates CRUD page
4. **Email Integration:**
   - SMTP configuration per tenant
   - HTML email templates (React Email)
   - Send invoice as PDF attachment
5. **WhatsApp Integration:**
   - WhatsApp Business API adapter
   - Template message support
6. **Notification Triggers:**
   - Wire up all events from FR-3.9.2 to notification engine
   - Event-driven architecture (emit event → notification handler picks up)
7. **OTP Service:**
   - Generate and send OTP via SMS
   - OTP verification API
   - Rate limiting on OTP requests
   - OTP expiry (5 minutes)

### Deliverables:
- SMS notifications working for all events
- Email notifications with HTML templates
- OTP authentication for hotspot login
- Notification logs viewable in admin panel

---

## PHASE 5: Vouchers, Hotspot Portal & CRM
**Priority:** P1 — Feature Completeness
**Estimated Effort:** 2 sessions

### Tasks:
1. **Voucher System:**
   - Prisma schema: `vouchers`, `voucher_batches`
   - Generate batch vouchers (quantity, plan, validity)
   - Voucher list page (filter by status, plan, batch)
   - Print voucher cards as PDF (grid layout with codes + QR)
   - Voucher redemption logic in RADIUS (voucher code as username)
   - Voucher status tracking (generated → sold → redeemed → expired)
   - Export voucher list to CSV

2. **Captive Portal / Hotspot Login Page:**
   - Standalone captive portal page (served at /portal/{tenant-slug})
   - Login methods: username/password, OTP, voucher code
   - Customizable branding (logo, colors, background, terms)
   - Plan display and selection
   - Post-login redirect
   - Terms of Service acceptance
   - Responsive mobile-first design
   - Portal settings configuration in admin panel

3. **CRM & Helpdesk:**
   - Prisma schema: `tickets`, `ticket_comments`, `leads`
   - **Tickets:**
     - Ticket list page (filter by status, priority, assignee)
     - Create ticket (from admin or subscriber portal)
     - Ticket detail page with comment thread
     - Assign/reassign to staff
     - Status transitions with notifications
   - **Leads:**
     - Lead list page
     - Add/Edit lead
     - Lead status pipeline (kanban or list view)
     - Convert lead to subscriber (pre-fill form)

### Deliverables:
- Working voucher system with PDF printing
- Captive portal that authenticates via RADIUS
- Complaint ticketing system
- Lead management pipeline

---

## PHASE 6: Reports, Dashboard & Subscriber Portal
**Priority:** P1 — Analytics & Self-Service
**Estimated Effort:** 2 sessions

### Tasks:
1. **Admin Dashboard:**
   - KPI cards (total subscribers, active, expired, new this month, MRR, collections)
   - Subscriber growth chart (line chart, last 12 months)
   - Revenue trend chart (bar chart, last 12 months)
   - Plan distribution (pie chart)
   - Area-wise distribution (bar chart)
   - Currently online count
   - Recent activity feed
   - Quick action buttons (add subscriber, record payment)

2. **Reports Module:**
   - Unified report builder component
   - All reports from PRD FR-3.10.2
   - Date range picker + filters
   - Data table with sorting + pagination
   - Chart visualization (Recharts)
   - Export to CSV, Excel (SheetJS), PDF
   - Print-friendly mode

3. **Subscriber Self-Service Portal:**
   - Separate Next.js route group (/subscriber-portal)
   - Login page (phone + OTP or username + password)
   - Dashboard: current plan, usage meter, expiry date
   - Billing page: invoice list, "Pay Now" button
   - Complaints page: list, create new
   - Profile page: edit personal details
   - Custom domain support (portal.yourisp.com via tenant settings)

### Deliverables:
- Rich admin dashboard with real-time data
- 10+ report types with export
- Subscriber self-service portal working

---

## PHASE 7: RBAC, Multi-Location, Settings & Polish
**Priority:** P2 — Enterprise Features
**Estimated Effort:** 2 sessions

### Tasks:
1. **RBAC (Role-Based Access Control):**
   - Define roles: Admin, Manager, Staff, Collector, Franchise
   - Permission matrix per role
   - RBAC middleware on all API routes
   - User management page (invite, edit role, deactivate)
   - Franchise operator scoping (filter all queries by assigned area)

2. **Multi-Location / Franchise:**
   - Location hierarchy management UI (tree view)
   - Assign NAS to locations
   - Assign subscribers to areas
   - Franchise operator creation with area assignment
   - Franchise dashboard (scoped data)

3. **Settings Pages:**
   - Company profile (name, logo, address, custom domain)
   - Payment gateway configuration
   - SMS gateway configuration
   - Email SMTP configuration
   - WhatsApp configuration
   - Notification template management
   - Tax configuration (GST for India)
   - Billing preferences (currency, invoice prefix, grace period)
   - RADIUS configuration display (server IP, ports for MikroTik config)

4. **Super Admin Panel:**
   - Tenant list with status, tier, subscriber count
   - Tenant detail page
   - Create/suspend/activate tenant
   - Platform-level analytics
   - RADIUS server health monitoring
   - System settings

5. **Polish:**
   - Loading states and skeletons
   - Error boundaries
   - Form validations (Zod schemas)
   - Toast notifications
   - Keyboard shortcuts
   - Dark mode support
   - Mobile responsive admin panel
   - Accessibility (ARIA labels, focus management)

### Deliverables:
- Enterprise-grade RBAC
- Full settings configuration
- Super admin panel
- Production-ready UI polish

---

## PHASE 8: Deployment, DevOps & Production Readiness
**Priority:** P0 — Must do before launch
**Estimated Effort:** 1-2 sessions

### Tasks:
1. **Docker Setup:**
   - Multi-stage Dockerfile for Next.js app
   - FreeRADIUS Dockerfile
   - Docker Compose for full stack (app + db + redis + radius)
   - Health checks

2. **AWS Infrastructure (Terraform or manual):**
   - EC2/ECS for app servers
   - RDS PostgreSQL (Multi-AZ)
   - ElastiCache Redis
   - S3 for file storage (invoices, vouchers, logos)
   - CloudFront CDN
   - Route 53 DNS
   - ALB with SSL termination
   - EC2 for FreeRADIUS (dedicated, with public IP)

3. **CI/CD:**
   - GitHub Actions pipeline (lint → test → build → deploy)
   - Staging and production environments
   - Database migration pipeline

4. **Monitoring:**
   - Application logging (Winston/Pino)
   - Error tracking (Sentry)
   - RADIUS server monitoring
   - Uptime monitoring
   - Alert system (PagerDuty/Slack)

5. **Security Hardening:**
   - Rate limiting (API + auth)
   - CORS configuration
   - CSP headers
   - Dependency audit
   - RADIUS secret rotation
   - Database backup automation

### Deliverables:
- Production deployment on AWS
- CI/CD pipeline
- Monitoring and alerting
- Security hardened

---

## BUILD DEPENDENCY GRAPH

```
Phase 0 (Scaffold)
    ↓
Phase 1 (Subscribers + Plans) ──→ Phase 2 (RADIUS)
    ↓                                  ↓
Phase 3 (Billing + Payments) ←────────┘
    ↓
Phase 4 (Notifications)
    ↓
Phase 5 (Vouchers + Portal + CRM)
    ↓
Phase 6 (Reports + Dashboard + Subscriber Portal)
    ↓
Phase 7 (RBAC + Settings + Polish)
    ↓
Phase 8 (Deployment + DevOps)
```

---

## CRITICAL RULES FOR CLAUDE CLI

1. **Always check existing code before creating new files** — avoid duplicate components
2. **Use the Prisma schema as single source of truth** — never create raw SQL tables
3. **Every API route must check tenant context** — no cross-tenant data leaks
4. **Every list page must have: search, filter, sort, pagination, export**
5. **Every form must use Zod validation** — both client and server
6. **Use Server Actions for mutations** where possible (Next.js 15 pattern)
7. **Use server components by default** — only 'use client' when interactivity needed
8. **Follow the data model in PRD section 5** — don't invent new entities without reason
9. **RADIUS integration is via SQL views/tables** — FreeRADIUS reads from DB, app writes to DB
10. **All background jobs via BullMQ** — never use setTimeout for scheduled work
