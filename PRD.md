# PRODUCT REQUIREMENTS DOCUMENT (PRD)
# CloudRadius — ISP Billing & Bandwidth Management SaaS Platform

**Version:** 1.0
**Date:** February 2026
**Status:** Draft — Ready for Development

---

## 1. PRODUCT OVERVIEW

### 1.1 Product Name
**CloudRadius** (working name — replace with your brand)

### 1.2 One-Line Description
A cloud-hosted, multi-tenant SaaS platform that provides RADIUS-based subscriber authentication, bandwidth management, automated billing, and CRM for Internet Service Providers (ISPs), WISPs, and WiFi hotspot operators.

### 1.3 Problem Statement
ISPs and WiFi operators in emerging markets (India, Africa) struggle with:
- Expensive on-premise servers to run RADIUS and billing software
- Manual billing, invoicing, and payment tracking
- No visibility into subscriber usage and network health
- Poor customer complaint management
- Difficulty scaling across locations and franchises

### 1.4 Solution
A 100% cloud-hosted platform where ISPs only need a MikroTik router. The platform handles all RADIUS authentication, bandwidth enforcement, billing automation, payment collection, CRM, and reporting through a modern web dashboard and mobile apps.

### 1.5 Target Users
| User Type | Description |
|-----------|------------|
| **Platform Super Admin** | Operates the SaaS platform itself (you) |
| **ISP Operator (Tenant Admin)** | ISP business owner who signs up as a customer |
| **ISP Staff** | Employees of the ISP with limited role-based access |
| **Franchise Operator** | Sub-operator under an ISP with scoped access |
| **Subscriber (End User)** | Internet consumer of the ISP |

---

## 2. USER PERSONAS

### Persona 1: Rahul — Small ISP Owner (India)
- Runs a 200-subscriber broadband business in a tier-2 city
- Uses MikroTik routers with PPPoE
- Currently manages subscribers in Excel spreadsheets
- Needs automated billing and payment collection
- Budget-conscious, wants to avoid server costs

### Persona 2: James — WiFi Hotspot Operator (Kenya)
- Operates WiFi hotspots at 5 cafes and a hotel
- Uses voucher-based access for cafe WiFi
- Needs MPesa payment integration
- Wants captive portal with branding

### Persona 3: Priya — ISP Manager (Staff)
- Works for a mid-size ISP with 500+ subscribers
- Handles subscriber complaints and renewals daily
- Needs quick subscriber lookup and complaint management
- Uses mobile phone for field operations

### Persona 4: End Subscriber — Amit
- Home broadband user
- Wants to check data usage, pay bills online, raise complaints
- Expects SMS/WhatsApp notifications for expiry and payments

---

## 3. FUNCTIONAL REQUIREMENTS

### 3.1 Platform & Tenant Management (Super Admin)

#### FR-3.1.1: Multi-Tenant Architecture
- Each ISP operator gets an isolated tenant
- Tenant data is logically separated (shared DB with tenant_id or schema-per-tenant)
- Tenant-level configuration (branding, payment gateway, SMS gateway, etc.)
- Tenant suspension/activation by super admin

#### FR-3.1.2: Super Admin Dashboard
- Total tenants, active/inactive/trial
- Total subscribers across all tenants
- Revenue metrics (MRR, collections)
- System health (RADIUS server status, API latency)
- Tenant onboarding workflow

#### FR-3.1.3: Subscription & Billing for Tenants
- Tiered plans based on max concurrent online subscribers:
  - Starter: Up to 50 online
  - Growth: Up to 100 online
  - Professional: Up to 200 online
  - Enterprise: Unlimited (pay per active subscriber)
- Trial period (7 days free)
- Usage metering (count concurrent online subscribers)
- Auto-invoicing for tenants
- Payment collection from tenants

---

### 3.2 Subscriber Management (ISP Operator)

#### FR-3.2.1: Subscriber CRUD
- Fields: Full name, phone, email, address (with area/zone), alternate phone, installation address, GPS coordinates, subscriber type (residential/commercial), connection type (PPPoE/Hotspot/Static IP/MAC), username, password, assigned plan, NAS/router assignment, MAC address, IP address, installation date, last renewal date, expiry date, status (active/expired/disabled/suspended), notes
- Add single subscriber via form
- Bulk import via CSV/Excel upload with field mapping
- Bulk export to CSV/Excel
- Edit subscriber details
- Delete/archive subscriber
- Quick search and filter (by name, phone, username, status, plan, area, NAS)

