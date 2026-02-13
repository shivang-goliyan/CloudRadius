# Future Features — CloudRadius

These features are planned for future implementation. Each section includes context, rationale, and implementation hints so you can build them efficiently when the time comes.

---

## 1. Subscriber Self-Service Plan Upgrade

**What:** Allow subscribers to upgrade/downgrade their own plan from the subscriber portal without ISP intervention.

**Why CloudRadius can do it:**
- Subscriber portal already exists at `(portal)/portal/` with JWT auth via `src/lib/portal-session.ts`
- Portal API routes at `/api/portal/{login,logout,tickets,profile}` already handle subscriber self-service
- Plans are already queryable by tenant, and subscriber-plan mapping is already handled
- RADIUS sync (plan change + CoA for live bandwidth update) is already implemented in `subscriberService.update()`

**Implementation hints:**
- Add `/api/portal/plans` to list available plans for the subscriber's tenant
- Add `/api/portal/upgrade` to process plan change (validates balance, calls `subscriberService.update()`)
- Add plan selection UI to the portal dashboard
- Consider requiring payment before upgrade (integrate with payment gateway)
- For downgrades, consider prorating the remaining balance

**Key files:**
- `src/app/(portal)/portal/` — portal pages
- `src/app/api/portal/` — portal API routes
- `src/services/subscriber.service.ts` — `update()` already handles plan change + RADIUS sync
- `src/services/payment.service.ts` — for payment processing

**Dependencies:** Payment gateway integration for online payments

---

## 2. Real-Time Bandwidth Graph Per Subscriber

**What:** Show live bandwidth usage (upload/download) for each subscriber on their profile page, updated every few seconds.

**Why CloudRadius can do it:**
- FreeRADIUS writes interim accounting updates to `radacct` table every 5 minutes
- MikroTik provides `Acct-Input-Octets` and `Acct-Output-Octets` in accounting packets
- The subscriber profile page already shows session data from radacct
- Recharts is already used for dashboard charts (`src/app/(admin)/dashboard/dashboard-charts.tsx`)

**Implementation hints:**
- Create an API route `/api/subscribers/[id]/bandwidth` that queries radacct for the subscriber's recent sessions
- Calculate bandwidth delta between interim updates to get rate (bytes/sec)
- Use Server-Sent Events (SSE) or polling (every 10-30 seconds) for live updates
- For MikroTik, consider using the SNMP or API to get real-time traffic data (more granular than RADIUS accounting)
- Store aggregated bandwidth data in a time-series format for historical graphs

**Key files:**
- `src/app/(admin)/subscribers/[id]/subscriber-profile.tsx` — add bandwidth chart
- `src/services/radius.service.ts` — add bandwidth query method
- `src/app/(admin)/dashboard/dashboard-charts.tsx` — reuse Recharts patterns

**Dependencies:** MikroTik API integration (optional, for sub-minute granularity)

---

## 3. Automated FUP (Fair Usage Policy) with Notification

**What:** When a subscriber exceeds their data quota, automatically reduce their speed to a FUP rate and notify them. Speed is restored on plan renewal.

**Why CloudRadius can do it:**
- `buildFupRateLimit()` already exists in `src/lib/radius-utils.ts` for generating reduced-speed rate limits
- Plan model already has fields for FUP: `dataQuota`, `fupDownloadSpeed`, `fupUploadSpeed`
- CoA (Change of Authorization) is already working — `radiusService.changeUserBandwidth()` can push new rate limits to MikroTik in real time
- BullMQ cron jobs are already set up for periodic checks

**Implementation hints:**
- Create a BullMQ cron job `check-fup-usage` that runs every 15-30 minutes
- For each active subscriber with a data quota, sum `acctinputoctets + acctoutputoctets` from radacct for the current billing period
- If usage exceeds `plan.dataQuota`, send CoA with FUP rate limit and send notification
- Track FUP status on the Subscriber model (add `fupApplied Boolean @default(false)`)
- On plan renewal (auto or manual), reset FUP status and send CoA with normal rate limit
- Add FUP fields to the Plan form UI

**Key files:**
- `src/lib/radius-utils.ts` — `buildFupRateLimit()` already exists
- `src/services/radius.service.ts` — `changeUserBandwidth()` for live rate change
- `src/jobs/workers/billing.worker.ts` — add FUP check cron job
- `prisma/schema.prisma` — Plan model (fupDownloadSpeed, fupUploadSpeed, dataQuota fields)

**Dependencies:** Accurate interim accounting from MikroTik (recommended: 5-minute intervals)

---

## 4. Multi-Currency and Multi-Country

**What:** Support ISPs in different countries with different currencies, tax rules, and localization.

**Why CloudRadius can do it:**
- Billing preferences already support currency selection (`src/app/(admin)/settings/billing-preferences/`)
- The `currency` field is already stored in tenant settings
- Invoice PDF generation already uses the configured currency

