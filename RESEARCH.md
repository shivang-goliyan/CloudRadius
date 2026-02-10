# XceedNet — Deep Dive Research Document

**Date:** February 2026
**Purpose:** Comprehensive product analysis for building an exact SaaS clone

---

## 1. COMPANY OVERVIEW

**Company:** Xceednet Software Solutions Pvt. Ltd.
**HQ:** Office No. 102, 1st Floor, Vinayak Blessings, 90 Feet Road, Mulund (East) Mumbai - 400081, India
**US Entity:** XceedNet LLC, 101 Eisenhower Pkwy Ste 300, Roseland, NJ 07068
**Contact:** sales@xceednet.com | 080 6914 1515 | WhatsApp: +918069141500
**Developer:** Dipesh Jain (iOS app credits)
**Founded:** ~2019 (earliest app presence)
**Employees:** Small team (77 LinkedIn followers)
**Target Markets:** India (primary), Kenya, D.R. Congo, Cameroon, Ghana, Nigeria, South Sudan, Tanzania

---

## 2. WHAT THE PRODUCT IS

XceedNet is a **cloud-hosted RADIUS-based ISP billing, subscriber management, and bandwidth management SaaS platform**. It is an OSS/BSS (Operations Support System / Business Support System) solution for:

- Internet Service Providers (ISPs / WISPs)
- WiFi Hotspot operators
- Venue WiFi managers (hotels, hospitals, restaurants, educational institutions, libraries, retail, public WiFi)

**Core Technical Architecture:**
- Cloud-hosted FreeRADIUS (or similar RADIUS server) on AWS
- ISP operators connect their MikroTik routers to XceedNet's cloud RADIUS
- RADIUS handles Authentication, Authorization, and Accounting (AAA)
- Supports PPPoE (Point-to-Point Protocol over Ethernet) and Hotspot authentication modes
- The ISP operator needs ZERO on-premise servers — just MikroTik router(s)

**Business Model:** Multi-tenant SaaS — each ISP operator gets their own tenant/account with sub-users, subscribers, and isolated data.

---

## 3. COMPLETE FEATURE MAP

### 3.1 Subscriber / Customer Management
- Add/Edit/Delete subscribers (end-users of the ISP)
- Subscriber profiles with full details (name, address, phone, email, location, plan, MAC, IP)
- Subscriber lifecycle management: Lead → Onboarding → Active → Expired → Disabled
- Bulk import/export via CSV/Excel
- Migration from other RADIUS server databases
- Subscriber can have multiple devices
- 360° customer view (usage, billing, complaints, plan history)

### 3.2 Authentication Methods
- **PPPoE Authentication** — Username/password via PPPoE protocol on MikroTik
- **Hotspot Authentication** — Captive portal login page
- **IP-based Authentication** — Static IP binding
- **MAC-based Authentication** — MAC address binding (no login required)
- **OTP Authentication** — One-Time Password via SMS for hotspot login
- **PIN/Voucher Authentication** — Pre-generated voucher codes for access
- **PM-WANI Token Flow** — India's government public WiFi scheme integration

### 3.3 Data Plan / Package Management
- Create unlimited customized data plans
- Parameters per plan:
  - Upload speed limit (Kbps/Mbps)
  - Download speed limit (Kbps/Mbps)
  - Data quota (MB/GB/Unlimited)
  - Time duration (hourly, daily, weekly, monthly, custom)
  - Time slots (e.g., night-only plans, 6PM-6AM)
  - Fair Usage Policy (FUP) — reduce speed after data cap
  - Validity period
  - Price
- Billing models: Prepaid, Postpaid, Usage-based, Prorated, Pay-as-you-go
- Plan assignment to individual subscribers
- Plan auto-expiry and auto-renewal

### 3.4 Bandwidth Management & Control
- Real-time traffic monitoring per subscriber
- Per-plan speed limits enforced via RADIUS attributes on MikroTik
- FUP (Fair Usage Policy) enforcement — auto speed throttle after quota
- Bandwidth allocation per subscriber
- Upload/Download independent rate limits
- Burst speed support (MikroTik queue parameters)

### 3.5 Billing & Invoicing
- Auto-generate invoices on plan assignment/renewal
- Track payments (paid, pending, overdue)
- Payment history per subscriber
- Invoice PDF generation
- Flexible billing cycles
- Prorated billing for mid-cycle changes
- Subscriber self-service online payment for renewals

