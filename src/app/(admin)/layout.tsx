import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layouts/sidebar";
import { Topbar } from "@/components/layouts/topbar";
import type { SessionUser } from "@/lib/types";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Cast session user to our extended type since NextAuth v5 module augmentation
  // doesn't reliably propagate to all contexts
  const sessionUser = session.user as Record<string, unknown>;

  const user: SessionUser = {
    id: (sessionUser.id as string) ?? "",
    name: (sessionUser.name as string) ?? "",
    email: (sessionUser.email as string) ?? "",
    role: (sessionUser.role as SessionUser["role"]) ?? "STAFF",
    tenantId: (sessionUser.tenantId as string) ?? null,
    tenantSlug: (sessionUser.tenantSlug as string) ?? null,
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar user={user} />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