**Implementation hints:**
- Add a `country` field to the Tenant model for locale-specific formatting
- Use `Intl.NumberFormat` for currency formatting throughout the app
- Add country-specific tax rules (GST for India, VAT for EU, etc.)
- Support multiple tax rates per country (CGST + SGST for India)
- Add timezone support to the Tenant model for correct date display
- Consider adding i18n for UI text (next-intl library)

**Key files:**
- `prisma/schema.prisma` — Tenant model (add country, timezone)
- `src/app/(admin)/settings/billing-preferences/` — expand currency/tax options
- `src/app/api/invoices/[id]/pdf/invoice-pdf.tsx` — currency formatting
- `src/services/billing.service.ts` — tax calculation

**Dependencies:** Research tax rules for target countries

---

## 5. ISP-to-ISP Referral System

**What:** Allow existing ISP customers to refer other ISPs to CloudRadius and earn credits/discounts on their subscription.

**Why CloudRadius can do it:**
- Multi-tenant architecture means each ISP is a separate tenant
- Tenant model can track referral relationships
- Billing is already tracked per tenant

**Implementation hints:**
- Add `referredBy String?` to the Tenant model (references another tenant's ID)
- Generate unique referral codes per tenant
- On new tenant registration, check for referral code and link
- Create a referral dashboard showing referred ISPs and earned credits
- Apply credits to the referring tenant's CloudRadius subscription
- Consider tiered rewards (more referrals = higher discount)

**Key files:**
- `prisma/schema.prisma` — Tenant model (add referredBy, referralCode)
- `src/app/api/auth/register/route.ts` — handle referral code on registration
- `src/app/(super-admin)/super-admin/` — referral management for platform admins
- New: `src/services/referral.service.ts`

**Dependencies:** Platform subscription/billing system (Phase 8)

---

## 6. Scheduled Plan Changes

**What:** Allow ISPs to schedule a plan change for a subscriber to take effect at a future date (e.g., "switch to 100Mbps plan on Feb 1st").

**Why CloudRadius can do it:**
- BullMQ already supports delayed jobs and scheduled execution
- Plan change logic with RADIUS sync and CoA is already implemented
- Subscriber model has dates that could track scheduled changes

**Implementation hints:**
- Add a `ScheduledChange` model: `{ id, subscriberId, tenantId, changeType, newPlanId, scheduledDate, status }`
- Create a BullMQ cron job `process-scheduled-changes` that runs daily
- When a scheduled change date arrives, execute the plan change via `subscriberService.update()`
- Add UI to the subscriber profile to schedule a plan change
- Show pending scheduled changes on the subscriber list and profile
- Allow cancellation of scheduled changes before execution

**Key files:**
- `prisma/schema.prisma` — new ScheduledChange model
- `src/jobs/workers/billing.worker.ts` — add scheduled change processing
- `src/app/(admin)/subscribers/[id]/subscriber-profile.tsx` — schedule UI
- `src/services/subscriber.service.ts` — reuse existing update logic

**Dependencies:** None (all infrastructure exists)

---

## 7. Network Health Monitoring

**What:** Monitor NAS devices (MikroTik routers) for uptime, latency, and basic health metrics. Alert ISPs when a router goes down.

**Why CloudRadius can do it:**
- NAS devices are already registered in the system with IP addresses
- RADIUS accounting data can indicate when a NAS stops sending packets
- BullMQ can run periodic health check jobs

**Implementation hints:**
- Create a BullMQ cron job `check-nas-health` that pings each NAS device (ICMP or TCP to RADIUS port)
- Track NAS status in a new `NasHealthLog` model: `{ nasDeviceId, status, latency, checkedAt }`
- Send alerts (SMS/Email/WhatsApp) when a NAS goes offline for >5 minutes
- Dashboard widget showing NAS health status (green/yellow/red)
- For MikroTik specifically, consider using the RouterOS API (port 8728) for richer health data (CPU, memory, interface status)
- SNMP monitoring is another option for device-agnostic health checks

**Key files:**
- `prisma/schema.prisma` — new NasHealthLog model
- `src/jobs/queue.ts` — add NAS health check cron
- New: `src/services/nas-health.service.ts`
- `src/app/(admin)/dashboard/` — health status widget
- `src/app/(admin)/nas/` — NAS detail page with health history

**Dependencies:** Network access to NAS devices from the CloudRadius server

---

## General Notes

- All features should follow the existing patterns: service layer, server actions, zod validation, multi-tenant scoping
- RADIUS-related features should sync through `radiusService` (never write directly to RADIUS tables from UI code)
- Notification features should use the existing `notificationQueue` and template system
- New database models should always include `tenantId` for multi-tenant isolation
- Prioritize features based on ISP demand — talk to beta ISP users before building