### 3.6 Payment Gateway Integration
- **Indian Gateways:** Razorpay, PayTM, PhonePe, Cashfree, CCAvenue, BillDesk, PayUMoney, Atom, Swipez, PortPOS, NPay
- **African Gateways:** MPesa, Hubtel, Flutterwave, Selcom
- UPI support
- Debit/Credit card support
- Online subscriber self-renewal via payment link

### 3.7 Voucher / PIN Management
- Generate bulk vouchers/PINs
- Voucher parameters: plan, validity, one-time or multi-use
- Print voucher cards
- Sell vouchers to subscribers for self-activation
- Track voucher usage and status

### 3.8 CRM & Helpdesk
- Complaint ticket creation (by admin or subscriber)
- Assign tickets to service personnel
- Track ticket status (Open → Assigned → In Progress → Resolved)
- SMS notifications on ticket status changes
- Complaint history per subscriber
- Internal notes on tickets

### 3.9 SMS/Email/WhatsApp Gateway Integration
- Integrate operator's own SMS gateway account
- Automated notifications:
  - New plan activation
  - Plan expiry warning
  - Plan expired notification
  - Payment received confirmation
  - Payment due reminder
  - OTP for authentication
  - Complaint ticket status updates
  - New offer announcements
- WhatsApp integration for notifications
- Email notifications

### 3.10 Reporting & Analytics
- Subscriber reports (active, expired, disabled, new, churn)
- Billing/revenue reports
- Collection reports
- Usage reports (data consumed per subscriber)
- Plan-wise subscriber distribution
- Location-wise reports
- Daily/weekly/monthly/custom date range
- Export reports to Excel/CSV
- Dashboard with key metrics

### 3.11 Captive Portal / Hotspot Management
- Customizable captive portal login page
- Branded portal with ISP's logo and colors
- Portal page integration with ISP's own domain
- Multiple login methods on portal (OTP, voucher, username/password)
- Redirect after login (to ISP website, promotions, etc.)
- Terms of Service acceptance
- Feedback/survey page on portal

### 3.12 Syslog / Usage Logging
- Log subscriber usage (session start, stop, duration, data consumed)
- Cloud-hosted syslogs storage
- Syslog viewer in admin panel
- Usage history per subscriber
- Compliance logging (required by telecom regulations in India)

### 3.13 Multi-Location / Franchise Management
- Manage multiple NAS (Network Access Servers / routers)
- Location hierarchy (Region → City → Area → NAS)
- Franchise operator accounts with limited access
- Per-location reporting and analytics
- Scale across multiple cities/states

### 3.14 White-Label / Custom Domain
- Seamless integration with ISP's existing website
- Custom domain for subscriber portal (subscribers.yourisp.com)
- Branded login page, dashboard, and portal
- ISP's own branding throughout

### 3.15 Mobile Apps
- **Subscriber App** (iOS + Android):
  - View account details and plan info
  - Check usage and billing
  - Renew/buy plans online
  - View complaints and raise new ones
  - View invoices
- **Admin App** (Android — discontinued as of 2023):
  - Manage subscribers
  - View reports
  - Quick actions (renew, disable, etc.)
- White-labeled subscriber apps for individual ISPs (e.g., "ZEE FIBER", "cNc Broadband", "PiNG Subscriber" — all built by XceedNet for specific ISPs)

### 3.16 PM-WANI Integration (India-specific)
- Registered App Provider for PM-WANI scheme
- PDO (Public Data Office) management
- PDOA (Public Data Office Aggregator) features
- WANI token flow implementation
- Integration with Central Registry
- OTP-based user authentication per PM-WANI guidelines
- Nearby hotspot discovery
- Data sachet purchase via captive portal

### 3.17 NAS / Router Management
- Add/manage MikroTik NAS devices
- NAS connection status monitoring
- NAS configuration assistance
- Support for MikroTik RouterOS
- Support for Ubiquiti, NetGear, Cisco (via standard RADIUS)
- RouterOS installable on PC/Server for larger deployments

### 3.18 User Roles & Access Control
- Super Admin (XceedNet platform level)
- ISP Operator Admin
- ISP Staff with limited permissions
- Franchise operators with scoped access
- Subscriber self-service portal access

---

## 4. PRICING MODEL

| Tier | Max Online Subscribers | Syslogs | Subscriber Accounts | Infrastructure |
|------|----------------------|---------|-------------------|----------------|
| Bronze | 50 | Included | Unlimited | Cloud (MikroTik only) |
| Silver | 100 | Included | Unlimited | Cloud (MikroTik only) |
| Gold | 200 | Included | Unlimited | Cloud (MikroTik only) |
| Platinum | Unlimited | Included | Unlimited (pay per active) | Cloud (MikroTik only) |