#### FR-3.2.2: Subscriber Status Management
- Active — currently authenticated and allowed to connect
- Expired — plan has expired, RADIUS rejects authentication
- Disabled — manually disabled by admin
- Suspended — temporarily suspended (e.g., non-payment)
- Trial — on free trial plan

#### FR-3.2.3: Subscriber Profile View (360°)
- Personal details
- Current plan and usage stats
- Billing history (all invoices)
- Payment history (all transactions)
- Complaint/ticket history
- Session history (login/logout times, data consumed)
- Plan change history
- Notes/activity log

---

### 3.3 Data Plan / Package Management

#### FR-3.3.1: Plan CRUD
- Fields: Plan name, description, upload speed (Kbps/Mbps), download speed (Kbps/Mbps), data quota (MB/GB/Unlimited), validity/duration (hours/days/weeks/months/custom), price, billing type (prepaid/postpaid), FUP speed after quota (upload/download), burst speed (upload/download), burst threshold, burst time, time slot restrictions (e.g., 6PM-6AM), simultaneous device limit, plan type (PPPoE/Hotspot/Both), status (active/inactive)
- Create, edit, clone, deactivate plans
- Plan grouping/categorization

#### FR-3.3.2: Fair Usage Policy (FUP)
- When subscriber exceeds data quota, auto-reduce speed to FUP values
- FUP upload and download speeds configurable per plan
- Notification to subscriber when FUP kicks in
- Usage counter reset on plan renewal

#### FR-3.3.3: Plan Assignment
- Assign plan to subscriber (new or change)
- Pro-rated billing on mid-cycle plan change
- Schedule plan change for next billing cycle
- Auto-renewal on plan expiry (if enabled)
- Grace period configuration after expiry

---

### 3.4 RADIUS Server & Authentication

#### FR-3.4.1: RADIUS AAA Core
- Implement FreeRADIUS with SQL backend
- Process Access-Request, Access-Accept, Access-Reject
- Process Accounting-Request (Start, Interim-Update, Stop)
- Support standard RADIUS attributes (RFC 2865/2866)
- Support MikroTik Vendor-Specific Attributes (VSAs)
- CoA (Change of Authorization) — disconnect user or change limits in real-time
- Handle concurrent session limits

#### FR-3.4.2: Authentication Methods
- **PPPoE:** Username + password authentication
- **Hotspot:** Username + password via captive portal
- **MAC Auth:** Auto-authenticate based on MAC address binding
- **IP Auth:** Authenticate based on static IP assignment
- **OTP Auth:** SMS-based one-time password for hotspot
- **Voucher/PIN Auth:** Pre-generated code authentication

#### FR-3.4.3: NAS (Network Access Server) Management
- Add/edit/delete NAS devices (MikroTik routers)
- Fields: NAS name, NAS IP, RADIUS secret, NAS type, location, description
- NAS status monitoring (reachable/unreachable)
- Support for multiple NAS per ISP tenant
- NAS grouping by location

#### FR-3.4.4: Session Management
- View currently online subscribers (real-time)
- View active session details (IP, MAC, NAS, data in/out, uptime)
- Force disconnect subscriber (CoA Disconnect-Request)
- Session history with full accounting data

---

### 3.5 Billing & Invoicing

#### FR-3.5.1: Invoice Generation
- Auto-generate invoice on plan activation/renewal
- Invoice fields: Invoice #, date, subscriber details, plan details, amount, tax, total, payment status, due date
- Manual invoice creation
- Invoice PDF generation and download
- Invoice templates (customizable with ISP branding)

#### FR-3.5.2: Payment Tracking
- Record payments (online or manual/cash/cheque)
- Payment methods: Cash, UPI, Card, Bank Transfer, Payment Gateway, Voucher
- Partial payment support
- Payment receipts
- Outstanding balance tracking
- Advance payment/credit tracking

#### FR-3.5.3: Auto-Billing Rules
- Auto-generate invoice X days before plan expiry
- Auto-disable subscriber on non-payment after grace period
- Auto-send payment reminders via SMS/Email/WhatsApp
- Recurring billing for postpaid subscribers

---

### 3.6 Payment Gateway Integration

#### FR-3.6.1: Gateway Framework
- Pluggable payment gateway architecture (adapter pattern)
- Each ISP tenant configures their own gateway credentials
- Support multiple gateways simultaneously per tenant

