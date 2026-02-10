# CONVENTIONS.md — Code Style & Naming Conventions

---

## File & Folder Naming

| Type | Convention | Example |
|------|-----------|---------|
| Pages / Routes | kebab-case folder | `src/app/(admin)/online-users/page.tsx` |
| Components | kebab-case file, PascalCase export | `subscriber-form.tsx` → `export function SubscriberForm()` |
| Services | kebab-case with `.service.ts` | `subscriber.service.ts` |
| Validations | kebab-case with `.schema.ts` | `subscriber.schema.ts` |
| Types | kebab-case with `.types.ts` | `subscriber.types.ts` |
| Server Actions | `actions.ts` colocated with page | `src/app/(admin)/subscribers/actions.ts` |
| API Routes | `route.ts` in api folder | `src/app/api/subscribers/route.ts` |
| Workers | kebab-case with `.worker.ts` | `notification.worker.ts` |

---

## TypeScript

- Strict mode enabled
- No `any` — use `unknown` and narrow types
- Prefer `interface` for object shapes, `type` for unions/intersections
- All function parameters and returns must be typed
- Use Zod schemas as source of truth, infer types with `z.infer<typeof schema>`

```typescript
// Good
const schema = z.object({ name: z.string(), phone: z.string() });
type CreateSubscriberInput = z.infer<typeof schema>;

// Bad
type CreateSubscriberInput = { name: any; phone: any };
```

---

## Prisma

- Model names: PascalCase singular (`Subscriber`, `Plan`, `Invoice`)
- Field names: camelCase in Prisma, maps to snake_case in DB
- Always use `@map` for snake_case DB columns
- Relations: explicit foreign key fields (`planId` + `plan` relation)
- Every model gets: `id` (UUID), `tenantId`, `createdAt`, `updatedAt`
- Soft delete: `deletedAt DateTime?` where applicable

```prisma
model Subscriber {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  name      String
  phone     String
  username  String
  status    SubscriberStatus @default(ACTIVE)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  tenant    Tenant   @relation(fields: [tenantId], references: [id])

  @@map("subscribers")
  @@index([tenantId, status])
  @@index([tenantId, username])
}
```

---

## API Routes

- RESTful conventions:
  - `GET /api/subscribers` — list (with query params for filter/sort/page)
  - `POST /api/subscribers` — create
  - `GET /api/subscribers/[id]` — get one
  - `PATCH /api/subscribers/[id]` — update
  - `DELETE /api/subscribers/[id]` — soft delete
- Always return consistent JSON: `{ data, meta, error }`
- HTTP status codes: 200 (ok), 201 (created), 400 (validation), 401 (unauth), 403 (forbidden), 404 (not found), 500 (server error)
- Validate request body with Zod
- Extract tenant from session in every route

---

## Server Actions

- Use for form mutations (create, update, delete)
- Always validate input with Zod
- Return `{ success: boolean, data?: T, error?: string }`
- Revalidate paths after mutations (`revalidatePath`)

```typescript
'use server'

export async function createSubscriber(input: CreateSubscriberInput) {
  const validated = subscriberSchema.safeParse(input);
  if (!validated.success) return { success: false, error: 'Invalid input' };

  const session = await getServerSession();
  if (!session?.tenantId) return { success: false, error: 'Unauthorized' };

  const subscriber = await subscriberService.create(session.tenantId, validated.data);
  revalidatePath('/subscribers');
  return { success: true, data: subscriber };
}
```

---

## Component Patterns

### Server Component (default)
```tsx
// src/app/(admin)/subscribers/page.tsx
export default async function SubscribersPage() {
  const session = await getServerSession();
  const subscribers = await subscriberService.list(session.tenantId);
  return <SubscriberTable data={subscribers} />;
}
```

### Client Component (only when needed)
```tsx
// src/components/tables/subscriber-table.tsx
'use client'

import { DataTable } from '@/components/ui/data-table';
import { columns } from './columns';

export function SubscriberTable({ data }) {
  return <DataTable columns={columns} data={data} />;
}
```

---

## Error Handling

- Services throw typed errors: `throw new AppError('NOT_FOUND', 'Subscriber not found')`
- API routes catch errors and return appropriate HTTP status
- Server Actions catch errors and return `{ success: false, error: message }`
- UI shows toast on error via Sonner
- Unexpected errors logged to Pino + reported to Sentry

---

## Git Commit Convention

```
feat: add subscriber bulk import
fix: radius sync not updating bandwidth on plan change
refactor: extract billing logic to service layer
chore: update prisma dependencies
docs: add API documentation for payment webhooks
```

---

## Testing (Future)

- Unit tests: Vitest for services and utilities
- Integration tests: Vitest + Prisma test client for API routes
- E2E tests: Playwright for critical flows (onboarding, payment, subscriber management)
