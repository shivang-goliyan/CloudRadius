# TECH STACK — CloudRadius SaaS Platform

**IMPORTANT:** This is the canonical tech stack. Do NOT introduce alternative libraries or frameworks without explicit approval. Claude CLI must reference this file before adding any dependency.

---

## CORE FRAMEWORK

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| **Runtime** | Node.js | 20 LTS | Stable, long-term support |
| **Framework** | Next.js | 15.x (App Router) | Full-stack React, SSR, API routes, Server Actions |
| **Language** | TypeScript | 5.x | Type safety across entire codebase |
| **Package Manager** | pnpm | 9.x | Fast, disk-efficient, workspace support |

---

## FRONTEND

| Category | Technology | Notes |
|----------|-----------|-------|
| **UI Framework** | React 19 | Bundled with Next.js 15 |
| **Styling** | Tailwind CSS 3.4 | Utility-first, no custom CSS files |
| **Component Library** | shadcn/ui | Copy-paste components, fully customizable |
| **Icons** | Lucide React | Consistent icon set, tree-shakeable |
| **Charts** | Recharts | React-native charts for dashboard/reports |
| **Data Tables** | TanStack Table v8 | Headless, supports sort/filter/pagination |
| **Forms** | React Hook Form | Performance-optimized form management |
| **Validation** | Zod | Schema validation, shared between client/server |
| **Date Handling** | date-fns | Lightweight, tree-shakeable date utilities |
| **PDF Generation** | @react-pdf/renderer | React-based PDF for invoices and vouchers |
| **Toast/Notifications** | Sonner | Lightweight toast notifications |
| **State Management** | React Context + Zustand | Context for auth/tenant, Zustand for complex UI state |
| **File Upload** | react-dropzone | CSV import drag-and-drop |
| **Rich Text** | None initially | Add Tiptap if needed for email templates |

### Frontend Rules:
- **Server Components by default** — only add `'use client'` when you need interactivity
- **No CSS modules, no styled-components** — Tailwind only
- **No Material UI, Ant Design, or Chakra** — shadcn/ui only
- **No Axios** — use native `fetch` or Server Actions
- **No Redux** — use Zustand for client state, Server Components for server state
- **No moment.js** — use date-fns

---

## BACKEND

| Category | Technology | Notes |
|----------|-----------|-------|
| **API Layer** | Next.js Route Handlers + Server Actions | Colocated with frontend, no separate API server |
| **ORM** | Prisma | 5.x, type-safe DB access, migrations |
| **Authentication** | NextAuth.js (Auth.js) v5 | Credentials + JWT strategy |
| **Authorization** | Custom RBAC middleware | Role + permission checks on every route |
| **Background Jobs** | BullMQ | Redis-backed job queues for notifications, billing cron |
| **Job Scheduling** | BullMQ Repeat Jobs | Cron expressions for recurring tasks |
| **Email** | Nodemailer + React Email | SMTP sending with React-based HTML templates |
| **SMS** | Custom adapter pattern | Interface → MSG91, Textlocal, Africa's Talking implementations |
| **WhatsApp** | WhatsApp Business Cloud API | Via HTTP adapter |
| **File Storage** | AWS S3 (via @aws-sdk/client-s3) | Invoices, vouchers, logos, CSV imports |
| **Caching** | Redis (ioredis) | Session cache, RADIUS auth cache, rate limiting |
| **Logging** | Pino | Structured JSON logging |
| **Error Tracking** | Sentry | Runtime error capture |
| **Rate Limiting** | Custom middleware (Redis-based) | API + auth endpoint protection |
| **CSV Parsing** | PapaParse | CSV import/export |
| **Excel Export** | SheetJS (xlsx) | Report export to .xlsx |

### Backend Rules:
- **No Express.js** — use Next.js route handlers
- **No Mongoose/MongoDB** — PostgreSQL + Prisma only
- **No TypeORM/Sequelize/Knex** — Prisma only
- **No REST framework (Fastify, Hono, etc.)** — Next.js API routes only
- **All DB queries via Prisma** — no raw SQL except for RADIUS views
- **All mutations via Server Actions** where possible
- **Every API route must extract and validate tenant_id** from session/JWT

---

## DATABASE

| Category | Technology | Notes |
|----------|-----------|-------|
| **Primary Database** | PostgreSQL 16 | Main application database |
| **RADIUS Database** | Same PostgreSQL instance | RADIUS tables/views in separate schema |
| **Cache / Queue** | Redis 7 | BullMQ queues + caching |
| **Migrations** | Prisma Migrate | Schema versioning |
| **Seeding** | Prisma seed script | Demo data for development |