#### FR-3.6.2: Supported Gateways (Phase-wise)
- **Phase 1 (India):** Razorpay, Cashfree, PhonePe
- **Phase 2 (India):** PayTM, CCAvenue, BillDesk, PayUMoney
- **Phase 3 (Africa):** MPesa, Flutterwave, Hubtel
- **Phase 4:** Stripe (global), custom gateway API

#### FR-3.6.3: Subscriber Self-Service Payment
- Payment link sent via SMS/WhatsApp
- Subscriber portal with "Pay Now" button
- Plan selection and purchase by subscriber
- Auto plan activation after successful payment
- Payment confirmation notification

---

### 3.7 Voucher / PIN System

#### FR-3.7.1: Voucher Generation
- Generate batch vouchers with parameters: plan, validity, quantity, prefix
- Voucher format: alphanumeric code (configurable length)
- Serial number assignment
- Print-ready voucher cards (PDF with QR code)
- Export voucher list to CSV/Excel

#### FR-3.7.2: Voucher Lifecycle
- Generated → Sold → Redeemed → Expired
- One-time use vouchers
- Track who sold the voucher, when, and to whom
- Voucher activation on first use (hotspot login with voucher code)
- Auto plan assignment on voucher redemption

---

### 3.8 CRM & Helpdesk

#### FR-3.8.1: Complaint Tickets
- Create ticket (by admin, staff, or subscriber)
- Fields: Subject, description, category (connectivity/billing/speed/other), priority (low/medium/high/critical), assigned to, status, subscriber reference
- Ticket lifecycle: Open → Assigned → In Progress → Resolved → Closed
- Internal notes on tickets (not visible to subscriber)
- File attachments on tickets

#### FR-3.8.2: Ticket Assignment & Tracking
- Assign to specific staff member
- Reassignment
- SLA tracking (time to respond, time to resolve)
- Escalation rules
- SMS/Email notification on status change to subscriber

#### FR-3.8.3: Lead Management
- Capture leads (potential subscribers)
- Lead fields: name, phone, address, area, source, notes
- Lead status: New → Contacted → Site Survey → Installation Scheduled → Converted
- Convert lead to subscriber

---

### 3.9 Notifications Engine

