import { auth } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  const u = session.user as Record<string, unknown>;
  return {
    id: (u.id as string) ?? "",
    name: (u.name as string) ?? "",
    email: (u.email as string) ?? "",
    role: (u.role as SessionUser["role"]) ?? "STAFF",
    tenantId: (u.tenantId as string) ?? null,
    tenantSlug: (u.tenantSlug as string) ?? null,
  };
}

export async function requireTenantUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  if (!user.tenantId && user.role !== "SUPER_ADMIN") {
    throw new Error("No tenant context");
  }
  return user;
}

export async function requireTenantId(): Promise<string> {
  const user = await requireTenantUser();
  if (!user.tenantId) throw new Error("No tenant context");
  return user.tenantId;
}