### Database Rules:
- **Single PostgreSQL instance** with logical separation
- **`public` schema** for application tables
- **`radius` schema** for FreeRADIUS tables (radcheck, radreply, radacct, etc.)
- **Every table has `tenant_id`** column (except super-admin tables)
- **Every query includes `WHERE tenant_id = ?`** — enforced at Prisma middleware level
- **Soft delete** (`deleted_at` timestamp) for subscribers, invoices — never hard delete
- **UUID primary keys** — not auto-increment integers
- **Timestamps:** `created_at`, `updated_at` on every table
- **Indexes:** On `tenant_id`, `status`, `username`, `phone`, `email`, foreign keys

---

## RADIUS SERVER

| Category | Technology | Notes |
|----------|-----------|-------|
| **RADIUS Server** | FreeRADIUS 3.x | Industry standard, open source |
| **Auth Protocol** | RADIUS (RFC 2865) | Authentication & Authorization |
| **Accounting** | RADIUS (RFC 2866) | Session accounting |
| **CoA** | RFC 5176 | Change of Authorization / Disconnect |
| **SQL Backend** | rlm_sql_postgresql | FreeRADIUS reads from PostgreSQL |
| **Dictionary** | MikroTik dictionary | For Mikrotik-Rate-Limit and other VSAs |

### RADIUS Rules:
- FreeRADIUS runs as a **separate Docker container/service**
- FreeRADIUS reads from `radius` schema tables
- Application writes to `radius` schema tables via Prisma
- **Never modify FreeRADIUS config dynamically** — use SQL backend for all logic
- RADIUS shared secrets stored **encrypted** in app DB, written to NAS table for FreeRADIUS
- CoA commands sent via **radclient** or custom UDP client from app server

---

## INFRASTRUCTURE & DEVOPS

| Category | Technology | Notes |
|----------|-----------|-------|
| **Cloud Provider** | AWS | Primary deployment target |
| **Containerization** | Docker | All services containerized |
| **Orchestration** | Docker Compose (dev) / ECS (prod) | Simple orchestration, no K8s needed initially |
| **CI/CD** | GitHub Actions | Automated lint → test → build → deploy |
| **Hosting (App)** | AWS ECS Fargate or EC2 | Auto-scaling app containers |
| **Hosting (RADIUS)** | AWS EC2 (dedicated) | Static public IP required for NAS connections |
| **Database Hosting** | AWS RDS PostgreSQL | Multi-AZ for high availability |
| **Redis Hosting** | AWS ElastiCache | Managed Redis |
| **File Storage** | AWS S3 | With CloudFront CDN |
| **DNS** | AWS Route 53 | Domain management + wildcard for tenant subdomains |
| **SSL** | AWS ACM | Free SSL certificates |
| **Load Balancer** | AWS ALB | HTTPS termination + routing |
| **Monitoring** | AWS CloudWatch + Sentry | Logs + error tracking |
| **Secrets** | AWS Secrets Manager or .env | API keys, DB credentials |

---

## PROJECT STRUCTURE