#### FR-3.9.1: SMS Gateway Integration
- Pluggable SMS provider architecture
- Support for Indian SMS providers (MSG91, Textlocal, etc.)
- Support for African SMS providers (Africa's Talking, etc.)
- Operator configures their own SMS gateway credentials
- SMS templates with dynamic variables ({subscriber_name}, {plan_name}, {expiry_date}, etc.)

#### FR-3.9.2: Notification Triggers
| Event | SMS | Email | WhatsApp |
|-------|-----|-------|----------|
| New plan activation | ✅ | ✅ | ✅ |
| Plan expiry warning (3 days before) | ✅ | ✅ | ✅ |
| Plan expired | ✅ | ✅ | ✅ |
| Payment received | ✅ | ✅ | ✅ |
| Payment due reminder | ✅ | ✅ | ✅ |
| OTP for login | ✅ | ❌ | ✅ |
| Complaint ticket update | ✅ | ✅ | ✅ |
| FUP limit reached | ✅ | ✅ | ❌ |

#### FR-3.9.3: WhatsApp Integration
- WhatsApp Business API integration
- Template messages for transactional notifications
- Operator configures their own WhatsApp business number

#### FR-3.9.4: Email Notifications
- SMTP configuration per tenant
- HTML email templates
- Invoice email with PDF attachment

---

### 3.10 Reporting & Analytics

#### FR-3.10.1: Dashboard
- Key metrics: Total subscribers, active, expired, new this month, churned, MRR, collections this month, outstanding
- Charts: Subscriber growth trend, revenue trend, plan-wise distribution, area-wise distribution
- Currently online subscribers count
- Quick actions

#### FR-3.10.2: Reports
| Report | Description |
|--------|------------|
| Subscriber Report | List by status, plan, area, NAS, date range |
| Billing Report | Invoices generated, paid, pending, overdue |
| Collection Report | Payments received by date, method, collector |
| Revenue Report | Revenue by plan, area, period |
| Usage Report | Data consumption by subscriber, plan |
| Expiry Report | Subscribers expiring in next N days |
| Churn Report | Subscribers who didn't renew |
| Session Report | Login sessions with duration and usage |
| Voucher Report | Generated, sold, redeemed, expired vouchers |
| NAS Report | Subscribers per NAS, online count per NAS |

#### FR-3.10.3: Report Features
- Filter by date range, plan, area, NAS, status
- Export to CSV, Excel, PDF
- Scheduled report emails (daily/weekly/monthly)
- Print-friendly view

---

### 3.11 Captive Portal / Hotspot Portal

#### FR-3.11.1: Portal Builder
- Template-based captive portal page builder
- Customizable: logo, background, colors, text, terms of service
- Responsive (mobile-first)
- Custom domain support (portal.yourisp.com)

#### FR-3.11.2: Portal Login Options
- Username + Password
- OTP via SMS
- Voucher/PIN code
- Social login (optional future)
- Accept Terms checkbox

#### FR-3.11.3: Portal Features
- Post-login redirect URL (configurable)
- Bandwidth plan display and purchase
- Data usage display
- Ad/promotion display area
- Feedback form

---

### 3.12 Subscriber Self-Service Portal

#### FR-3.12.1: Subscriber Web Portal
- Login with username/phone + password/OTP
- View current plan details and expiry
- View data usage (consumed vs total)
- View billing and payment history
- Download invoices
- Make online payment / renew plan
- Raise complaint ticket
- View complaint status
- Update profile details

#### FR-3.12.2: Subscriber Mobile App (Future Phase)
- Same features as web portal
- Push notifications
- White-labeled per ISP tenant

---

### 3.13 Syslog & Compliance

#### FR-3.13.1: Session Logging
- Log all RADIUS accounting data
- Fields: Username, NAS IP, session ID, start time, stop time, duration, bytes in, bytes out, terminate cause, IP assigned, MAC address
- Retention policy (configurable, default 90 days)
- Searchable by username, date range, NAS

#### FR-3.13.2: Compliance
- Subscriber KYC data storage
- Usage logs for regulatory compliance
- Export logs for legal/regulatory requests
- Data retention configuration per tenant

---

### 3.14 Multi-Location & Franchise

#### FR-3.14.1: Location Management
- Hierarchical locations: Region → City → Area
- Assign NAS devices to locations
- Assign subscribers to areas
- Location-wise reporting

#### FR-3.14.2: Franchise / Reseller Management
- Create franchise operators under a tenant
- Franchise has limited access (own subscribers, own area)
- Revenue sharing configuration
- Franchise-level reporting

---

### 3.15 User Roles & Permissions

#### FR-3.15.1: Role-Based Access Control (RBAC)
| Role | Permissions |
|------|------------|
| Super Admin | Full platform access, tenant management |
| Tenant Admin (ISP Owner) | Full access to their tenant |
| Manager | All tenant features except settings/billing |
| Staff | Subscriber management, complaints, basic reports |
| Collector | View subscribers, record payments only |
| Franchise | Scoped to own area subscribers |
| Subscriber | Self-service portal only |

---

### 3.16 API & Integrations

#### FR-3.16.1: REST API
- Full CRUD API for all entities
- API key authentication per tenant
- Rate limiting
- Webhook support for events (subscriber created, payment received, plan expired, etc.)
- API documentation (Swagger/OpenAPI)

#### FR-3.16.2: Webhooks
- Configurable webhook URLs per event
- Retry logic on failure
- Webhook logs

---

## 4. NON-FUNCTIONAL REQUIREMENTS

### 4.1 Performance
- RADIUS authentication response: < 100ms
- API response time: < 500ms (p95)
- Dashboard load: < 2 seconds
- Support 10,000+ concurrent RADIUS sessions per tenant
- Support 500+ tenants

### 4.2 Availability
- 99.9% uptime SLA
- RADIUS server redundancy (primary + secondary)
- Database replication
- Auto-failover

### 4.3 Security
- All data encrypted at rest (AES-256) and in transit (TLS 1.3)
- RADIUS shared secrets encrypted in DB
- Password hashing (bcrypt/argon2)
- JWT-based API authentication
- RBAC with middleware enforcement
- SQL injection, XSS, CSRF protection
- Rate limiting and brute force protection
- Audit logging (who did what, when)

### 4.4 Scalability
- Horizontal scaling for API servers
- RADIUS server clustering
- Database read replicas
- Queue-based async processing for notifications/reports
- CDN for static assets

### 4.5 Multi-Tenancy
- Tenant isolation at application layer
- Shared database with `tenant_id` column (cost-effective)
- Option to migrate large tenants to dedicated DB
- Tenant-specific configurations stored as JSON

---

## 5. DATA MODEL (HIGH-LEVEL)

### Core Entities
```
tenants
├── id, name, slug, domain, logo, settings (JSON), plan_tier, status, created_at
├── tenant_users (admin/staff)
│   └── id, tenant_id, name, email, password_hash, role, permissions, status
├── nas_devices
│   └── id, tenant_id, name, ip, secret, type, location_id, status
├── locations
│   └── id, tenant_id, parent_id, name, type (region/city/area)
├── plans
│   └── id, tenant_id, name, upload_speed, download_speed, data_limit, validity_days, price, fup_upload, fup_download, burst_config, time_slots, billing_type, status
├── subscribers
│   └── id, tenant_id, name, phone, email, address, area_id, username, password_hash, mac, ip, plan_id, nas_id, status, expiry_date, created_at
├── invoices
│   └── id, tenant_id, subscriber_id, plan_id, amount, tax, total, status, due_date, paid_date
├── payments
│   └── id, tenant_id, subscriber_id, invoice_id, amount, method, gateway_ref, status, created_at
├── vouchers
│   └── id, tenant_id, code, plan_id, status, created_by, redeemed_by, redeemed_at
├── tickets
│   └── id, tenant_id, subscriber_id, subject, description, category, priority, assigned_to, status, created_at
├── radius_accounting
│   └── id, tenant_id, subscriber_id, session_id, nas_ip, start_time, stop_time, bytes_in, bytes_out, terminate_cause
├── notifications
│   └── id, tenant_id, subscriber_id, type, channel, message, status, sent_at
├── sms_gateways
│   └── id, tenant_id, provider, api_key, sender_id, status
├── payment_gateways
│   └── id, tenant_id, provider, credentials (encrypted JSON), status
```

---

## 6. USER FLOWS

### 6.1 ISP Operator Onboarding Flow
1. ISP signs up on platform website
2. Creates account (name, email, phone, company name)
3. Email verification
4. Selects pricing tier (or starts free trial)
5. Platform provisions tenant (RADIUS namespace, DB records)
6. Operator adds NAS device (MikroTik IP + secret)
7. Platform provides RADIUS server IP/port for MikroTik config
8. Operator configures MikroTik to point to RADIUS server
9. Operator creates first data plan
10. Operator adds first subscriber
11. Subscriber connects via PPPoE/Hotspot → authenticated by RADIUS → online

### 6.2 Subscriber Renewal Flow
1. System detects subscriber plan expiring in 3 days
2. Auto-send SMS/WhatsApp: "Your plan expires on {date}. Renew now: {link}"
3. Subscriber clicks link → Subscriber portal
4. Sees current plan, selects renewal plan
5. Redirected to payment gateway
6. Payment successful → Webhook to platform
7. Platform extends subscriber expiry date
8. RADIUS now accepts subscriber's auth requests again
9. Confirmation SMS sent

### 6.3 Voucher Purchase Flow
1. Admin generates 100 vouchers for "1-Month 50Mbps" plan
2. Prints voucher cards (PDF)
3. Distributes voucher cards via retail shops
4. Customer buys voucher card
5. Customer connects to WiFi hotspot
6. Captive portal appears
7. Customer enters voucher code
8. Platform validates code → creates subscriber account → assigns plan
9. Customer is online

---

## 7. SCREENS / UI REQUIREMENTS

### Admin Panel Screens
1. **Login / Forgot Password**
2. **Dashboard** — KPI cards, charts, recent activity, online users count
3. **Subscribers** — List view with search/filter, add/edit form, profile detail page
4. **Plans** — List, create/edit form
5. **Billing** — Invoice list, payment list, create payment
6. **Vouchers** — Generate, list, print
7. **NAS Devices** — List, add/edit
8. **Locations** — Tree view, add/edit
9. **Complaints** — Ticket list, detail view, assignment
10. **Reports** — Report selection, filters, table/chart view, export
11. **Online Users** — Real-time session list with disconnect button
12. **Settings** — Company profile, payment gateway config, SMS gateway config, notification templates, user management, RBAC
13. **Captive Portal** — Template editor, preview
14. **Leads** — Lead list, add/edit, convert to subscriber

### Subscriber Portal Screens
1. Login (phone + OTP or username + password)
2. Dashboard — Plan info, usage, expiry
3. Billing — Invoice list, pay now
4. Complaints — List, create
5. Profile — Edit personal info

### Super Admin Screens
1. Tenant list — status, plan, subscriber count, revenue
2. Tenant detail — usage metrics, settings
3. System monitoring — RADIUS health, API health
4. Platform settings — pricing tiers, global configs
