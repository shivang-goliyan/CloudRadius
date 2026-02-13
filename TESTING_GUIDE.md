# CloudRadius — Complete Testing Guide (Phase 0–7)

**Last Updated:** February 2026
**Purpose:** Step-by-step manual testing instructions for every feature, function, and flow in CloudRadius.
**Goal:** Zero errors, zero broken flows, zero regressions.

---

## Table of Contents

- [Prerequisites & Environment Setup](#prerequisites--environment-setup)
- [Phase 0: Infrastructure & Authentication](#phase-0-infrastructure--authentication)
- [Phase 1: Subscriber & Plan Management](#phase-1-subscriber--plan-management)
- [Phase 2: RADIUS Integration](#phase-2-radius-integration)
- [Phase 3: Billing & Payments](#phase-3-billing--payments)
- [Phase 4: Vouchers, Tickets, Leads, Sessions](#phase-4-vouchers-tickets-leads-sessions)
- [Phase 5: Notifications (SMS/Email)](#phase-5-notifications-smsemail)
- [Phase 6: Dashboard, Reports, Portal](#phase-6-dashboard-reports-portal)
- [Phase 7: RBAC, Super Admin, Settings, UI Polish](#phase-7-rbac-super-admin-settings-ui-polish)
- [Cross-Cutting Concerns](#cross-cutting-concerns)
- [Known Issues & Workarounds](#known-issues--workarounds)

---

## Prerequisites & Environment Setup

### 1. Start Infrastructure Services

```bash
# Start PostgreSQL, Redis, FreeRADIUS
docker compose up -d
```

**Expected output — 3 services must start:**
```
 ✔ Container cloudradius-db      Healthy
 ✔ Container cloudradius-redis   Running
 ✔ Container cloudradius-radius  Started
```

If you only see 2 containers, check which one failed:
```bash
# Show ALL containers including crashed ones
docker compose ps -a

# If freeradius shows "Restarting", check its logs:
docker logs cloudradius-radius 2>&1 | tail -30
```

**Verify each service individually:**

#### 1a. PostgreSQL (port 5432)

```bash
# Check PostgreSQL is accepting connections
docker exec cloudradius-db pg_isready -U cloudradius
```
- [ ] Output: `/var/run/postgresql:5432 - accepting connections`

```bash
# Verify you can connect and query
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT version();"
```
- [ ] Output shows `PostgreSQL 16.x` version string

```bash
# Verify the port is accessible from host machine
nc -zv localhost 5432
```
- [ ] Output: `Connection to localhost 5432 port [tcp/postgresql] succeeded!`

#### 1b. Redis (port 6379)

```bash
# Ping Redis
docker exec cloudradius-redis redis-cli ping
```
- [ ] Output: `PONG`

```bash
# Check Redis info (memory, connections)
docker exec cloudradius-redis redis-cli info server | head -5
```
- [ ] Output shows `redis_version:7.x.x`

```bash
# Verify port accessible from host
nc -zv localhost 6379
```
- [ ] Output: `Connection to localhost 6379 port [tcp] succeeded!`

#### 1c. FreeRADIUS (ports 1812/UDP, 1813/UDP, 3799/UDP)

```bash
# Check container is running (NOT restarting)
docker inspect cloudradius-radius --format='{{.State.Status}}'
```
- [ ] Output: `running` (NOT `restarting`)

```bash
# Check uptime — should be increasing, not resetting to 0
docker inspect cloudradius-radius --format='{{.State.StartedAt}}'
```
- [ ] Timestamp should be stable (not changing every few seconds)

```bash
# Verify FreeRADIUS connected to PostgreSQL (check recent logs)
docker logs cloudradius-radius 2>&1 | tail -10
```
- [ ] If empty (FreeRADIUS in daemon mode), that's OK — the key test is it stays running

```bash
# Verify UDP ports are listening
ss -ulnp | grep -E '1812|1813|3799'
```
- [ ] Shows 1812, 1813, and 3799 UDP ports bound

**Troubleshooting FreeRADIUS:**
If FreeRADIUS keeps restarting, run it in debug mode to see the actual error:
```bash
docker compose stop freeradius
docker run --rm --network cloudradius_default \
  -v ./radius/radiusd.conf:/etc/freeradius/radiusd.conf:ro \
  -v ./radius/clients.conf:/etc/freeradius/clients.conf:ro \
  -v ./radius/sql.conf:/etc/freeradius/mods-enabled/sql:ro \
  -v ./radius/dictionary.mikrotik:/etc/freeradius/dictionary.mikrotik:ro \
  -v ./radius/default:/etc/freeradius/sites-enabled/default:ro \
  -e POSTGRES_HOST=postgres \
  -e POSTGRES_USER=cloudradius \
  -e POSTGRES_PASSWORD=cloudradius \
  -e POSTGRES_DB=cloudradius \
  freeradius/freeradius-server:latest freeradius -X 2>&1 | tail -30
```
Look for lines containing `Error` or `Failed`. Common issues:
- `Failed to find "sql"` → sql.conf not mounted to `mods-enabled/` (must NOT be `mods-available/`)
- `column "server" does not exist` → run `npx prisma db push` to sync schema
- `Connection refused` → PostgreSQL not ready yet, restart FreeRADIUS after DB is healthy

---

### 2. Database Setup

#### 2a. Generate Prisma Client

```bash
npx prisma generate
```
- [ ] Output: `✔ Generated Prisma Client (v5.22.0) to ./src/generated/prisma`

Verify the generated client exists:
```bash
ls src/generated/prisma/index.js
```
- [ ] File exists (not "No such file or directory")

#### 2b. Run Migrations

If this is a **fresh database** (first time or after `docker compose down -v`):
```bash
npx prisma migrate dev
```
- [ ] All migrations applied successfully
- [ ] Seed script runs automatically at the end

If you see "Drift detected" with a prompt to reset — type `yes` (this drops and recreates all tables).

**IMPORTANT:** `migrate dev` runs the seed script automatically. Do NOT run `npx prisma db seed` separately afterward — it will fail with a unique constraint error because data already exists.

If you need to **re-seed** an existing database:
```bash
# This resets DB + applies migrations + seeds in one step
npx prisma migrate reset
```

#### 2c. Verify Database Tables Exist

```bash
# List all tables in the database
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "\dt"
```
- [ ] Should show 30 tables including: `tenants`, `users`, `subscribers`, `plans`, `nas_devices`, `invoices`, `payments`, `vouchers`, `tickets`, `leads`, `radcheck`, `radgroupreply`, `radusergroup`, `nas`, `radacct`, etc.

#### 2d. Verify Seed Data with SQL Queries

Run each command and verify the expected counts:

```bash
# Tenants (expected: 1)
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT name, slug, status FROM tenants;"
```
- [ ] 1 row: `Demo ISP | demo-isp | ACTIVE`

```bash
# Users (expected: 3)
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT name, email, role FROM users ORDER BY role;"
```
- [ ] 3 rows:
  - `Staff User | staff@demo-isp.com | STAFF`
  - `Super Admin | admin@cloudradius.com | SUPER_ADMIN`
  - `Admin User | admin@demo-isp.com | TENANT_ADMIN`

```bash
# Locations (expected: 6 — 1 region, 2 cities, 3 areas)
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT name, type FROM locations ORDER BY type, name;"
```
- [ ] 6 rows with types: AREA (×3), CITY (×2), REGION (×1)

```bash
# Plans (expected: 5)
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT name, price, download_speed, upload_speed, status FROM plans ORDER BY price;"
```
- [ ] 5 rows: Basic, Standard, Premium, FUP, Hotspot plans

```bash
# NAS Devices (expected: 3)
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT name, nas_ip, nas_type, status FROM nas_devices;"
```
- [ ] 3 rows with different IPs and MikroTik types

```bash
# Subscribers (expected: 8)
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT name, username, status FROM subscribers ORDER BY name;"
```
- [ ] 8 rows with mix of ACTIVE, EXPIRED, SUSPENDED, DISABLED statuses

```bash
# Vouchers (expected: 20 in 1 batch)
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT batch_number, COUNT(*) as vouchers FROM voucher_batches vb JOIN vouchers v ON v.batch_id = vb.id GROUP BY batch_number;"
```
- [ ] 1 row: `BATCH-001 | 20`

```bash
# Tickets (expected: 5)
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT ticket_number, subject, status, priority FROM tickets ORDER BY ticket_number;"
```
- [ ] 5 rows: TKT-001 through TKT-005

```bash
# Leads (expected: 5)
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT name, phone, status, source FROM leads ORDER BY name;"
```
- [ ] 5 rows with various statuses and sources

```bash
# Captive Portal Config (expected: 1)
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT is_enabled, welcome_title FROM captive_portal_configs;"
```
- [ ] 1 row with captive portal settings

#### 2e. Verify RADIUS Tables

```bash
# radcheck — subscriber credentials for FreeRADIUS auth
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT username, attribute, op FROM radcheck LIMIT 5;"
```
- [ ] Should show entries like `demo-isp_<username> | Cleartext-Password | :=`

```bash
# radgroupreply — plan bandwidth attributes
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT groupname, attribute, value FROM radgroupreply LIMIT 5;"
```
- [ ] Should show `Mikrotik-Rate-Limit` attributes with speed values

```bash
# radusergroup — subscriber-to-plan mapping
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT username, groupname FROM radusergroup LIMIT 5;"
```
- [ ] Entries mapping subscriber usernames to plan groups

```bash
# nas — NAS devices for FreeRADIUS client auth
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT nasname, shortname, type, secret FROM nas;"
```
- [ ] 3 rows matching the NAS devices from seed

**If RADIUS tables are empty**, run the RADIUS seed script:
```bash
npx tsx scripts/seed-radius.ts
```

#### 2f. Optional — Prisma Studio (Visual Inspection)

```bash
npx prisma studio
# Opens browser at http://localhost:5555
```
- [ ] Can browse all tables visually
- [ ] Data matches the SQL query counts above

---

### 3. Environment Variables

Your `.env` file should already be configured from development. Verify all required variables are present:

```bash
# Print all env variable NAMES (values masked for security)
grep -v '^#' .env | grep -v '^$' | sed 's/=.*/=✓/' | sort
```

**Expected output — all these variables must show `=✓`:**

```
AUTH_TRUST_HOST=✓
DATABASE_URL=✓
NEXTAUTH_SECRET=✓
NEXTAUTH_URL=✓
NEXT_PUBLIC_APP_NAME=✓
NEXT_PUBLIC_APP_URL=✓
REDIS_URL=✓
```

#### 3a. Verify Critical Variable Values

```bash
# Check DATABASE_URL points to correct PostgreSQL
grep DATABASE_URL .env
```
- [ ] Contains: `postgresql://cloudradius:cloudradius@localhost:5432/cloudradius`

```bash
# Check REDIS_URL
grep REDIS_URL .env
```
- [ ] Contains: `redis://localhost:6379`

```bash
# Check NEXTAUTH_URL matches your dev URL
grep NEXTAUTH_URL .env
```
- [ ] Contains: `http://localhost:3000`

```bash
# Verify NEXTAUTH_SECRET is set (not empty)
grep NEXTAUTH_SECRET .env | wc -c
```
- [ ] Output is > 20 (a proper secret is 32+ hex chars)

```bash
# Check app name and URL
grep NEXT_PUBLIC .env
```
- [ ] `NEXT_PUBLIC_APP_NAME=CloudRadius`
- [ ] `NEXT_PUBLIC_APP_URL=http://localhost:3000`

#### 3b. Verify Database Connectivity from App

```bash
# Quick test — Prisma can connect to the database
npx prisma db execute --stdin <<< "SELECT 1 AS connected;"
```
- [ ] No error output (means connection successful)

#### 3c. Verify Redis Connectivity

```bash
# Quick test from host machine
redis-cli -u redis://localhost:6379 ping
```
- [ ] Output: `PONG`

If `redis-cli` is not installed on host, use Docker:
```bash
docker exec cloudradius-redis redis-cli ping
```

#### 3d. Full Environment Variable Reference

| Variable | Required | Purpose | Example Value |
|----------|----------|---------|---------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string | `postgresql://cloudradius:cloudradius@localhost:5432/cloudradius` |
| `REDIS_URL` | Yes | Redis connection for BullMQ jobs | `redis://localhost:6379` |
| `NEXTAUTH_SECRET` | Yes | JWT signing secret (32+ hex chars) | Generate: `openssl rand -hex 32` |
| `NEXTAUTH_URL` | Yes | Base URL for NextAuth callbacks | `http://localhost:3000` |
| `AUTH_TRUST_HOST` | Dev only | Trust host header in dev | `true` |
| `NEXT_PUBLIC_APP_URL` | Yes | Public-facing app URL | `http://localhost:3000` |
| `NEXT_PUBLIC_APP_NAME` | Yes | App display name | `CloudRadius` |
| `RADIUS_SERVER_IP` | Optional | RADIUS server IP for display | `127.0.0.1` |
| `RADIUS_AUTH_PORT` | Optional | RADIUS auth port | `1812` |
| `RADIUS_ACCT_PORT` | Optional | RADIUS accounting port | `1813` |
| `RADIUS_COA_PORT` | Optional | RADIUS CoA port | `3799` |
| `SMTP_HOST` | Optional | SMTP server for emails | `smtp.gmail.com` |
| `SMTP_PORT` | Optional | SMTP port | `587` |
| `SMTP_USER` | Optional | SMTP username | `you@gmail.com` |
| `SMTP_PASSWORD` | Optional | SMTP password / app password | `xxxx xxxx xxxx xxxx` |
| `OTP_EXPIRY_MINUTES` | Optional | OTP validity duration | `5` |
| `OTP_MAX_ATTEMPTS` | Optional | Max OTP retry attempts | `3` |
| `SENTRY_DSN` | Optional | Error tracking (production) | `https://xxx@sentry.io/xxx` |
| `AWS_ACCESS_KEY_ID` | Optional | S3 file uploads | — |
| `AWS_SECRET_ACCESS_KEY` | Optional | S3 file uploads | — |
| `AWS_REGION` | Optional | S3 region | `ap-south-1` |
| `AWS_S3_BUCKET` | Optional | S3 bucket name | `cloudradius-uploads` |

**Note:** Optional variables are only needed for specific features (email sending, OTP login, file uploads, error tracking). Core app functionality works without them.

---

### 4. Start the Application

#### 4a. Install Dependencies (if not already done)

```bash
pnpm install
```
- [ ] No errors, all packages installed

#### 4b. Start Dev Server

```bash
pnpm dev
```

**Expected terminal output:**
```
  ▲ Next.js 15.x (Turbopack)
  - Local:   http://localhost:3000
  - Network: http://192.168.x.x:3000

 ✓ Starting...
 ✓ Ready in Xms
```

**Verify in browser:**
```bash
# Quick check from terminal (should return HTML)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login
```
- [ ] Output: `200`

**Verify in browser manually:**
1. Open `http://localhost:3000`
- [ ] Redirects to `/login` (unauthenticated users get redirected)
- [ ] Login page renders with email/password fields and "Sign In" button
- [ ] No errors in browser DevTools Console (F12 → Console tab)
- [ ] No failed network requests in DevTools Network tab (F12 → Network tab)

#### 4c. Start Background Worker (separate terminal)

Open a **second terminal** and run:
```bash
cd ~/Development\ And\ Hacking/Product-Build/CloudRadius
pnpm worker
```

**Expected output:**
```
Worker started, waiting for jobs...
```
- [ ] Worker starts without errors
- [ ] Worker stays running (doesn't crash)

**Note:** The worker handles background jobs for SMS, email, and notifications. If you skip this step, notifications and automated emails will queue up but never send.

#### 4d. Verify All Services Running (Final Checklist)

At this point you should have 5 things running:

| Service | How to check | Expected |
|---------|-------------|----------|
| PostgreSQL | `docker exec cloudradius-db pg_isready -U cloudradius` | "accepting connections" |
| Redis | `docker exec cloudradius-redis redis-cli ping` | "PONG" |
| FreeRADIUS | `docker inspect cloudradius-radius --format='{{.State.Status}}'` | "running" |
| Next.js dev server | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login` | "200" |
| BullMQ worker | Check the worker terminal | "Worker started, waiting for jobs..." |

---

### 5. Build Verification

```bash
# Run production build to catch TypeScript errors
pnpm build
```

- [ ] Build completes with `✓ Compiled successfully`
- [ ] 0 TypeScript errors
- [ ] All routes compiled (should be ~69 routes)
- [ ] No warnings about missing modules

```bash
# Quick lint check
pnpm lint
```
- [ ] No lint errors (warnings are OK)

---

## Phase 0: Infrastructure & Authentication

### Test 0.1: Login — Valid Credentials

**Steps:**
1. Navigate to `http://localhost:3000/login`
2. Enter email: `admin@demo-isp.com`
3. Enter password: `demo123`
4. Click "Sign In"

**Expected:**
- [ ] Loading spinner appears on button
- [ ] Redirects to `/dashboard`
- [ ] Sidebar shows navigation items
- [ ] Topbar shows "Demo ISP" tenant badge
- [ ] Topbar shows user name and role "Admin"

### Test 0.2: Login — Invalid Credentials

**Steps:**
1. Navigate to `/login`
2. Enter email: `admin@demo-isp.com`
3. Enter password: `wrongpassword`
4. Click "Sign In"

**Expected:**
- [ ] Toast notification appears: "Invalid email or password"
- [ ] User stays on login page
- [ ] Form is not cleared (email field retains value)
- [ ] No redirect occurs

### Test 0.3: Login — Non-Existent User

**Steps:**
1. Enter email: `nobody@example.com`
2. Enter password: `anything`
3. Click "Sign In"

**Expected:**
- [ ] Toast: "Invalid email or password" (same message — don't reveal whether email exists)
- [ ] User stays on login page

### Test 0.4: Login — Super Admin

**Steps:**
1. Enter email: `admin@cloudradius.com`
2. Enter password: `admin123`
3. Click "Sign In"

**Expected:**
- [ ] Redirects to `/super-admin/dashboard` (NOT `/dashboard`)
- [ ] Super admin sidebar shows "Dashboard" and "Tenants"
- [ ] Cannot navigate to `/dashboard` (redirects back to `/super-admin/dashboard`)

### Test 0.5: Login — Staff User

**Steps:**
1. Enter email: `staff@demo-isp.com`
2. Enter password: `staff123`
3. Click "Sign In"

**Expected:**
- [ ] Redirects to `/dashboard`
- [ ] Sidebar shows limited navigation based on STAFF role permissions
- [ ] Cannot access super-admin routes

### Test 0.6: Registration — New Tenant

**Steps:**
1. Navigate to `/register`
2. Fill in:
   - Full Name: `Test User`
   - Company/ISP Name: `Test ISP`
   - Email: `test@testisp.com`
   - Phone: `9876543210`
   - Password: `testpassword123`
3. Click "Create Account"

**Expected:**
- [ ] Toast: "Account created successfully!"
- [ ] Redirects to `/login`
- [ ] Can login with `test@testisp.com` / `testpassword123`
- [ ] After login, dashboard shows "Test ISP" in topbar
- [ ] Tenant has TRIAL status and STARTER tier

**Verify in Prisma Studio:**
- [ ] New `Tenant` record with slug `test-isp`, status `TRIAL`, tier `STARTER`
- [ ] New `User` record with role `TENANT_ADMIN`
- [ ] `trialEndsAt` is ~7 days from now

### Test 0.7: Registration — Duplicate Email

**Steps:**
1. Navigate to `/register`
2. Use email: `admin@demo-isp.com` (already exists)
3. Fill other fields with valid data
4. Click "Create Account"

**Expected:**
- [ ] Toast error: "Email already exists" or similar
- [ ] User stays on register page
- [ ] No new tenant created

### Test 0.8: Registration — Duplicate Company Name

**Steps:**
1. Navigate to `/register`
2. Use company name: `Demo ISP` (slug "demo-isp" already exists)
3. Use a new email address
4. Click "Create Account"

**Expected:**
- [ ] Toast error: "Company name already taken" or similar
- [ ] No new records created

### Test 0.9: Session Persistence

**Steps:**
1. Login as tenant admin
2. Close browser tab (don't logout)
3. Open new tab, navigate to `http://localhost:3000`

**Expected:**
- [ ] Redirects to `/dashboard` (session persisted)
- [ ] User info shown in topbar

### Test 0.10: Logout

**Steps:**
1. Login as any user
2. Click user avatar/name in topbar
3. Click "Sign Out"

**Expected:**
- [ ] Redirects to `/login`
- [ ] Navigating to `/dashboard` redirects back to `/login`
- [ ] Session cookie cleared

### Test 0.11: Protected Route Access (Unauthenticated)

**Steps:**
1. Logout or clear cookies
2. Navigate directly to `http://localhost:3000/dashboard`

**Expected:**
- [ ] Redirected to `/login?callbackUrl=%2Fdashboard`
- [ ] After login, redirected back to `/dashboard`

### Test 0.12: Protected Route Access (Wrong Role)

**Steps:**
1. Login as tenant admin (`admin@demo-isp.com`)
2. Navigate to `http://localhost:3000/super-admin/dashboard`

**Expected:**
- [ ] Redirected to `/dashboard` (blocked from super-admin routes)

**Reverse test:**
1. Login as super admin (`admin@cloudradius.com`)
2. Navigate to `http://localhost:3000/dashboard`

**Expected:**
- [ ] Redirected to `/super-admin/dashboard`

### Test 0.13: Root Layout — Theme & Toast

**Steps:**
1. Login to the app
2. Check that the Inter font is applied to text
3. Trigger an action that shows a toast (e.g., login with wrong password)

**Expected:**
- [ ] Toast appears at top-right with close button
- [ ] Toast has rich colors (success=green, error=red)
- [ ] Multiple toasts stack vertically

### Test 0.14: Admin Layout — Responsive

**Steps:**
1. Open browser DevTools → Toggle device toolbar
2. Set to iPhone 14 Pro (390×844)
3. Navigate through the app

**Expected:**
- [ ] Sidebar is hidden on mobile
- [ ] Hamburger menu icon appears in topbar
- [ ] Clicking hamburger opens slide-in sidebar overlay
- [ ] Clicking a nav link closes the mobile sidebar
- [ ] Content fills full width on mobile

---

## Phase 1: Subscriber & Plan Management

### Test 1.1: View Subscribers List

**Steps:**
1. Login as tenant admin
2. Click "Subscribers" in sidebar

**Expected:**
- [ ] Loading skeleton appears briefly
- [ ] Data table renders with subscriber list
- [ ] Columns visible: Name, Username, Phone, Plan, Status, Expiry, Actions
- [ ] 8 seed subscribers visible
- [ ] Status badges color-coded (Active=green, Expired=red, Suspended=amber, Disabled=gray)

### Test 1.2: Search Subscribers

**Steps:**
1. On subscribers page, type in search input: `Rahul`

**Expected:**
- [ ] Table filters to show matching subscribers
- [ ] Clearing search shows all subscribers

### Test 1.3: Filter Subscribers by Status

**Steps:**
1. On subscribers page, use status dropdown → select "Active"

**Expected:**
- [ ] Only ACTIVE subscribers displayed
- [ ] Count updates accordingly

### Test 1.4: Create New Subscriber

**Steps:**
1. Click "Add Subscriber" button
2. Fill Personal Info:
   - Name: `New Subscriber`
   - Phone: `9999888877`
   - Email: `new@example.com`
   - Address: `123 Test Street`
3. Fill Connection Info:
   - Username: `newsub`
   - Password: `password123`
   - Connection Type: `PPPoE`
4. Fill Plan & Network:
   - Plan: Select "Basic 30Mbps"
   - NAS Device: Select any device
   - Location: Select any area
5. Fill Dates:
   - Activation Date: Today
   - Expiry Date: 30 days from today
6. Click "Save"

**Expected:**
- [ ] Form validates all required fields
- [ ] Toast: "Subscriber created successfully"
- [ ] New subscriber appears in table
- [ ] Status = ACTIVE

**Verify in Prisma Studio:**
- [ ] `Subscriber` record created with correct `tenantId`
- [ ] Password is bcrypt-hashed (not plaintext)
- [ ] `planId`, `nasDeviceId`, `locationId` correctly set

### Test 1.5: Edit Subscriber

**Steps:**
1. Find a subscriber in the table
2. Click Actions → Edit
3. Change the phone number to `1111222233`
4. Click "Save"

**Expected:**
- [ ] Toast: "Subscriber updated successfully"
- [ ] Table shows updated phone number
- [ ] Other fields unchanged

### Test 1.6: Change Subscriber Status

**Steps:**
1. Find an ACTIVE subscriber
2. Click Actions → Suspend

**Expected:**
- [ ] Status changes to SUSPENDED
- [ ] Badge color changes to amber/yellow

Then:
3. Click Actions → Activate

**Expected:**
- [ ] Status changes back to ACTIVE
- [ ] Badge color changes to green

### Test 1.7: Delete (Soft Delete) Subscriber

**Steps:**
1. Find a subscriber
2. Click Actions → Delete
3. Confirm deletion

**Expected:**
- [ ] Subscriber disappears from table
- [ ] Toast: "Subscriber deleted successfully"

**Verify in Prisma Studio:**
- [ ] `Subscriber.deletedAt` is set (not null) — soft deleted, not hard deleted
- [ ] `Subscriber.status` = DISABLED

### Test 1.8: View Subscriber Profile

**Steps:**
1. Click on a subscriber's name (or Actions → View)

**Expected:**
- [ ] Profile page loads at `/subscribers/[id]`
- [ ] Shows personal info, connection details, plan info
- [ ] Shows billing history (invoices)
- [ ] Shows session history (if RADIUS data exists)
- [ ] Shows payment history

### Test 1.9: Create Subscriber Without Optional Fields

**Steps:**
1. Click "Add Subscriber"
2. Fill only required fields: Name, Phone, Username, Password, Connection Type
3. Leave Plan, NAS, Location, Email, Address empty
4. Click "Save"

**Expected:**
- [ ] Subscriber created successfully
- [ ] Plan column shows "—" or empty
- [ ] No RADIUS sync errors (should skip sync if no plan)

### Test 1.10: View Plans List

**Steps:**
1. Click "Plans" in sidebar

**Expected:**
- [ ] Loading skeleton appears
- [ ] Table shows 5 seed plans
- [ ] Columns: Name, Speed (DL/UL), Price, Validity, Type, Status, Subscribers, Actions
- [ ] Speed displayed in human-readable format (e.g., "30 Mbps / 30 Mbps")

### Test 1.11: Create New Plan

**Steps:**
1. Click "Add Plan"
2. Fill required fields:
   - Name: `Test Plan 200Mbps`
   - Download Speed: `200`
   - Upload Speed: `100`
   - Speed Unit: `Mbps`
   - Price: `1499`
   - Validity: `30` days
   - Billing Type: `PREPAID`
   - Plan Type: `RESIDENTIAL`
   - Connection Type: `PPPoE`
3. Click "Save"

**Expected:**
- [ ] Toast: "Plan created successfully"
- [ ] New plan appears in table
- [ ] Status = ACTIVE

### Test 1.12: Create Plan with FUP Settings

**Steps:**
1. Click "Add Plan"
2. Fill basic fields as above
3. Expand "FUP Settings" section
4. Set:
   - Data Limit: `500` GB
   - FUP Download Speed: `10` Mbps
   - FUP Upload Speed: `5` Mbps
5. Click "Save"

**Expected:**
- [ ] Plan created with FUP attributes
- [ ] FUP details visible in plan detail/edit form

### Test 1.13: Create Plan with Burst Settings

**Steps:**
1. Click "Add Plan"
2. Fill basic fields
3. Expand "Burst Settings"
4. Set:
   - Burst Download: `250` Mbps
   - Burst Upload: `125` Mbps
   - Burst Threshold: `50` (%)
   - Burst Time: `10` seconds
5. Click "Save"

**Expected:**
- [ ] Plan created with burst attributes
- [ ] No validation errors

### Test 1.14: Toggle Plan Status

**Steps:**
1. Find an ACTIVE plan with 0 subscribers
2. Click Actions → Deactivate

**Expected:**
- [ ] Status changes to INACTIVE
- [ ] Plan no longer appears in subscriber form dropdown

### Test 1.15: Delete Plan — With Active Subscribers

**Steps:**
1. Find "Basic 30Mbps" plan (has subscribers)
2. Click Actions → Delete

**Expected:**
- [ ] Error toast: "Cannot delete plan with active subscribers"
- [ ] Plan remains in table

### Test 1.16: Delete Plan — Without Subscribers

**Steps:**
1. Create a new test plan (no subscribers assigned)
2. Click Actions → Delete
3. Confirm

**Expected:**
- [ ] Plan deleted from table
- [ ] Toast: "Plan deleted successfully"

### Test 1.17: Clone Plan

**Steps:**
1. Find any plan
2. Click Actions → Clone

**Expected:**
- [ ] Create plan form opens with all fields pre-filled from source plan
- [ ] Name field has "(Copy)" suffix or similar
- [ ] User can modify and save as new plan

### Test 1.18: View NAS Devices

**Steps:**
1. Click "NAS Devices" in sidebar

**Expected:**
- [ ] Table shows 3 seed NAS devices
- [ ] Columns: Name, IP, Type, Secret (masked), Location, Status, Actions

### Test 1.19: Create NAS Device

**Steps:**
1. Click "Add NAS"
2. Fill:
   - Name: `Test Router`
   - NAS IP: `10.0.2.1`
   - Secret: `testing123`
   - Type: `MikroTik`
   - Location: Select any area
3. Click "Save"

**Expected:**
- [ ] Toast: "NAS device created successfully"
- [ ] New device in table

### Test 1.20: Create NAS with Duplicate IP

**Steps:**
1. Try to create NAS with IP `192.168.1.1` (already exists in seed)

**Expected:**
- [ ] Error: "NAS device with this IP already exists" (unique constraint)

### Test 1.21: Delete NAS with Assigned Subscribers

**Steps:**
1. Find a NAS device that has subscribers assigned
2. Try to delete it

**Expected:**
- [ ] Error: "Cannot delete NAS device with assigned subscribers"

### Test 1.22: View Location Tree

**Steps:**
1. Click "Locations" in sidebar

**Expected:**
- [ ] Tree view renders with hierarchy:
  ```
  Maharashtra (Region)
  ├─ Pune (City) — 2 areas, X subscribers, Y NAS
  │  ├─ Kothrud (Area)
  │  └─ Warje (Area)
  └─ Mumbai (City) — 1 area
     └─ Andheri (Area)
  ```
- [ ] Each node shows subscriber count and NAS count
- [ ] Expand/collapse works on each node

### Test 1.23: Create Location

**Steps:**
1. Click "Add Location"
2. Fill:
   - Name: `Delhi`
   - Type: `REGION`
   - Parent: (none — top level)
3. Click "Save"
4. Then create child:
   - Name: `New Delhi`
   - Type: `CITY`
   - Parent: `Delhi`
5. Click "Save"

**Expected:**
- [ ] Both locations appear in tree
- [ ] Delhi shows New Delhi as child
- [ ] Type filtering works (City can only be child of Region)

### Test 1.24: Delete Location with Children

**Steps:**
1. Try to delete "Pune" (has child areas)

**Expected:**
- [ ] Error: "Cannot delete location with child locations"

### Test 1.25: Delete Location with Subscribers

**Steps:**
1. Try to delete "Kothrud" (has subscribers assigned)

**Expected:**
- [ ] Error: "Cannot delete location with assigned subscribers/NAS devices"

---

## Phase 2: RADIUS Integration

### Test 2.1: RADIUS Sync on Subscriber Create

**Steps:**
1. Create a new subscriber with a plan assigned
2. Check RADIUS tables

**Verify in Prisma Studio (radius schema):**
- [ ] `RadCheck` table has entry: `username = "demo-isp_<username>"`, `attribute = "Cleartext-Password"`
- [ ] `RadUserGroup` table has entry: `username = "demo-isp_<username>"`, `groupname = "demo-isp_<planId>"`

### Test 2.2: RADIUS Sync on Plan Create

**Steps:**
1. Create a new plan
2. Check RADIUS tables

**Verify:**
- [ ] `RadGroupReply` has entries for `groupname = "demo-isp_<planId>"`
- [ ] Attributes include `Mikrotik-Rate-Limit` with correct speed format
- [ ] Format example: `"30M/30M"` for 30Mbps symmetric

### Test 2.3: RADIUS Sync on NAS Create

**Steps:**
1. Create a new NAS device
2. Check RADIUS tables

**Verify:**
- [ ] `RadNas` (or `nas` table in radius schema) has entry with correct IP and secret

### Test 2.4: RADIUS Sync on Subscriber Update

**Steps:**
1. Update a subscriber's plan (change from Basic to Premium)

**Verify:**
- [ ] `RadUserGroup` updated with new groupname
- [ ] Old group mapping removed

### Test 2.5: RADIUS Sync on Subscriber Delete

**Steps:**
1. Delete (soft delete) a subscriber

**Verify:**
- [ ] Entries removed from `RadCheck` for that username
- [ ] Entries removed from `RadUserGroup`

### Test 2.6: RADIUS Seed Script

```bash
npx tsx scripts/seed-radius.ts
```

**Expected:**
- [ ] Script completes without errors
- [ ] Progress shown for each tenant
- [ ] All active subscribers synced to RADIUS tables
- [ ] All plans synced with bandwidth attributes
- [ ] All NAS devices synced

### Test 2.7: Online Users Display

**Steps:**
1. Navigate to "Online Users" page

**Expected:**
- [ ] If FreeRADIUS has active sessions, they appear in the table
- [ ] Columns: Username, IP, MAC, NAS IP, Session Start, Data Usage, Status
- [ ] Username shows without tenant prefix (e.g., "john" not "demo-isp_john")

**Note:** To test with actual online users, you need a MikroTik router configured to authenticate against this FreeRADIUS instance. In development, this table will likely be empty.

### Test 2.8: Session History

**Steps:**
1. Navigate to "Sessions" page

**Expected:**
- [ ] Loading skeleton appears
- [ ] Table shows historical sessions from `RadAcct`
- [ ] Columns: Username, Start, Stop, Duration, Data, NAS IP, IP, Termination Cause
- [ ] Search by username works
- [ ] Pagination works

---

## Phase 3: Billing & Payments

### Test 3.1: View Invoices

**Steps:**
1. Navigate to Billing → Invoices

**Expected:**
- [ ] Stat cards show: Total Invoices, Paid, Pending, Overdue, Revenue, Monthly
- [ ] Invoice table loads with columns: Invoice#, Subscriber, Date, Amount, Tax, Total, Balance, Status, Actions

### Test 3.2: Create Invoice

**Steps:**
1. Click "Create Invoice"
2. Select a subscriber from dropdown
3. Select a plan (auto-fills amount)
4. Set:
   - Amount: `999`
   - Tax: `180` (18% GST)
   - Discount: `0`
   - Invoice Date: Today
   - Due Date: 15 days from today
5. Click "Save"

**Expected:**
- [ ] Invoice created with auto-generated number (e.g., `INV-001`)
- [ ] Total calculated: 999 + 180 - 0 = 1179
- [ ] Status = ISSUED (or DRAFT if applicable)
- [ ] Balance = Total amount
- [ ] Appears in invoice table

### Test 3.3: Invoice with Tax and Discount

**Steps:**
1. Create invoice with:
   - Amount: `1000`
   - Tax: `180`
   - Discount: `100`

**Expected:**
- [ ] Total = 1000 + 180 - 100 = `1080`
- [ ] Values display correctly with 2 decimal places

### Test 3.4: Cancel Invoice

**Steps:**
1. Find an unpaid invoice
2. Click Actions → Cancel
3. Enter reason: "Customer cancelled subscription"
4. Confirm

**Expected:**
- [ ] Status changes to CANCELLED
- [ ] Cannot record payment against cancelled invoice
- [ ] Stats update (Pending count decreases)

### Test 3.5: Download Invoice PDF

**Steps:**
1. Find any invoice
2. Click Actions → Download PDF

**Expected:**
- [ ] PDF file downloads
- [ ] PDF contains: company name, invoice number, subscriber details, line items, totals, payment status
- [ ] PDF renders correctly (no broken layouts)
- [ ] If invoice has payments, payment history shows in PDF

### Test 3.6: View Payments

**Steps:**
1. Navigate to Billing → Payments

**Expected:**
- [ ] Stat cards: Total Payments, Completed, Pending, Amount Collected, Monthly
- [ ] Payment table with columns: Date, Subscriber, Invoice, Amount, Method, Transaction ID, Status, Actions

### Test 3.7: Record Payment (Manual)

**Steps:**
1. Click "Record Payment"
2. Select subscriber
3. Select invoice (if available)
4. Amount: `1179` (full invoice amount)
5. Method: `Cash`
6. Transaction ID: (optional)
7. Notes: "Collected at office"
8. Click "Save"

**Expected:**
- [ ] Payment recorded successfully
- [ ] Invoice status changes to PAID (if full amount)
- [ ] Invoice balance becomes 0
- [ ] Subscriber expiry date extended (if invoice linked to plan)

### Test 3.8: Partial Payment

**Steps:**
1. Create invoice for Rs.1000
2. Record payment of Rs.500

**Expected:**
- [ ] Invoice balance = Rs.500 (1000 - 500)
- [ ] Invoice status remains ISSUED (not fully paid)
- [ ] Subscriber expiry NOT extended (partial payment)

Then:
3. Record another payment of Rs.500

**Expected:**
- [ ] Invoice balance = Rs.0
- [ ] Invoice status = PAID
- [ ] Subscriber expiry extended

### Test 3.9: Payment Methods

Test recording payments with each method:
- [ ] CASH
- [ ] UPI
- [ ] CARD
- [ ] BANK_TRANSFER
- [ ] PAYMENT_GATEWAY
- [ ] VOUCHER

**Expected:** Each method saves correctly and displays appropriate badge in table.

### Test 3.10: Invoice Number Sequencing

**Steps:**
1. Create 3 invoices in quick succession

**Expected:**
- [ ] Invoice numbers are sequential: INV-001, INV-002, INV-003
- [ ] No duplicate numbers
- [ ] Numbers follow tenant's invoice prefix (from billing preferences settings)

---

## Phase 4: Vouchers, Tickets, Leads, Sessions

### Test 4.1: View Voucher Batches

**Steps:**
1. Navigate to "Vouchers" in sidebar

**Expected:**
- [ ] Stat cards: Total Vouchers, Generated, Sold, Redeemed, Expired
- [ ] Batch list shows BATCH-001 from seed data
- [ ] Each batch card shows: batch number, plan, price, quantity, validity, status breakdown

### Test 4.2: Generate Voucher Batch

**Steps:**
1. Click "Generate Vouchers"
2. Fill:
   - Plan: Select "Hotspot 1-Day"
   - Quantity: `50`
   - Validity: `1` day
   - Prefix: `WIFI`
   - Code Length: `8`
   - Notes: "Test batch"
3. Click "Generate"

**Expected:**
- [ ] Toast: "Voucher batch generated successfully"
- [ ] New batch appears in list
- [ ] Batch number: BATCH-002 (auto-incremented)
- [ ] 50 vouchers created with status GENERATED

### Test 4.3: View Voucher Batch Detail

**Steps:**
1. Click on a batch → View

**Expected:**
- [ ] Navigates to `/vouchers/[batchId]`
- [ ] Shows all vouchers in the batch
- [ ] Each voucher shows: Serial#, Code, Status, Sold To, Redeemed By, Expiry
- [ ] Codes follow format: `WIFI-XXXXXXXX` (prefix + random alphanumeric, no 0/O/1/I)

### Test 4.4: Export Voucher Batch CSV

**Steps:**
1. Click on a batch → Export CSV

**Expected:**
- [ ] CSV file downloads
- [ ] Contains columns: Serial#, Code, Plan, Price, Status, Sold To, Redeemed At, Expires At

### Test 4.5: Delete Voucher Batch (No Redeemed)

**Steps:**
1. Create a new batch
2. Do NOT redeem any vouchers
3. Click → Delete batch
4. Confirm

**Expected:**
- [ ] Batch and all vouchers deleted
- [ ] Toast: "Batch deleted"

### Test 4.6: Delete Voucher Batch (Has Redeemed)

**Steps:**
1. Find BATCH-001 (has 2 REDEEMED vouchers from seed)
2. Try to delete

**Expected:**
- [ ] Error: "Cannot delete batch with redeemed vouchers"

### Test 4.7: View Complaints/Tickets

**Steps:**
1. Navigate to "Complaints" in sidebar

**Expected:**
- [ ] Stat cards: Total, Open, Assigned, In Progress, Resolved, Closed
- [ ] Ticket list shows seed tickets
- [ ] Status badges with colors

### Test 4.8: Create Ticket

**Steps:**
1. Click "New Ticket"
2. Fill:
   - Subscriber: Select any
   - Subject: `Internet not working`
   - Description: `Cannot connect since yesterday evening. Router lights blinking.`
   - Category: `CONNECTIVITY`
   - Priority: `HIGH`
   - Assigned To: Select staff member
3. Click "Create"

**Expected:**
- [ ] Ticket created with auto-generated number (TKT-006)
- [ ] Status = ASSIGNED (because staff was assigned)
- [ ] Appears in ticket list

### Test 4.9: Ticket Status Transitions

**Steps:**
1. Find an OPEN ticket
2. Click "Start" → Status becomes IN_PROGRESS
3. Click "Resolve" → Status becomes RESOLVED
4. Click "Close" → Status becomes CLOSED

**Expected:**
- [ ] Each transition updates the badge
- [ ] `resolvedAt` timestamp set when resolved
- [ ] `closedAt` timestamp set when closed

### Test 4.10: View Ticket Detail

**Steps:**
1. Click on a ticket

**Expected:**
- [ ] Navigates to `/complaints/[id]`
- [ ] Shows full ticket details: subject, description, subscriber info, assigned staff
- [ ] Shows comment thread (seeded tickets have comments)
- [ ] Can add new comment (public or internal)

### Test 4.11: Add Ticket Comment

**Steps:**
1. On ticket detail page
2. Type comment: "Checked router logs, DNS issue found."
3. Toggle "Internal Note" if needed
4. Click "Add Comment"

**Expected:**
- [ ] Comment appears in thread
- [ ] Internal notes visually distinct (different background/badge)
- [ ] Timestamp shows correctly

### Test 4.12: Delete Ticket

**Steps:**
1. Find a ticket with status RESOLVED or CLOSED
2. Click Delete → Confirm

**Expected:**
- [ ] Ticket deleted (including all comments — cascade delete)
- [ ] Toast: "Ticket deleted"
- [ ] Stats update

### Test 4.13: View Leads

**Steps:**
1. Navigate to "Leads" in sidebar

**Expected:**
- [ ] Stat cards: Total, New, Contacted, Site Survey, Scheduled, Converted, Conversion Rate %
- [ ] Lead table shows seed data
- [ ] Status badges with pipeline colors

### Test 4.14: Create Lead

**Steps:**
1. Click "Add Lead"
2. Fill:
   - Name: `Potential Customer`
   - Phone: `8888777766`
   - Email: `potential@email.com`
   - Address: `456 Lead Avenue`
   - Source: `REFERRAL`
   - Location: Select an area
3. Click "Save"

**Expected:**
- [ ] Lead created with status NEW
- [ ] Toast: "Lead created"

### Test 4.15: Advance Lead Status

**Steps:**
1. Find a NEW lead
2. Click "Next" button → Status becomes CONTACTED
3. Click "Next" again → SITE_SURVEY
4. Click "Next" again → INSTALLATION_SCHEDULED

**Expected:**
- [ ] Status progresses through pipeline
- [ ] Badge color changes at each stage

### Test 4.16: Convert Lead to Subscriber

**Steps:**
1. Find a lead in INSTALLATION_SCHEDULED status
2. Click Actions → "Convert to Subscriber"

**Expected:**
- [ ] Redirects to subscriber creation form
- [ ] Form pre-filled with lead's name, phone, email, address
- [ ] After saving subscriber, lead status updates to CONVERTED

### Test 4.17: Mark Lead as Lost

**Steps:**
1. Find any active lead
2. Click Actions → "Mark as Lost"

**Expected:**
- [ ] Status changes to LOST
- [ ] Lead remains in list with LOST badge

---

## Phase 5: Notifications (SMS/Email)

### Test 5.1: Configure SMS Gateway

**Steps:**
1. Navigate to Settings → SMS Gateway
2. Click "Add Gateway"
3. Select provider: `MSG91` (or `Twilio`)
4. Fill credentials:
   - API Key: (your test key)
   - Sender ID: `CLDRDS`
5. Toggle "Active"
6. Click "Save"

**Expected:**
- [ ] Gateway created
- [ ] Shows in gateway list
- [ ] Status badge: Active

### Test 5.2: Test SMS Gateway

**Steps:**
1. Find the configured gateway
2. Click Actions → "Test"
3. Enter test phone number
4. Click "Send Test SMS"

**Expected:**
- [ ] If credentials valid: "Test SMS sent successfully"
- [ ] If credentials invalid: Error with provider message
- [ ] Actual SMS received on phone (if valid credentials)

### Test 5.3: Toggle SMS Gateway Status

**Steps:**
1. Find an active gateway
2. Click Actions → Toggle (Deactivate)

**Expected:**
- [ ] Status changes to Inactive
- [ ] No SMS will be sent via this gateway
- [ ] Other gateways unaffected

### Test 5.4: Delete SMS Gateway

**Steps:**
1. Find an inactive gateway
2. Click Actions → Delete
3. Confirm

**Expected:**
- [ ] Gateway removed from list
- [ ] If it was the only gateway, SMS sending will fail gracefully

### Test 5.5: Configure Email (SMTP)

**Steps:**
1. Navigate to Settings → Email
2. Fill SMTP config:
   - Host: `smtp.gmail.com` (or your SMTP server)
   - Port: `587`
   - Username: (your email)
   - Password: (your app password)
   - From Email: (your email)
   - From Name: `Demo ISP`
   - Enable TLS: Yes
3. Click "Save"

**Expected:**
- [ ] Config saved
- [ ] Status shows "Active"

### Test 5.6: Test Email Connection

**Steps:**
1. On email settings page
2. Click "Test Connection"

**Expected:**
- [ ] If SMTP valid: "Connection successful"
- [ ] If SMTP invalid: Error with SMTP error details

### Test 5.7: Send Test Email

**Steps:**
1. Click "Send Test Email"
2. Enter recipient email

**Expected:**
- [ ] "Test email sent" confirmation
- [ ] Email received in inbox

### Test 5.8: Notification Worker (Background Job)

**Prerequisites:** SMS and Email configured. Worker running (`pnpm worker`).

**Steps:**
1. Create a new subscriber (should trigger "welcome" notification)
2. Check worker terminal for processing logs

**Expected:**
- [ ] Worker picks up job
- [ ] SMS sent (if template active and phone number valid)
- [ ] Email sent (if template active and email configured)
- [ ] `NotificationLog` records created in database

### Test 5.9: View Notification Templates

**Steps:**
1. Navigate to Settings → Notifications

**Expected:**
- [ ] Table shows default notification templates
- [ ] Templates for: Welcome, Expiry Warning, Payment Received, Invoice Generated, etc.
- [ ] Each shows: Event type, Channel (SMS/Email), Variables, Status (Active/Inactive)

---

## Phase 6: Dashboard, Reports, Portal

### Test 6.1: Dashboard KPI Cards

**Steps:**
1. Login and go to Dashboard

**Expected:**
- [ ] 8 KPI cards display correct numbers:
  - Total Subscribers (8 from seed)
  - Active Subscribers
  - Expired Subscribers
  - New This Month
  - MRR (Monthly Recurring Revenue)
  - Collections This Month
  - Outstanding Balance
  - Online Users Now

### Test 6.2: Dashboard Charts

**Expected:**
- [ ] Subscriber Growth chart (line chart) — shows monthly trend
- [ ] Revenue Trend chart (bar chart) — shows monthly payments
- [ ] Plan Distribution chart (pie chart) — shows subscriber breakdown by plan
- [ ] Area Distribution chart (bar chart) — shows subscriber breakdown by location
- [ ] Charts have legends and tooltips on hover
- [ ] Empty state shown if no data for a chart

### Test 6.3: Dashboard Recent Activity

**Expected:**
- [ ] Activity feed shows recent events (subscribers created, payments, invoices)
- [ ] Each entry has icon, description, and relative time ("5 minutes ago")
- [ ] Feed shows mix of different activity types

### Test 6.4: Reports Hub

**Steps:**
1. Navigate to "Reports" in sidebar

**Expected:**
- [ ] 10 report type cards displayed
- [ ] Each card has icon, title, description, and link
- [ ] Cards: Subscriber, Billing, Revenue, Collection, Expiry, Churn, Session, Usage, Voucher, NAS

### Test 6.5: Subscriber Report

**Steps:**
1. Click "Subscriber Report"
2. Apply filters:
   - Status: Active
   - Plan: Basic 30Mbps
   - Date range: Last 30 days
3. Click "Apply"

**Expected:**
- [ ] Table shows filtered subscribers
- [ ] Pagination works
- [ ] Can export to CSV
- [ ] Column headers match subscriber attributes

### Test 6.6: Billing Report

**Steps:**
1. Click "Billing Report"
2. Filter by status: PAID
3. Set date range

**Expected:**
- [ ] Invoice data displayed
- [ ] Summary shows total amount, paid amount, pending amount
- [ ] Pagination works

### Test 6.7: Revenue Report

**Steps:**
1. Click "Revenue Report"
2. Select a specific plan
3. Set date range

**Expected:**
- [ ] Revenue breakdown by plan shown
- [ ] Total revenue calculated
- [ ] Data reflects actual payment records

### Test 6.8: Collection Report

**Steps:**
1. Click "Collection Report"
2. Filter by method: CASH
3. Set date range

**Expected:**
- [ ] Payment records displayed
- [ ] Breakdown by payment method
- [ ] Summary totals

### Test 6.9: Expiry Report

**Steps:**
1. Click "Expiry Report"
2. Set "Days Ahead": 30

**Expected:**
- [ ] Shows subscribers expiring in next 30 days
- [ ] Sorted by expiry date (soonest first)
- [ ] Can adjust days ahead parameter

### Test 6.10: Export Report to CSV

**Steps:**
1. On any report page
2. Click "Export CSV"

**Expected:**
- [ ] CSV file downloads
- [ ] Contains correct columns and data
- [ ] Special characters handled (commas in names, etc.)
- [ ] File opens correctly in Excel/Sheets

### Test 6.11: Portal Login (Subscriber)

**Steps:**
1. Navigate to `http://localhost:3000/portal/login`
2. Enter username of a seed subscriber (check Prisma Studio for username)
3. Enter password

**Expected:**
- [ ] Redirects to `/portal/dashboard`
- [ ] Portal navigation shows: Dashboard, Billing, Complaints, Profile
- [ ] Subscriber name displayed

### Test 6.12: Portal Dashboard

**Steps:**
1. After portal login, view dashboard

**Expected:**
- [ ] Shows subscriber profile card (name, phone, email, username)
- [ ] Shows plan details (name, speed, data limit, expiry date)
- [ ] Shows account balance
- [ ] Shows usage data (upload, download, session count)
- [ ] Status badge (Active/Expired/etc.)

### Test 6.13: Portal Billing

**Steps:**
1. Click "Billing" in portal nav

**Expected:**
- [ ] Shows subscriber's invoices
- [ ] Each invoice shows: number, date, amount, status
- [ ] Pagination if many invoices

### Test 6.14: Portal Profile Update

**Steps:**
1. Click "Profile" in portal nav
2. Change phone number
3. Click "Save"

**Expected:**
- [ ] Toast: "Profile updated"
- [ ] New phone number persisted

### Test 6.15: Portal Create Ticket

**Steps:**
1. Click "Complaints" in portal nav
2. Click "New Ticket"
3. Fill subject and description
4. Submit

**Expected:**
- [ ] Ticket created
- [ ] Ticket number displayed
- [ ] Appears in complaint list

### Test 6.16: Portal Logout

**Steps:**
1. Click logout in portal
2. Try to access `/portal/dashboard`

**Expected:**
- [ ] Redirected to `/portal/login`
- [ ] Cookie cleared

### Test 6.17: Hotspot/Captive Portal Login Page

**Steps:**
1. Navigate to `http://localhost:3000/hotspot/demo-isp`

**Expected:**
- [ ] Branded login page loads
- [ ] Shows ISP name/logo (from captive portal config)
- [ ] Tab-based login: Username/Password, OTP, Voucher
- [ ] Styling matches configured theme colors

### Test 6.18: Hotspot Login — Username/Password

**Steps:**
1. On hotspot login page
2. Select "Username/Password" tab
3. Enter subscriber credentials
4. Click "Login"

**Expected:**
- [ ] Success message with subscriber name and plan
- [ ] Redirects to configured redirect URL (or shows success screen)

### Test 6.19: Hotspot Login — Voucher

**Steps:**
1. Select "Voucher" tab
2. Enter a valid voucher code from seed data (find in Prisma Studio → Voucher table)
3. Click "Login"

**Expected:**
- [ ] Success with plan name and expiry time
- [ ] Voucher status changes to REDEEMED in database

### Test 6.20: Hotspot Login — Invalid Credentials

**Steps:**
1. Enter wrong username/password
2. Try expired voucher code
3. Try already-redeemed voucher

**Expected:**
- [ ] Error message displayed for each case
- [ ] No session created

---

## Phase 7: RBAC, Super Admin, Settings, UI Polish

### Test 7.1: RBAC — Role-Based Navigation

Test each role sees only their permitted navigation items:

**TENANT_ADMIN** (`admin@demo-isp.com`):
- [ ] Sees ALL sidebar items (Dashboard, Subscribers, Plans, NAS, Locations, Online Users, Billing, Vouchers, Reports, Complaints, Leads, Sessions, Settings)

**STAFF** (`staff@demo-isp.com`):
- [ ] Sees limited items based on STAFF permissions
- [ ] Does NOT see Settings → Users (unless permitted)
- [ ] Does NOT see billing management (unless permitted)

**SUPER_ADMIN** (`admin@cloudradius.com`):
- [ ] Sees super-admin specific nav (Dashboard, Tenants, Settings)
- [ ] Does NOT see tenant-level items

### Test 7.2: RBAC — Permission Enforcement in Actions

**Steps:**
1. Login as STAFF user
2. Try to access `/settings/users` directly in URL

**Expected:**
- [ ] Either redirected to dashboard OR shows "Forbidden" error
- [ ] Cannot create/edit/delete users

### Test 7.3: RBAC — Permission Check in Server Actions

**Steps:**
1. Login as a limited-role user (STAFF or COLLECTOR)
2. Try to perform an action they shouldn't have access to (e.g., delete subscriber)

**Expected:**
- [ ] Action fails with "Forbidden" or "Not authorized" error
- [ ] No data modified

### Test 7.4: Super Admin — Dashboard

**Steps:**
1. Login as super admin
2. View `/super-admin/dashboard`

**Expected:**
- [ ] Platform-level KPI cards:
  - Total Tenants
  - Active Tenants
  - Trial Tenants
  - Suspended Tenants
  - Total Subscribers (across all tenants)
  - Total Users
- [ ] Recent tenants list

### Test 7.5: Super Admin — Tenant List

**Steps:**
1. Navigate to Tenants

**Expected:**
- [ ] Table shows all tenants
- [ ] Columns: Name, Slug, Status, Tier, Subscribers Count, Users Count, Created At, Actions
- [ ] Demo ISP and any registered tenants visible

### Test 7.6: Super Admin — Create Tenant

**Steps:**
1. Click "Create Tenant"
2. Fill:
   - Name: `New ISP`
   - Slug: `new-isp`
   - Admin Email: `admin@new-isp.com`
   - Admin Password: `password123`
   - Admin Name: `ISP Admin`
   - Tier: `GROWTH`
   - Max Online Users: `100`
3. Click "Create"

**Expected:**
- [ ] Tenant created
- [ ] Admin user created with TENANT_ADMIN role
- [ ] Can login as `admin@new-isp.com`

### Test 7.7: Super Admin — Suspend Tenant

**Steps:**
1. Find a tenant
2. Click Actions → Suspend

**Expected:**
- [ ] Tenant status changes to SUSPENDED
- [ ] Tenant admin cannot login (or sees suspended message)

### Test 7.8: Super Admin — Activate Tenant

**Steps:**
1. Find suspended tenant
2. Click Actions → Activate

**Expected:**
- [ ] Status changes to ACTIVE
- [ ] Tenant admin can login again

### Test 7.9: Settings — Hub Page

**Steps:**
1. Login as tenant admin
2. Navigate to Settings

**Expected:**
- [ ] 9 settings cards displayed (filtered by role):
  - Company Profile
  - Payment Gateways
  - SMS Gateway
  - Email
  - Notifications
  - Users
  - Billing Preferences
  - RADIUS
  - Captive Portal
- [ ] Each card links to its sub-page

### Test 7.10: Settings — Company Profile

**Steps:**
1. Click "Company Profile"
2. Update:
   - Company Name: `My Updated ISP`
   - Phone: `1234567890`
   - Tax Number: `GST12345`
   - Address: `789 ISP Road`
3. Click "Save"

**Expected:**
- [ ] Settings saved
- [ ] Toast: "Company profile updated"
- [ ] Values persist on page reload

### Test 7.11: Settings — Billing Preferences

**Steps:**
1. Click "Billing Preferences"
2. Set:
   - Currency: INR
   - Invoice Prefix: `INV`
   - Tax Rate: `18`
   - Tax Label: `GST`
   - Grace Period: `7` days
   - Auto-generate Invoices: On
3. Click "Save"

**Expected:**
- [ ] Preferences saved to tenant settings JSON
- [ ] New invoices use updated prefix and tax settings

### Test 7.12: Settings — User Management

**Steps:**
1. Click "Users"

**Expected:**
- [ ] Stat cards: Total Users, Active, Admins, Staff/Managers
- [ ] User table with columns: Name, Email, Role, Location, Status, Last Login, Actions

### Test 7.13: Settings — Create User

**Steps:**
1. Click "Invite User"
2. Fill:
   - Name: `New Manager`
   - Email: `manager@demo-isp.com`
   - Password: `manager123`
   - Role: `MANAGER`
   - Location: Select an area (for franchise scoping)
3. Click "Create"

**Expected:**
- [ ] User created
- [ ] Can login with new credentials
- [ ] Sidebar shows role-appropriate navigation
- [ ] If location assigned, user sees only that location's data

### Test 7.14: Settings — Edit User Role

**Steps:**
1. Find a STAFF user
2. Click Edit
3. Change role to MANAGER
4. Click "Save"

**Expected:**
- [ ] Role updated
- [ ] Next login shows updated navigation/permissions

### Test 7.15: Settings — Deactivate User

**Steps:**
1. Find a user
2. Click Actions → Deactivate
3. Confirm

**Expected:**
- [ ] User status changes to INACTIVE
- [ ] User cannot login (receives "Account inactive" error)

### Test 7.16: Settings — RADIUS Config

**Steps:**
1. Click "RADIUS"

**Expected:**
- [ ] Read-only display of RADIUS configuration
- [ ] Shows: Server IP, Auth Port, Acct Port, CoA Port
- [ ] MikroTik setup guide displayed

### Test 7.17: Settings — Captive Portal

**Steps:**
1. Click "Captive Portal"
2. Configure:
   - Enable Portal: On
   - Welcome Title: `Welcome to Demo ISP`
   - Welcome Message: `Connect to the internet`
   - Primary Color: `#2563eb`
   - Enable Username/Password Login: Yes
   - Enable Voucher Login: Yes
   - Enable OTP Login: Yes
3. Click "Save"

**Expected:**
- [ ] Config saved
- [ ] Preview link opens hotspot page with new branding
- [ ] Portal URL shown for MikroTik configuration

### Test 7.18: Dark Mode Toggle

**Steps:**
1. Find dark mode toggle in topbar (sun/moon icon)
2. Click to switch to dark mode

**Expected:**
- [ ] Entire app switches to dark theme
- [ ] Background becomes dark, text becomes light
- [ ] All components render properly in dark mode
- [ ] Charts render with appropriate contrast
- [ ] Tables have proper borders/contrast
- [ ] Forms have proper input backgrounds

3. Click again to switch back to light mode

**Expected:**
- [ ] Returns to light theme
- [ ] Theme preference persists across page navigations

### Test 7.19: Dark Mode — System Preference

**Steps:**
1. Set OS to dark mode (System Preferences / Settings)
2. Load the app (fresh)

**Expected:**
- [ ] App defaults to dark mode (respects system preference)
- [ ] Manual toggle overrides system preference

### Test 7.20: Loading Skeletons

Test loading states on slow connections:

**Steps:**
1. Open DevTools → Network → Throttle to "Slow 3G"
2. Navigate to each major page

**Expected pages with loading skeletons:**
- [ ] `/dashboard` — 8 card skeletons + chart placeholders
- [ ] `/subscribers` — Header + search + table skeleton
- [ ] `/plans` — Table skeleton
- [ ] `/billing` — Table skeleton
- [ ] `/reports` — 10 card grid skeleton
- [ ] `/settings` — 9 card grid skeleton
- [ ] `/online-users` — Table skeleton
- [ ] `/super-admin/dashboard` — Card + table skeletons

### Test 7.21: Error Boundary

**Steps:**
1. Simulate an error (e.g., disconnect database temporarily)
2. Navigate to a page that queries the database

**Expected:**
- [ ] Error boundary catches the error
- [ ] Displays "Something went wrong" message
- [ ] "Try again" button visible
- [ ] Clicking "Try again" re-renders the page
- [ ] App doesn't crash completely

### Test 7.22: Mobile Responsiveness — Full Test

Test on mobile viewport (390×844) for each page:

- [ ] `/dashboard` — Cards stack vertically, charts resize
- [ ] `/subscribers` — Table scrolls horizontally, form fields stack
- [ ] `/plans` — Table scrolls, form modal fills screen
- [ ] `/nas` — Table scrolls
- [ ] `/locations` — Tree readable on mobile
- [ ] `/billing` — Tables scroll
- [ ] `/vouchers` — Cards stack
- [ ] `/reports` — Cards stack, filters stack vertically
- [ ] `/complaints` — Cards stack
- [ ] `/leads` — Table scrolls
- [ ] `/settings` — Cards stack
- [ ] `/online-users` — Table scrolls
- [ ] `/sessions` — Table scrolls
- [ ] Sidebar — Hidden, hamburger menu works
- [ ] Topbar — Compact, user menu accessible
- [ ] All dialogs/modals — Fill screen properly
- [ ] All forms — Fields stack vertically

---

## Cross-Cutting Concerns

### Test CC.1: Multi-Tenant Data Isolation

**Steps:**
1. Register a second tenant (e.g., "ISP Two")
2. Login as ISP Two admin
3. Check every page shows ONLY ISP Two data

**Expected:**
- [ ] Dashboard shows 0 subscribers (new tenant, no data)
- [ ] Subscriber list is empty
- [ ] Plan list is empty
- [ ] NAS list is empty
- [ ] Cannot see Demo ISP's data anywhere
- [ ] Creating data in ISP Two doesn't appear in Demo ISP

### Test CC.2: Multi-Tenant Data Isolation — API Level

**Steps (using browser DevTools or curl):**
1. Login as Tenant A
2. Get a subscriber ID from Tenant B (from Prisma Studio)
3. Try to access: `/api/subscribers/[Tenant-B-subscriber-id]`

**Expected:**
- [ ] Returns 404 or "Not found" (not the subscriber data)
- [ ] No cross-tenant data leak

### Test CC.3: Form Validation — Required Fields

For each form in the app, test submitting with empty required fields:

- [ ] Subscriber form: Name, Phone, Username, Password, Connection Type
- [ ] Plan form: Name, Download Speed, Upload Speed, Price, Validity
- [ ] NAS form: Name, IP, Secret, Type
- [ ] Location form: Name, Type
- [ ] Invoice form: Subscriber, Amount
- [ ] Payment form: Subscriber, Amount, Method
- [ ] Voucher form: Plan, Quantity, Validity
- [ ] Ticket form: Subject, Description
- [ ] Lead form: Name, Phone
- [ ] User form: Name, Email, Password, Role

**Expected:** All required fields show validation errors, form does NOT submit.

### Test CC.4: Form Validation — Data Formats

Test invalid data formats:

- [ ] Email fields: Enter `not-an-email` → validation error
- [ ] Phone fields: Enter `abc` → validation error
- [ ] IP address field (NAS): Enter `999.999.999.999` → validation error
- [ ] Speed fields: Enter `-1` or `0` → validation error
- [ ] Price fields: Enter negative number → validation error
- [ ] Date fields: Enter past date for expiry → should warn or error

### Test CC.5: Toast Notifications

Verify toast behavior across all operations:

- [ ] Success toasts appear in green (create, update, delete operations)
- [ ] Error toasts appear in red (validation failures, server errors)
- [ ] Toasts auto-dismiss after ~5 seconds
- [ ] Close button on each toast works
- [ ] Multiple toasts stack properly
- [ ] Toasts appear at top-right of screen

### Test CC.6: Navigation — All Sidebar Links

Click every sidebar link and verify:

| Link | URL | Expected Page |
|------|-----|---------------|
| Dashboard | `/dashboard` | KPI cards + charts |
| Subscribers | `/subscribers` | Subscriber table |
| Plans | `/plans` | Plan table |
| NAS Devices | `/nas` | NAS table |
| Locations | `/locations` | Location tree |
| Online Users | `/online-users` | Online sessions table |
| Sessions | `/sessions` | Session history |
| Billing | `/billing/invoices` | Invoice table |
| Vouchers | `/vouchers` | Voucher batches |
| Reports | `/reports` | Report type cards |
| Complaints | `/complaints` | Ticket list |
| Leads | `/leads` | Lead table |
| Settings | `/settings` | Settings hub |

### Test CC.7: Pagination

Test pagination on every table/list:

- [ ] Subscribers table: Next/Previous/Page number buttons
- [ ] Plans table: Pagination
- [ ] Invoice table: Pagination
- [ ] Payment table: Pagination
- [ ] Session history: Pagination with page size
- [ ] Report tables: Pagination
- [ ] Voucher list in batch detail: Pagination

**Verify:**
- [ ] First page shows correct records
- [ ] "Next" advances to page 2
- [ ] "Previous" goes back
- [ ] Page count correct (total records / page size)
- [ ] Last page shows remaining records

### Test CC.8: Search Functionality

Test search on every table:

- [ ] Subscribers: Search by name, username, phone, email
- [ ] Plans: Search by name
- [ ] NAS: Search by name, IP
- [ ] Invoices: Search by invoice number, subscriber name
- [ ] Payments: Search by subscriber name, transaction ID
- [ ] Tickets: Search by ticket number, subject
- [ ] Leads: Search by name, phone, email
- [ ] Sessions: Search by username

**Verify:**
- [ ] Search filters results in real-time (or on Enter)
- [ ] Clearing search shows all records
- [ ] Search is case-insensitive
- [ ] Partial matches work

### Test CC.9: Concurrent Operations

Test for race conditions:

- [ ] Create 2 invoices rapidly (check numbers don't collide)
- [ ] Record 2 payments for same invoice simultaneously (check balance correct)
- [ ] Generate 2 voucher batches simultaneously (check batch numbers don't collide)
- [ ] Create 2 tickets simultaneously (check ticket numbers don't collide)

### Test CC.10: Browser Compatibility

Test in:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Chrome (Android)
- [ ] Mobile Safari (iOS)

---

## Known Issues & Workarounds

### Issue 1: Root-Owned File Permissions

**Symptom:** `prisma generate`, `next build`, or `next dev` fails with EACCES error

**Fix:**
```bash
sudo chown -R $USER:$USER node_modules/.pnpm/@prisma+client* .next/build
```

### Issue 2: Prisma Client Import Path

**Note:** All imports must use `from "@/generated/prisma"` NOT `from "@prisma/client"`.

If you see `Cannot find module '@prisma/client'`, check imports.

### Issue 3: RADIUS Password Sync

**Known Bug:** The RADIUS service stores bcrypt hash in `Cleartext-Password` attribute. FreeRADIUS expects plaintext for this attribute type. This means RADIUS authentication may not work correctly with actual MikroTik routers.

**Workaround:** For testing RADIUS auth, use `radtest` CLI tool and verify behavior. Production fix requires either:
- Storing plaintext in RADIUS (less secure)
- Using PAP authentication method
- Using a different RADIUS auth attribute

### Issue 4: Invoice PDF Route

**Note:** The original `route.ts` was deleted and replaced with `route.tsx` to support JSX rendering. If PDF download fails, verify `src/app/api/invoices/[id]/pdf/route.tsx` exists.

### Issue 5: Portal Login Cross-Tenant

**Known Security Issue:** Portal login (`/api/portal/login`) searches subscribers across ALL tenants. In production, this should be scoped to the tenant resolved from the subdomain.

### Issue 6: Worker Must Run Separately

BullMQ worker for background jobs (SMS, email, notifications) requires a separate process:

```bash
pnpm worker
```

If notifications aren't being sent, check that the worker is running.

---

## Test Completion Checklist

### Phase 0 — Infrastructure
- [ ] All 14 tests passing
- [ ] Docker services healthy
- [ ] Seed data correct
- [ ] Login/Logout/Register working
- [ ] Route protection enforced
- [ ] Theme and layout rendering

### Phase 1 — Subscriber & Plan Management
- [ ] All 25 tests passing
- [ ] CRUD for subscribers, plans, NAS, locations
- [ ] Form validations working
- [ ] Status transitions working
- [ ] Deletion guards working

### Phase 2 — RADIUS Integration
- [ ] All 8 tests passing
- [ ] RADIUS sync on create/update/delete
- [ ] Online users display
- [ ] Session history display
- [ ] Seed script runs cleanly

### Phase 3 — Billing & Payments
- [ ] All 10 tests passing
- [ ] Invoice CRUD and sequencing
- [ ] Payment recording and balance tracking
- [ ] PDF generation
- [ ] Auto-extend subscriber on full payment

### Phase 4 — Vouchers, Tickets, Leads
- [ ] All 17 tests passing
- [ ] Voucher generation and batch management
- [ ] Ticket CRUD and status workflow
- [ ] Lead pipeline and conversion
- [ ] Comment system working

### Phase 5 — Notifications
- [ ] All 9 tests passing
- [ ] SMS gateway CRUD and testing
- [ ] Email SMTP configuration
- [ ] Worker processing jobs
- [ ] Notification logs created

### Phase 6 — Dashboard, Reports, Portal
- [ ] All 20 tests passing
- [ ] Dashboard KPIs and charts accurate
- [ ] All 10 report types rendering
- [ ] CSV export working
- [ ] Portal login/profile/billing/complaints
- [ ] Hotspot captive portal login (all 3 methods)

### Phase 7 — RBAC, Super Admin, Settings, UI Polish
- [ ] All 22 tests passing
- [ ] Role-based navigation filtering
- [ ] Permission enforcement in actions
- [ ] Super admin tenant management
- [ ] All 9 settings pages working
- [ ] Dark mode toggle and persistence
- [ ] Loading skeletons on all pages
- [ ] Error boundary working
- [ ] Mobile responsive on all pages

### Cross-Cutting
- [ ] All 10 cross-cutting tests passing
- [ ] Multi-tenant isolation verified
- [ ] Form validation complete
- [ ] Pagination working everywhere
- [ ] Search working everywhere
- [ ] Toast notifications consistent

---

**Total Tests: 135+**
**Target: All passing with zero errors**

---

*Generated for CloudRadius v1.0 — ISP Billing & Bandwidth Management SaaS*