```
cloudradius/
├── prisma/
│   ├── schema.prisma          # Main Prisma schema
│   ├── migrations/            # Database migrations
│   └── seed.ts                # Seed script
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── (auth)/            # Auth pages (login, register, forgot-password)
│   │   ├── (admin)/           # Admin panel pages (protected)
│   │   │   ├── dashboard/
│   │   │   ├── subscribers/
│   │   │   ├── plans/
│   │   │   ├── billing/
│   │   │   ├── vouchers/
│   │   │   ├── nas/
│   │   │   ├── complaints/
│   │   │   ├── reports/
│   │   │   ├── online-users/
│   │   │   ├── leads/
│   │   │   ├── settings/
│   │   │   └── layout.tsx     # Admin layout (sidebar + topbar)
│   │   ├── (portal)/          # Subscriber self-service portal
│   │   ├── (hotspot)/         # Captive portal pages
│   │   ├── (super-admin)/     # Platform super admin
│   │   ├── api/               # API route handlers
│   │   │   ├── auth/
│   │   │   ├── webhooks/      # Payment gateway webhooks
│   │   │   └── radius/        # RADIUS-related endpoints
│   │   └── layout.tsx         # Root layout
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── forms/             # Reusable form components
│   │   ├── tables/            # Data table components
│   │   ├── charts/            # Dashboard chart components
│   │   └── layouts/           # Layout components (sidebar, topbar)
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── auth.ts            # NextAuth configuration
│   │   ├── redis.ts           # Redis client
│   │   ├── utils.ts           # Utility functions
│   │   ├── validations/       # Zod schemas
│   │   ├── constants.ts       # App-wide constants
│   │   └── types.ts           # TypeScript type definitions
│   ├── services/
│   │   ├── subscriber.service.ts
│   │   ├── plan.service.ts
│   │   ├── billing.service.ts
│   │   ├── radius.service.ts  # RADIUS table sync + CoA
│   │   ├── notification.service.ts
│   │   ├── voucher.service.ts
│   │   ├── payment-gateway/
│   │   │   ├── gateway.interface.ts
│   │   │   ├── razorpay.adapter.ts
│   │   │   ├── cashfree.adapter.ts
│   │   │   └── mpesa.adapter.ts
│   │   ├── sms/
│   │   │   ├── sms.interface.ts
│   │   │   ├── msg91.adapter.ts
│   │   │   └── textlocal.adapter.ts
│   │   └── email.service.ts
│   ├── jobs/
│   │   ├── queue.ts           # BullMQ queue definitions
│   │   ├── workers/
│   │   │   ├── notification.worker.ts
│   │   │   ├── billing.worker.ts
│   │   │   └── expiry.worker.ts
│   │   └── cron/
│   │       ├── expiry-check.ts
│   │       └── reminder.ts
│   ├── middleware.ts          # Next.js middleware (auth + tenant)
│   └── emails/                # React Email templates
│       ├── invoice.tsx
│       └── notification.tsx
├── radius/
│   ├── Dockerfile             # FreeRADIUS Docker image
│   ├── radiusd.conf
│   ├── clients.conf
│   ├── sql.conf               # PostgreSQL connection
│   ├── dictionary.mikrotik    # MikroTik VSAs
│   └── sites-enabled/
│       └── default
├── docker-compose.yml         # Local dev: app + db + redis + radius
├── Dockerfile                 # Next.js app Docker image
├── .env.example
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── README.md
```

---

## DEPENDENCY LIST (package.json)

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@prisma/client": "^5.0.0",
    "next-auth": "^5.0.0-beta",
    "@auth/prisma-adapter": "^2.0.0",
    "zod": "^3.23.0",
    "react-hook-form": "^7.53.0",
    "@hookform/resolvers": "^3.9.0",
    "@tanstack/react-table": "^8.20.0",
    "recharts": "^2.13.0",
    "date-fns": "^4.1.0",
    "zustand": "^5.0.0",
    "bullmq": "^5.0.0",
    "ioredis": "^5.4.0",
    "nodemailer": "^6.9.0",
    "@react-email/components": "^0.0.25",
    "@react-pdf/renderer": "^4.0.0",
    "papaparse": "^5.4.0",
    "xlsx": "^0.18.0",
    "@aws-sdk/client-s3": "^3.600.0",
    "pino": "^9.0.0",
    "@sentry/nextjs": "^8.0.0",
    "lucide-react": "^0.460.0",
    "sonner": "^1.7.0",
    "tailwind-merge": "^2.6.0",
    "clsx": "^2.1.0",
    "class-variance-authority": "^0.7.0",
    "uuid": "^10.0.0",
    "bcryptjs": "^2.4.3",
    "jose": "^5.9.0",
    "react-dropzone": "^14.2.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "prisma": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/nodemailer": "^6.4.0",
    "@types/papaparse": "^5.3.0",
    "@types/bcryptjs": "^2.4.0",
    "@types/uuid": "^10.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.0.0",
    "prettier": "^3.4.0",
    "prettier-plugin-tailwindcss": "^0.6.0"
  }
}
```

---

## ENVIRONMENT VARIABLES (.env.example)

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cloudradius

# Redis
REDIS_URL=redis://localhost:6379

# NextAuth
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
AWS_S3_BUCKET=cloudradius-files

# RADIUS
RADIUS_SERVER_IP=localhost
RADIUS_AUTH_PORT=1812
RADIUS_ACCT_PORT=1813
RADIUS_COA_PORT=3799

# Sentry
SENTRY_DSN=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=CloudRadius
```

---

## STRICT PROHIBITIONS

These technologies must NEVER be introduced:

| Prohibited | Use Instead |
|-----------|-------------|
| MongoDB / Mongoose | PostgreSQL + Prisma |
| Express.js / Fastify / Hono | Next.js Route Handlers |
| TypeORM / Sequelize / Knex | Prisma |
| Axios | Native fetch / Server Actions |
| Redux / MobX | Zustand (if needed) |
| Material UI / Ant Design / Chakra | shadcn/ui |
| moment.js / Luxon | date-fns |
| CSS Modules / Styled Components / Emotion | Tailwind CSS |
| Firebase / Supabase | Self-hosted PostgreSQL + custom auth |
| GraphQL / tRPC | REST API routes + Server Actions |
| Webpack config overrides | Next.js default bundling |
