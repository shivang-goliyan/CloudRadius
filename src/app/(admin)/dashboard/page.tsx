import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  Users,
  UserCheck,
  UserX,
  IndianRupee,
  Wifi,
  TrendingUp,
} from "lucide-react";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userName = (session.user as Record<string, unknown>).name as string ?? "User";

  const stats = [
    {
      title: "Total Subscribers",
      value: "0",
      icon: Users,
      change: "+0%",
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Active Subscribers",
      value: "0",
      icon: UserCheck,
      change: "+0%",
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Expired",
      value: "0",
      icon: UserX,
      change: "0%",
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "Monthly Revenue",
      value: "₹0",
      icon: IndianRupee,
      change: "+0%",
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Online Now",
      value: "0",
      icon: Wifi,
      change: "",
      color: "text-cyan-600",
      bg: "bg-cyan-50",
    },
    {
      title: "Collections",
      value: "₹0",
      icon: TrendingUp,
      change: "+0%",
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {userName}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.title}
            className="rounded-lg border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </p>
              <div className={`rounded-md ${stat.bg} p-2`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              {stat.change && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.change} from last month
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground">
            Subscriber Growth
          </h3>
          <div className="mt-4 flex h-64 items-center justify-center text-muted-foreground">
            Chart will be rendered here (Phase 6)
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="text-lg font-semibold text-foreground">
            Revenue Trend
          </h3>
          <div className="mt-4 flex h-64 items-center justify-center text-muted-foreground">
            Chart will be rendered here (Phase 6)
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold text-foreground">
          Recent Activity
        </h3>
        <div className="mt-4 flex h-32 items-center justify-center text-muted-foreground">
          Activity feed will be rendered here
        </div>
      </div>
    </div>
  );
}