- "Click for best price" — no public pricing, sales-driven
- Platinum charges only for active subscribers, not expired/disabled
- All plans include unlimited subscriber accounts (can create unlimited, limit is on concurrent online)
- 1-week free trial available

---

## 5. TECHNICAL ARCHITECTURE (Inferred)

### Backend Stack (Inferred from behavior and industry norms)
- **RADIUS Server:** FreeRADIUS (industry standard, open source)
- **Database:** MySQL/MariaDB (FreeRADIUS default) or PostgreSQL
- **Cloud:** Amazon AWS (EC2, RDS, S3, CloudWatch)
- **Backend:** Likely PHP/Laravel or Node.js (common in Indian ISP tools)
- **Admin Panel:** Web-based (admin.xceednet.com)
- **API:** REST APIs for mobile apps and integrations
- **MikroTik Integration:** RADIUS protocol (RFC 2865/2866) with MikroTik-specific VSAs (Vendor-Specific Attributes)

### How RADIUS Integration Works
1. ISP installs MikroTik router at their location
2. MikroTik is configured as a RADIUS client pointing to XceedNet's RADIUS server IP
3. When subscriber connects (PPPoE or Hotspot), MikroTik sends Access-Request to XceedNet RADIUS
4. RADIUS checks username/password/MAC against database
5. RADIUS returns Access-Accept with rate-limit attributes (Mikrotik-Rate-Limit VSA)
6. MikroTik applies bandwidth limits and grants access
7. Accounting packets (Start/Interim-Update/Stop) are sent for usage tracking
8. Session data (bytes in/out, time) is logged for billing and compliance

### Key RADIUS Attributes Used
- `Mikrotik-Rate-Limit` — bandwidth control
- `Session-Timeout` — time-based plans
- `Acct-Interim-Interval` — usage update frequency
- `Framed-IP-Address` — static IP assignment
- `Calling-Station-Id` — MAC address
- `NAS-IP-Address` — router identification

---

## 6. USE CASES / VERTICALS

1. **ISP / WISP** — Primary use case. Manage broadband subscribers with PPPoE.
2. **Hotels** — Guest WiFi with captive portal, room-based access, paid/free tiers.
3. **Hospitals** — Patient/visitor WiFi, department-based access, time-limited plans.
4. **Educational Institutes** — Student/faculty WiFi, quota-based access, content filtering.
5. **Restaurants/Cafes** — Free WiFi with captive portal, social login, marketing.
6. **Libraries** — Time-limited free access, usage logging.
7. **Retail Stores** — Customer WiFi, data collection, marketing portal.
8. **Public WiFi / PM-WANI** — Government scheme compliance, paid hotspots.

---

## 7. COMPETITIVE LANDSCAPE

| Competitor | Region | Key Differentiator |
|-----------|--------|-------------------|
| XenFi | East Africa | Mobile money integration, multi-vendor RADIUS |
| Splynx | Global | Full-blown ISP billing with scheduling, Mikrotik+Ubiquiti |
| WISPControl | Global | Mikrotik cloud management |
| Powerlynx (MikroTik) | Global | Official MikroTik cloud platform |
| Nanovise | India | PM-WANI focused |
| Netwall Expert | India | PM-WANI + ISP billing |
| Antamedia | Global | WiFi user management, hotel-focused |
| Enea Aptilo SMP | Enterprise | Enterprise-grade WiFi subscriber management |

---

## 8. STRENGTHS TO REPLICATE

1. **Zero infra for ISP** — cloud RADIUS eliminates on-premise servers
2. **MikroTik-first** — MikroTik is dominant in India/Africa ISP market
3. **Pay-per-active model** — ISPs only pay for active subscribers
4. **White-label apps** — ISPs get branded subscriber apps
5. **Comprehensive payment gateways** — India + Africa coverage
6. **PM-WANI compliance** — Indian government scheme support
7. **Simple onboarding** — router configured in minutes by support team
8. **Multi-tenant** — single platform serves hundreds of ISPs

---

## 9. WEAKNESSES / GAPS TO IMPROVE ON

1. No public pricing — friction in sales funnel
2. Android admin app discontinued since 2023
3. Limited self-service — relies heavily on manual support team
4. No visible API documentation for third-party integrations
5. No modern dashboard UI (appears dated based on admin portal)
6. No real-time network monitoring (SNMP, ping, uptime)
7. No ticketing SLA management
8. No multi-language support visible
9. No modern auth (OAuth2, SSO) for admin panel
10. No webhook/event system for integrations
